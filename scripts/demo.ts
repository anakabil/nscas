// Skrip data demo (Fase 15): mengisi organisasi demo "PT Contoh Konstruksi" dengan satu asesmen lengkap,
// yaitu 12 unit lokasi, 40 proyek, 3.000 responden fiktif, 900 respons survei, penilaian mandiri, bukti contoh,
// nilai dua asesor, sesi validasi, dan hasil mesin penilaian.
//
// Seluruh langkah memakai fungsi layanan aplikasi yang sama dengan antarmuka (bukan sisipan langsung ke tabel),
// sehingga aturan status, snapshot parameter, enkripsi kontak, dan jejak audit berlaku seperti pemakaian nyata.
// Hak akses tiap langkah diperiksa dengan authorizeAssessmentAccess, sama dengan requireRole.
//
// Pemakaian (basis data sudah dimigrasi dan di-seed, MinIO berjalan):
//   DEMO_PASSWORD='kata-sandi-panjang' npm run demo
//   npm run demo -- --stop-at PANEL_REVIEW            berhenti sebelum rapat panel
//   npm run demo -- --stop-at DATA_COLLECTION --tokens-out .demo/tokens.json
//                                                     survei tetap terbuka; token yang belum dipakai ditulis
//                                                     ke berkas untuk uji beban (tests/load/survey.js)
//
// Jangan dijalankan terhadap basis data produksi. Seluruh nama, surel (domain .test), dan dokumen bersifat fiktif.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { createTranslator } from "use-intl/core";
import messages from "../messages/id.json";
import { INSTRUMENT_CODE, OPERATOR_ORGANIZATION, seedDemoOrganization } from "../prisma/seeding";
import type { AssessmentStatus, Role, StratumGroup } from "@/generated/prisma/enums";
import { generateGapList } from "@/lib/action-plan/service";
import type { DraftParameters } from "@/lib/assessments/parameters";
import { editablePart } from "@/lib/assessments/parameters";
import {
  addAssignment,
  createAssessment,
  createUnit,
  saveSamplePlan,
  transitionAssessment,
  updateParameters,
  updateStrataPopulations,
} from "@/lib/assessments/service";
import { finalizePanel, runScoring, saveEvidenceRating, savePanelAdjustment, saveSclAspect } from "@/lib/assessor-scoring/service";
import { logAudit } from "@/lib/audit";
import { authorizeAssessmentAccess, authorizeOrganizationAccess, buildPrincipal } from "@/lib/auth/access";
import { hashPassword } from "@/lib/auth/passwords";
import type { SessionContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { finalizeEvidenceUpload, requestEvidenceUpload } from "@/lib/evidence/service";
import { stopBoss } from "@/lib/jobs/boss";
import { importRoster, issueSurveyLinks, setSurveyWindow } from "@/lib/respondents/service";
import { issueSelfAssessment, saveSelfAssessmentAnswer, submitSelfAssessment } from "@/lib/self-assessment/service";
import { markSurveyOpened, submitSurvey } from "@/lib/survey/service";
import { addParticipant, createSessionsFromProposal, saveAssessorForm, updateSession } from "@/lib/validation/service";
import {
  allocateByWeight,
  createRandom,
  demoProjects,
  fixedEffects,
  generateResponse,
  LOCATIONS,
  ORGANIZATION_EVIDENCE,
  personName,
  PROJECT_EVIDENCE,
  samplePdf,
  STRATA_POPULATION,
  SURVEY_RESPONSES,
  weightedSample,
  workingTime,
  type InstrumentShape,
  type StratumCode,
} from "./demo/model";

const STOP_AT = ["DATA_COLLECTION", "PANEL_REVIEW", "ACTION_PLANNING"] as const;
type StopAt = (typeof STOP_AT)[number];

const { values: args } = parseArgs({
  options: {
    "stop-at": { type: "string", default: "ACTION_PLANNING" },
    seed: { type: "string", default: "20261024" },
    name: { type: "string", default: "Asesmen Budaya K3 Korporat 2026 (demo)" },
    "tokens-out": { type: "string" },
  },
});
const stopAt = args["stop-at"] as StopAt;
if (!STOP_AT.includes(stopAt)) throw new Error(`--stop-at must be one of ${STOP_AT.join(", ")}`);
const password = process.env.DEMO_PASSWORD ?? "";
if (password.length < 12) throw new Error("Set DEMO_PASSWORD (at least 12 characters) for the demo accounts.");

const db = getDb();
const rng = createRandom(Number(args.seed));
const meta = { ipHash: null, userAgent: "scripts/demo.ts" };
const DAY = 86_400_000;
const NOW = new Date();
const t = createTranslator({ locale: "id", messages, namespace: "validation" }) as unknown as (key: string, values?: Record<string, string | number>) => string;

function log(message: string) {
  console.info(`[demo] ${message}`);
}

function expectOk<T extends { ok: boolean }>(result: T, step: string): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(`${step} failed: ${JSON.stringify(result).slice(0, 500)}`);
  return result as Extract<T, { ok: true }>;
}

// ---------------------------------------------------------------------------
// Akun demo dan konteks hak akses
// ---------------------------------------------------------------------------

async function ensureUser(email: string, name: string, organizationId: string, role: Role, unitScope: string[] = []) {
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  const user = existing ?? (await db.user.create({ data: { email, name, passwordHash: await hashPassword(password) }, select: { id: true } }));
  const membership = await db.membership.findFirst({ where: { userId: user.id, organizationId, role }, select: { id: true, unitScope: true } });
  if (!membership) {
    await db.$transaction(async (tx) => {
      const m = await tx.membership.create({ data: { userId: user.id, organizationId, role, unitScope }, select: { id: true } });
      await logAudit(tx, { action: "membership.role_grant", entityType: "Membership", entityId: m.id, organizationId, after: { email, role, unitScope, source: "demo" } });
    });
  } else if (unitScope.some((u) => !membership.unitScope.includes(u))) {
    // Demo kedua (--name) di basis data yang sama: koordinator ditambahkan ke proyek asesmen baru.
    const merged = [...new Set([...membership.unitScope, ...unitScope])];
    await db.$transaction(async (tx) => {
      await tx.membership.update({ where: { id: membership.id }, data: { unitScope: merged } });
      await logAudit(tx, { action: "membership.role_grant", entityType: "Membership", entityId: membership.id, organizationId, before: { unitScope: membership.unitScope }, after: { email, role, unitScope: merged, source: "demo" } });
    });
  }
  return user.id;
}

async function sessionFor(userId: string): Promise<SessionContext> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: { memberships: { include: { organization: { select: { name: true, isOperator: true } } } } },
  });
  const memberships = user.memberships.map((m) => ({ organizationId: m.organizationId, organizationName: m.organization.name, organizationIsOperator: m.organization.isOperator, role: m.role, unitScope: m.unitScope }));
  const principal = buildPrincipal(user.id, memberships);
  return {
    sessionId: "demo-script",
    user: { id: user.id, email: user.email, name: user.name, totpEnabled: user.totpEnabled, mustChangePassword: false },
    principal,
    memberships: memberships.filter((m) => principal.memberships.some((p) => p.organizationId === m.organizationId && p.role === m.role)),
    totpRequired: false,
    totpPending: false,
  };
}

/** Setara requireRole: keanggotaan, penugasan, dan cakupan unit diperiksa terhadap basis data. */
async function actorFor(userId: string, assessmentId: string, roles: readonly Role[]) {
  const session = await sessionFor(userId);
  const access = await authorizeAssessmentAccess(db, session.principal, assessmentId, roles);
  return { ...access, session };
}

// ---------------------------------------------------------------------------
// Langkah demo
// ---------------------------------------------------------------------------

const round2half = (v: number) => Math.min(5, Math.max(1, Math.round(v * 2) / 2));

async function main() {
  const operator = await db.organization.findFirstOrThrow({ where: { legalName: OPERATOR_ORGANIZATION.legalName, isOperator: true } });
  // Seed tidak lagi membuat organisasi demo secara bawaan; skrip ini membuatnya bila belum ada.
  const { id: organizationId } = await seedDemoOrganization(db);
  const organization = await db.organization.findUniqueOrThrow({ where: { id: organizationId } });
  if (await db.assessment.findFirst({ where: { organizationId: organization.id, name: args.name } })) {
    throw new Error(`Assessment "${args.name}" already exists. Reset the database (npx prisma migrate reset) or pass --name.`);
  }
  const version = await db.instrumentVersion.findUniqueOrThrow({ where: { code: INSTRUMENT_CODE } });

  log("akun demo");
  const leadId = await ensureUser("asesor.utama@demo.nusasafety.test", "Ir. Rahmat Hidayat, M.K3", operator.id, "LEAD_ASSESSOR");
  const assessorId = await ensureUser("asesor@demo.nusasafety.test", "Dewi Kartika, S.K.M.", operator.id, "ASSESSOR");
  const clientAdminId = await ensureUser("admin.k3@contoh-konstruksi.test", "Hendra Gunawan", organization.id, "CLIENT_ADMIN");
  await ensureUser("direksi@contoh-konstruksi.test", "Ir. Bambang Wibowo", organization.id, "EXECUTIVE_VIEWER");

  // Pembuatan asesmen oleh lead assessor (setara requireOrganizationRole di halaman asesmen baru).
  const leadSession = await sessionFor(leadId);
  const orgAccess = await authorizeOrganizationAccess(db, leadSession.principal, organization.id, ["LEAD_ASSESSOR"]);
  const { id: assessmentId } = await createAssessment(
    { session: leadSession, organizationId: organization.id, isOperator: false, roles: orgAccess.roles },
    {
      name: args.name,
      scopeType: "CORPORATE",
      periodStart: new Date(NOW.getTime() - 90 * DAY),
      periodEnd: new Date(NOW.getTime() + 30 * DAY),
      targetLevel: 4,
      instrumentVersionId: version.id,
    },
    meta,
  );
  log(`asesmen ${assessmentId}`);
  const lead = await actorFor(leadId, assessmentId, ["LEAD_ASSESSOR"]);

  log("12 unit lokasi dan 40 proyek");
  const locationIds: string[] = [];
  for (const l of LOCATIONS) {
    locationIds.push((await createUnit(lead, { name: l.name, type: l.type, parentId: null, latitude: null, longitude: null, radiusMeters: null }, meta)).id);
  }
  const projects = demoProjects(rng);
  const projectIds: string[] = [];
  for (const p of projects) {
    projectIds.push((await createUnit(lead, { name: p.name, type: "PROJECT", parentId: locationIds[p.locationIndex] as string, latitude: p.latitude, longitude: p.longitude, radiusMeters: 750 }, meta)).id);
  }

  log("populasi strata, parameter, kalkulator sampel, tim asesor");
  const strata = await db.stratum.findMany({ where: { assessmentId }, select: { id: true, code: true, group: true } });
  await updateStrataPopulations(lead, Object.fromEntries(strata.map((s) => [s.id, STRATA_POPULATION[s.code as StratumCode]])), meta);
  const draftRow = await db.assessment.findUniqueOrThrow({ where: { id: assessmentId }, select: { parameterDraft: true, consentTextId: true, consentTextEn: true } });
  await updateParameters(
    lead,
    { parameters: editablePart(draftRow.parameterDraft as unknown as DraftParameters), consentTextId: draftRow.consentTextId ?? "", consentTextEn: draftRow.consentTextEn ?? "", dpaSigned: true },
    meta,
  );
  await saveSamplePlan(lead, { projects: projects.length, locations: LOCATIONS.length }, meta);
  await addAssignment(lead, { userId: assessorId, role: "ASSESSOR" }, meta);
  await transitionAssessment(lead, "CONFIGURED", meta);
  await transitionAssessment(lead, "LOCKED", meta);

  // Koordinator unit untuk satu proyek, dibuat setelah unit ada.
  const coordinatorProject = projectIds[0] as string;
  const coordinatorId = await ensureUser("koordinator.proyek@contoh-konstruksi.test", "Asep Permana", organization.id, "UNIT_COORDINATOR", [coordinatorProject]);

  log("3.000 responden fiktif");
  const unitMean = new Map<string, number>();
  const locationMean = LOCATIONS.map(() => rng.uniform(2.6, 3.5));
  unitMean.set(locationIds[0] as string, 3.4);
  projects.forEach((p, i) => unitMean.set(projectIds[i] as string, Math.min(4.2, Math.max(1.9, (locationMean[p.locationIndex] as number) + rng.normal(0, 0.25)))));
  const projectSize = projectIds.map(() => rng.uniform(0.5, 1.5));
  const rows: { name: string; employeeNo: string; email: string; phone: string; unit: string; stratum: StratumCode; contractor: string }[] = [];
  const unitName = new Map<string, string>([[locationIds[0] as string, LOCATIONS[0].name], ...projects.map((p, i) => [projectIds[i] as string, p.name] as [string, string])]);
  const allocate = (count: number): string[] => allocateByWeight(projectSize, count).flatMap((n, i) => Array.from({ length: n }, () => projectIds[i] as string));
  const placement: [StratumCode, string][] = [
    ...Array.from({ length: STRATA_POPULATION.S1 }, () => ["S1", locationIds[0] as string] as [StratumCode, string]),
    ...Array.from({ length: 20 }, () => ["S2", locationIds[0] as string] as [StratumCode, string]),
    ...allocate(STRATA_POPULATION.S2 - 20).map((u) => ["S2", u] as [StratumCode, string]),
    ...allocate(STRATA_POPULATION.S3).map((u) => ["S3", u] as [StratumCode, string]),
    ...allocate(STRATA_POPULATION.S4).map((u) => ["S4", u] as [StratumCode, string]),
    ...allocate(STRATA_POPULATION.S5).map((u) => ["S5", u] as [StratumCode, string]),
  ];
  const emailRate: Record<StratumCode, number> = { S1: 0.95, S2: 0.9, S3: 0.75, S4: 0.35, S5: 0.1 };
  placement.forEach(([stratum, unit], i) => {
    const name = personName(rng);
    const no = String(i + 1).padStart(5, "0");
    const slug = name.toLowerCase().replace(/[^a-z]+/g, ".");
    rows.push({
      name,
      employeeNo: stratum === "S5" ? `SK-${no}` : `CK-${no}`,
      email: rng.chance(emailRate[stratum]) ? `${slug}.${no}@contoh-konstruksi.test` : "",
      phone: rng.chance(0.6) ? `08${rng.int(11, 59)}${String(rng.int(0, 99_999_999)).padStart(8, "0")}` : "",
      unit: unitName.get(unit) as string,
      stratum,
      contractor: stratum === "S5" ? "Ya" : "Tidak",
    });
  });
  const csv = ["Nama;Nomor induk;Surel;Telepon;Unit;Strata;Penyedia jasa", ...rows.map((r) => [r.name, r.employeeNo, r.email, r.phone, r.unit, r.stratum, r.contractor].join(";"))].join("\n");
  const client = await actorFor(clientAdminId, assessmentId, ["CLIENT_ADMIN"]);
  // Kriteria penerimaan docs/01 M2: impor 3.000 baris di bawah 30 detik.
  const importStart = performance.now();
  const imported = expectOk(await importRoster(client, new TextEncoder().encode(csv), true, meta), "roster import");
  log(`daftar responden diimpor: ${imported.imported} baris dalam ${((performance.now() - importStart) / 1000).toFixed(1)} detik`);

  log("tautan survei dan jendela survei");
  const links = await issueSurveyLinks(client, { unitId: null, onlyWithoutEmail: false }, meta);
  const loadTest = stopAt === "DATA_COLLECTION";
  const opensAt = new Date(NOW.getTime() - (loadTest ? 3 : 45) * DAY);
  const closesAt = new Date(NOW.getTime() + (loadTest ? 14 : -12) * DAY);
  await setSurveyWindow(client, { opensAt, closesAt }, meta);
  await transitionAssessment(lead, "DATA_COLLECTION", meta);

  const instrument = await loadInstrument(version.id);
  const effects = fixedEffects(rng, instrument.characteristics.map((c) => c.code), [...new Set(instrument.climateItems.map((c) => c.dimension))]);
  const unitIdByName = new Map([...unitName].map(([id, name]) => [name, id]));
  const tokens = links.map((l) => ({ raw: l.link.slice(l.link.lastIndexOf("/") + 1), stratum: l.stratumCode as StratumCode, unitId: unitIdByName.get(l.unitName) as string }));

  log("bukti contoh");
  const evidenceByCode = await uploadEvidence(assessmentId, clientAdminId, coordinatorId, coordinatorProject, instrument);

  log("penilaian mandiri manajemen");
  await selfAssessments(client, instrument, unitMean, locationIds[0] as string, projectIds, evidenceByCode);

  log("900 respons survei");
  const participation = projectIds.map(() => rng.uniform(0.6, 1.4));
  const propensity = new Map(projectIds.map((id, i) => [id, participation[i] as number]));
  const responders = (Object.keys(SURVEY_RESPONSES) as StratumCode[]).flatMap((code) =>
    weightedSample(rng, tokens.filter((tk) => tk.stratum === code), (tk) => propensity.get(tk.unitId) ?? 1, SURVEY_RESPONSES[code]),
  );
  const responderSet = new Set(responders.map((r) => r.raw));
  const lastResponseAt = loadTest ? NOW : closesAt;
  let done = 0;
  for (const tk of rng.shuffle(responders)) {
    const response = generateResponse(rng, instrument, { unitMean: unitMean.get(tk.unitId) ?? 3, stratum: tk.stratum }, effects);
    const submittedAt = workingTime(rng, new Date(opensAt.getTime() + DAY), new Date(lastResponseAt.getTime() - 3600_000));
    await markSurveyOpened(tk.raw, new Date(submittedAt.getTime() - response.durationSeconds * 1000));
    expectOk(await submitSurvey(tk.raw, { ...response, stratumId: null }, submittedAt), "survey submit");
    if (++done % 150 === 0) log(`  ${done} respons`);
  }
  // Sebagian penerima membuka tautan tetapi belum mengirim.
  const unused = tokens.filter((tk) => !responderSet.has(tk.raw));
  for (const tk of unused.filter(() => rng.chance(0.08))) await markSurveyOpened(tk.raw, workingTime(rng, opensAt, lastResponseAt));

  if (loadTest) {
    writeTokens(assessmentId, unused, instrument);
    return summary(assessmentId, "DATA_COLLECTION");
  }

  log("sesi validasi daring");
  await validationSessions(assessmentId, leadId, assessorId, instrument, unitMean, locationIds[0] as string, projectIds, strata);

  log("nilai bukti dua asesor dan jalur setara");
  const assessor = await actorFor(assessorId, assessmentId, ["ASSESSOR"]);
  const orgMean = [...unitMean.values()].reduce((s, v) => s + v, 0) / unitMean.size;
  for (const c of instrument.characteristics) {
    const base = orgMean + (effects.characteristic[c.code] ?? 0) * 0.8 + rng.normal(0, 0.25);
    const leadLevel = round2half(base);
    // K5.1 sengaja berbeda 1,5 poin agar tanda perbedaan penilaian asesor tampil di rapat panel.
    const assessorLevel = c.code === "K5.1" ? round2half(leadLevel >= 3 ? leadLevel - 1.5 : leadLevel + 1.5) : round2half(leadLevel + rng.pick([-0.5, 0, 0, 0.5]));
    const evidenceIds = evidenceByCode.get(c.code) ?? [];
    await saveEvidenceRating(lead, c.code, { level: leadLevel, rationale: rationale(c.code, leadLevel, evidenceIds.length), evidenceIds, observationIds: [] }, meta);
    await saveEvidenceRating(assessor, c.code, { level: assessorLevel, rationale: rationale(c.code, assessorLevel, evidenceIds.length), evidenceIds, observationIds: [] }, meta);
  }
  for (const aspectCode of ["A1", "A2", "A3", "A4", "A5", "A6"]) {
    const strength = rng.uniform(-8, 8);
    const pct = (base: number) => Math.round(Math.min(100, Math.max(0, base + strength + rng.normal(0, 5))));
    await saveSclAspect(
      lead,
      {
        aspectCode,
        entries: [
          { step: 2, percent: pct(95), justification: "Persyaratan dasar terpenuhi dan terdokumentasi." },
          { step: 3, percent: pct(82), justification: "Sebagian besar praktik berjalan, belum merata di semua proyek." },
          { step: 4, percent: pct(55), justification: "Praktik proaktif baru terlihat di sebagian proyek." },
          { step: 5, percent: pct(25), justification: "Belum menjadi kebiasaan di seluruh organisasi." },
        ],
      },
      meta,
    );
  }

  log("mesin penilaian");
  await transitionAssessment(lead, "SCORING", meta);
  const run = await runScoring(lead, meta);
  await transitionAssessment(lead, "PANEL_REVIEW", meta);
  log(`indeks organisasi hasil mesin ${run.result.organization.index.toFixed(4)}`);
  if (stopAt === "PANEL_REVIEW") return summary(assessmentId, "PANEL_REVIEW");

  log("rapat panel, penetapan hasil, dan daftar kesenjangan");
  const k51 = run.result.characteristics.find((c) => c.code === "K5.1");
  if (k51 && k51.final !== null) {
    const adjusted = Math.min(5, Math.max(1, Math.round((k51.final + 0.25) * 100) / 100));
    await savePanelAdjustment(lead, { characteristicCode: "K5.1", adjustedValue: adjusted, rationale: "Panel menilai laporan hampir celaka meningkat konsisten selama enam bulan; nilai disesuaikan setelah diskusi kedua asesor." }, meta);
  }
  await finalizePanel(lead, meta);
  await transitionAssessment(lead, "ACTION_PLANNING", meta);
  const gaps = await generateGapList({ ...lead, unitScope: null }, meta);
  log(`daftar kesenjangan: ${gaps} butir`);
  return summary(assessmentId, "ACTION_PLANNING");
}

async function loadInstrument(instrumentVersionId: string): Promise<InstrumentShape & { requirements: Map<string, string[]> }> {
  const characteristics = await db.characteristic.findMany({
    where: { instrumentVersionId },
    orderBy: { order: "asc" },
    select: { id: true, code: true, levelStatements: { select: { id: true, level: true } }, evidenceRequirements: { select: { id: true }, orderBy: { order: "asc" } } },
  });
  const items = await db.climateItem.findMany({ where: { dimension: { instrumentVersionId } }, orderBy: [{ dimension: { order: "asc" } }, { order: "asc" }], select: { id: true, reverseCoded: true, dimension: { select: { code: true } } } });
  return {
    characteristics: characteristics.map((c) => ({ id: c.id, code: c.code, statements: c.levelStatements })),
    climateItems: items.map((i) => ({ id: i.id, dimension: i.dimension.code, reverseCoded: i.reverseCoded })),
    requirements: new Map(characteristics.map((c) => [c.code, c.evidenceRequirements.map((r) => r.id)])),
  };
}

async function uploadEvidence(assessmentId: string, clientAdminId: string, coordinatorId: string, projectId: string, instrument: Awaited<ReturnType<typeof loadInstrument>>) {
  const byCode = new Map<string, string[]>();
  const idOf = new Map(instrument.characteristics.map((c) => [c.code, c.id]));
  const upload = async (actor: Awaited<ReturnType<typeof actorFor>>, unitId: string | null, doc: { title: string; characteristics: string[] }, index: number) => {
    const bytes = samplePdf(doc.title, ["Dokumen contoh untuk demonstrasi NSCAS.", "PT Contoh Konstruksi (fiktif).", `Nomor dokumen DEMO-${String(index + 1).padStart(3, "0")}`]);
    const fileName = `${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
    const grant = await requestEvidenceUpload(actor, { fileName, size: bytes.byteLength, contentType: "application/pdf", title: doc.title, description: "Dokumen contoh fiktif.", unitId, supersedesId: null });
    const put = await fetch(grant.url, { method: "PUT", headers: grant.headers, body: Buffer.from(bytes) });
    if (!put.ok) throw new Error(`evidence upload failed: ${put.status} ${await put.text()}`);
    const links = doc.characteristics.map((code, i) => ({ characteristicId: idOf.get(code) as string, requirementIds: (instrument.requirements.get(code) ?? []).slice(i % 2, (i % 2) + 1) }));
    const result = await finalizeEvidenceUpload(actor, grant.ticket, links, meta);
    for (const code of doc.characteristics) byCode.set(code, [...(byCode.get(code) ?? []), result.id]);
  };
  const client = await actorFor(clientAdminId, assessmentId, ["CLIENT_ADMIN"]);
  for (const [i, doc] of ORGANIZATION_EVIDENCE.entries()) await upload(client, null, doc, i);
  const coordinator = await actorFor(coordinatorId, assessmentId, ["UNIT_COORDINATOR"]);
  for (const [i, doc] of PROJECT_EVIDENCE.entries()) await upload(coordinator, projectId, doc, ORGANIZATION_EVIDENCE.length + i);
  return byCode;
}

const JUSTIFICATIONS = [
  "Praktik ini sudah berjalan di kantor pusat dan sebagian besar proyek, dibuktikan dengan risalah rapat dan laporan bulanan.",
  "Kebijakan dan prosedurnya sudah ada, tetapi pelaksanaannya di proyek penyedia jasa belum konsisten setiap bulan.",
  "Manajemen meninjau hal ini dalam rapat triwulanan dan menetapkan tindak lanjut yang dipantau sampai selesai.",
  "Pekerja dilibatkan melalui pertemuan pagi dan usulan perbaikan, meskipun partisipasi subkontraktor masih rendah.",
];

async function selfAssessments(client: Awaited<ReturnType<typeof actorFor>>, instrument: InstrumentShape, unitMean: Map<string, number>, headOffice: string, projectIds: string[], evidenceByCode: Map<string, string[]>) {
  const people = [
    { name: "Ir. Bambang Wibowo", position: "Direktur Operasi", unitId: headOffice },
    { name: "Sri Lestari, S.T., M.K3", position: "Kepala Divisi K3 dan Mutu", unitId: headOffice },
    { name: "Hadi Santoso, S.T.", position: "Manajer Proyek", unitId: projectIds[0] as string },
    { name: "Yusuf Ramadhan, S.T.", position: "Manajer Proyek", unitId: projectIds[5] as string },
    { name: "Made Prasetyo, S.T.", position: "Manajer Proyek", unitId: projectIds[12] as string },
    { name: "Indra Nasution, S.T.", position: "Manajer Proyek", unitId: projectIds[23] as string },
  ];
  for (const [i, p] of people.entries()) {
    const { link } = await issueSelfAssessment(client, p, meta);
    const raw = link.slice(link.lastIndexOf("/") + 1);
    // Orang terakhir baru mengisi sebagian (draf), agar daftar memperlihatkan status yang berbeda.
    const answered = i === people.length - 1 ? instrument.characteristics.slice(0, 7) : instrument.characteristics;
    for (const c of answered) {
      // Penilaian mandiri manajemen umumnya lebih tinggi daripada persepsi pekerja.
      const level = Math.min(5, Math.max(1, Math.round((unitMean.get(p.unitId) ?? 3) + 0.7 + rng.normal(0, 0.5))));
      const statement = c.statements.find((s) => s.level === level) ?? c.statements[0]!;
      expectOk(
        await saveSelfAssessmentAnswer(raw, { characteristicId: c.id, statementId: statement.id, justification: rng.pick(JUSTIFICATIONS), evidenceIds: (evidenceByCode.get(c.code) ?? []).slice(0, 1) }, meta),
        "self-assessment answer",
      );
    }
    if (answered.length === instrument.characteristics.length) expectOk(await submitSelfAssessment(raw, meta), "self-assessment submit");
  }
}

const POSITIONS: Record<StratumCode, string> = { S1: "Direktur", S2: "Manajer Proyek", S3: "Pengawas Lapangan", S4: "Pelaksana", S5: "Pekerja Subkontraktor" };

async function validationSessions(
  assessmentId: string,
  leadId: string,
  assessorId: string,
  instrument: InstrumentShape,
  unitMean: Map<string, number>,
  headOffice: string,
  projectIds: string[],
  strata: { id: string; code: string; group: StratumGroup }[],
) {
  const lead = await actorFor(leadId, assessmentId, ["LEAD_ASSESSOR"]);
  const assessor = await actorFor(assessorId, assessmentId, ["ASSESSOR"]);
  await createSessionsFromProposal(
    lead,
    (s) =>
      s.stratumCode
        ? t("sessionLabel", { type: t(`typeShort.${s.type}`), stratum: s.stratumCode, sequence: s.sequence })
        : t("sessionLabelNoStratum", { type: t(`typeShort.${s.type}`), sequence: s.sequence }),
    meta,
  );
  const sessions = await db.validationSession.findMany({ where: { assessmentId }, orderBy: [{ type: "asc" }, { label: "asc" }], select: { id: true, type: true, label: true, stratumId: true, participantCount: true, guideTemplate: { select: { layer: true } } } });
  for (const [i, s] of sessions.entries()) {
    const stratum = strata.find((x) => x.id === s.stratumId);
    const code = (stratum?.code ?? "S4") as StratumCode;
    const unitId = code === "S1" || (code === "S2" && i % 3 === 0) ? headOffice : (rng.pick(projectIds) as string);
    const cancelled = rng.chance(0.07);
    const scheduledAt = workingTime(rng, new Date(NOW.getTime() - 40 * DAY), new Date(NOW.getTime() - 14 * DAY));
    const layer = (s.guideTemplate?.layer ?? stratum?.group ?? "FIELD") as StratumGroup;
    const participants = s.type === "INTERVIEW" ? 1 : s.type === "FOCUS_GROUP" ? Math.max(3, s.participantCount ?? 6) : 0;
    await updateSession(
      lead,
      s.id,
      {
        label: s.label,
        unitId,
        stratumId: s.stratumId,
        scheduledAt,
        meetingUrl: `https://rapat.contoh-konstruksi.test/k3-${String(i + 1).padStart(3, "0")}`,
        participantCount: participants || null,
        guideLayer: layer,
        status: cancelled ? "CANCELLED" : "COMPLETED",
      },
      meta,
    );
    if (cancelled) continue;
    for (let k = 0; k < participants; k++) await addParticipant(lead, s.id, { fullName: personName(rng), position: s.stratumId ? POSITIONS[code] : "Pekerja proyek" }, meta);
    // Nilai validasi mendekati kematangan nyata unit, lebih rendah dari penilaian mandiri manajemen.
    const mean = (unitMean.get(unitId) ?? 3) + (code === "S1" || code === "S2" ? 0.15 : 0);
    const covered = s.type === "INTERVIEW" ? rng.shuffle(instrument.characteristics).slice(0, 10) : instrument.characteristics;
    const raters = rng.chance(0.3) ? [lead, assessor] : [i % 2 === 0 ? lead : assessor];
    for (const rater of raters) {
      await saveAssessorForm(
        rater,
        s.id,
        {
          recordingConsent: rng.chance(0.8),
          notes: "Sesi berjalan sesuai panduan; narasumber terbuka menyampaikan contoh nyata di lapangan.",
          ratings: covered.map((c) => ({ characteristicId: c.id, level: round2half(mean + rng.normal(0, 0.5)), note: null })),
        },
        meta,
      );
    }
  }
}

function rationale(code: string, level: number, evidenceCount: number): string {
  return `${code}: ${evidenceCount} bukti diperiksa. Nilai ${String(level).replace(".", ",")} karena praktik sudah terdokumentasi, tetapi pelaksanaannya belum merata di seluruh proyek.`;
}

function writeTokens(assessmentId: string, unused: { raw: string }[], instrument: InstrumentShape) {
  const out = args["tokens-out"];
  if (!out) return;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify(
      {
        assessmentId,
        tokens: unused.map((u) => u.raw),
        characteristics: instrument.characteristics.map((c) => ({ id: c.id, statementIds: c.statements.map((s) => s.id) })),
        climateItems: instrument.climateItems.map((i) => i.id),
      },
      null,
      2,
    ),
  );
  log(`${unused.length} token yang belum dipakai ditulis ke ${out}`);
}

async function summary(assessmentId: string, status: AssessmentStatus) {
  const a = await db.assessment.findUniqueOrThrow({ where: { id: assessmentId }, select: { status: true, _count: { select: { units: true, rosterEntries: true, surveyResponses: true, selfAssessments: true, evidenceItems: true, validationSessions: true } } } });
  if (a.status !== status) throw new Error(`expected status ${status}, got ${a.status}`);
  log(`selesai: status ${a.status}, ${JSON.stringify(a._count)}`);
  log("akun demo (kata sandi dari DEMO_PASSWORD; verifikasi dua langkah diaktifkan saat masuk pertama):");
  for (const email of ["asesor.utama@demo.nusasafety.test", "asesor@demo.nusasafety.test", "admin.k3@contoh-konstruksi.test", "koordinator.proyek@contoh-konstruksi.test", "direksi@contoh-konstruksi.test"]) log(`  ${email}`);
  log(`buka /assessments/${assessmentId}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopBoss().catch(() => undefined);
    await db.$disconnect();
  });
