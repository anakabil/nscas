// Menyiapkan basis data e2e (nscas_e2e) sebelum server uji dijalankan oleh Playwright:
// dibuat ulang dari migrasi, diisi seed instrumen, lalu data uji untuk skenario hak akses.
// Data uji ditulis ke tests/e2e/.fixtures.json (diabaikan git) untuk dibaca oleh spesifikasi.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";
import { generateSecret } from "otplib";
import { Client } from "pg";
import { PrismaClient, type Role } from "../../src/generated/prisma/client";
import { encryptField, fieldContext } from "../../src/lib/privacy/crypto";
import { generateToken, hashToken } from "../../src/lib/privacy/tokens";
import { runEngine, toEngineParameters, type ParameterSnapshot } from "../../src/lib/scoring";
import { samplePlan } from "../../src/lib/scoring/sampling";
import simulation from "../../seed/fixtures/skoring-simulasi.json";
import { seedDatabase } from "../../prisma/seeding";
import { e2eDatabaseUrl } from "./database-url";

export const E2E_PASSWORD = "Kata-Sandi-Uji-2026";

async function main(): Promise<void> {
  const url = new URL(e2eDatabaseUrl());
  const name = url.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${name}"`);
  await client.end();
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe" });

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  await seedDatabase(prisma, { seedDir: join(__dirname, "..", "..", "seed"), admin: { email: "super@e2e.test", password: E2E_PASSWORD } });

  const passwordHash = await argon2.hash(E2E_PASSWORD, { type: argon2.argon2id });
  const operator = await prisma.organization.findFirstOrThrow({ where: { isOperator: true } });
  const version = await prisma.instrumentVersion.findUniqueOrThrow({ where: { code: "NS-SCML-1.0" } });
  const [orgA, orgB] = await Promise.all(
    [
      { name: "PT Alfa Konstruksi", legalName: "PT Alfa Konstruksi" },
      { name: "PT Beta Infrastruktur", legalName: "PT Beta Infrastruktur" },
    ].map((data) => prisma.organization.create({ data: { ...data, sector: "Konstruksi" } })),
  );

  const base = {
    instrumentVersionId: version.id,
    scopeType: "CORPORATE" as const,
    periodStart: new Date("2026-11-01"),
    periodEnd: new Date("2027-01-31"),
    targetLevel: 4,
  };
  const assessmentA = await prisma.assessment.create({ data: { ...base, organizationId: orgA.id, name: "Asesmen Budaya K3 Alfa 2026" } });
  const assessmentB = await prisma.assessment.create({ data: { ...base, organizationId: orgB.id, name: "Asesmen Budaya K3 Beta 2026" } });
  const unit = (assessmentId: string, unitName: string) =>
    prisma.unit.create({ data: { assessmentId, name: unitName, type: "PROJECT" } });
  const [unitA1, unitA2, unitB1] = await Promise.all([
    unit(assessmentA.id, "Proyek Jalan Tol Seksi 1"),
    unit(assessmentA.id, "Proyek Bendungan Hulu"),
    unit(assessmentB.id, "Proyek Pelabuhan Timur"),
  ]);
  const stratum = (assessmentId: string) =>
    prisma.stratum.create({ data: { assessmentId, code: "S4", name: "Pelaksana", group: "FIELD", population: 100 } });
  const [stratumA, stratumB] = await Promise.all([stratum(assessmentA.id), stratum(assessmentB.id)]);
  await prisma.rosterEntry.createMany({
    data: [
      { assessmentId: assessmentA.id, unitId: unitA1.id, stratumId: stratumA.id, fullName: "Responden Alfa Satu", employeeNo: "A-001" },
      { assessmentId: assessmentA.id, unitId: unitA1.id, stratumId: stratumA.id, fullName: "Responden Alfa Dua", employeeNo: "A-002" },
      { assessmentId: assessmentA.id, unitId: unitA2.id, stratumId: stratumA.id, fullName: "Responden Alfa Tiga", employeeNo: "A-003" },
      { assessmentId: assessmentB.id, unitId: unitB1.id, stratumId: stratumB.id, fullName: "Responden Beta Satu", employeeNo: "B-001" },
    ],
  });

  // Fase 5: asesmen organisasi ketiga yang sudah dikunci, untuk alur impor responden dan distribusi token.
  // Organisasi tersendiri agar pengguna ber-TOTP-nya tidak dipakai bersamaan dengan spesifikasi lain.
  const orgC = await prisma.organization.create({ data: { name: "PT Gamma Karya", legalName: "PT Gamma Karya", sector: "Konstruksi" } });
  const assessmentC = await prisma.assessment.create({
    data: { ...base, organizationId: orgC.id, name: "Asesmen Budaya K3 Gamma 2026", status: "LOCKED", lockedAt: new Date(), dpaSigned: true },
  });
  const [unitC1, unitC2] = await Promise.all([unit(assessmentC.id, "Proyek Gedung Utama"), unit(assessmentC.id, "Proyek Jembatan Barat")]);
  const strataC: [string, string, "MANAGEMENT" | "SUPERVISORY" | "FIELD", number, boolean][] = [
    ["S1", "Direksi dan manajemen puncak", "MANAGEMENT", 10, false],
    ["S2", "Manajemen menengah dan manajer proyek", "MANAGEMENT", 40, false],
    ["S3", "Penyelia dan pengawas lapangan", "SUPERVISORY", 100, false],
    ["S4", "Pelaksana dan pekerja sendiri", "FIELD", 400, false],
    ["S5", "Pekerja penyedia jasa dan subkontraktor", "FIELD", 450, true],
  ];
  await prisma.stratum.createMany({
    data: strataC.map(([code, stratumName, group, population, isContractor]) => ({ assessmentId: assessmentC.id, code, name: stratumName, group, population, isContractor })),
  });

  // Fase 6: asesmen yang sedang mengumpulkan data, dengan token survei mentah untuk tiap proyek uji
  // (tidak ada token yang dipakai dua proyek sekaligus).
  // Fase 9: snapshot memuat parameter bawaan lengkap dan hasil kalkulator sampel agar usulan sesi validasi tersedia.
  const parameters = Object.fromEntries(Object.entries(version.defaultParameters as Record<string, unknown>).filter(([key]) => !key.startsWith("_")));
  const strataS = [
    { code: "S2", name: "Manajemen menengah dan manajer proyek", group: "MANAGEMENT" as const, population: 20, isContractor: false },
    { code: "S3", name: "Penyelia dan pengawas lapangan", group: "SUPERVISORY" as const, population: 60, isContractor: false },
    { code: "S4", name: "Pelaksana dan pekerja sendiri", group: "FIELD" as const, population: 200, isContractor: false },
    { code: "S5", name: "Pekerja penyedia jasa dan subkontraktor", group: "FIELD" as const, population: 300, isContractor: true },
  ];
  const planS = samplePlan({ workers: strataS.reduce((sum, s) => sum + s.population, 0), projects: 2, locations: 1, strata: strataS });
  const assessmentS = await prisma.assessment.create({
    data: {
      ...base,
      organizationId: orgC.id,
      name: "Survei Budaya K3 Gamma 2026",
      status: "DATA_COLLECTION",
      lockedAt: new Date(),
      dpaSigned: true,
      surveyOpensAt: new Date(Date.now() - 24 * 3_600_000),
      surveyClosesAt: new Date(Date.now() + 14 * 24 * 3_600_000),
      parameterSnapshot: {
        consent: {
          id: "PT Gamma Karya bersama Nusa Safety mengukur budaya keselamatan dan kesehatan kerja. Jawaban Anda anonim.",
          en: "PT Gamma Karya and Nusa Safety are measuring occupational safety and health culture. Your answers are anonymous.",
        },
        parameters,
        samplePlan: { projects: 2, locations: 1, computedAt: new Date().toISOString(), result: planS },
      } as never,
    },
  });
  const unitS = await unit(assessmentS.id, "Proyek Survei Timur");
  await prisma.stratum.createMany({ data: strataS.map((s) => ({ ...s, assessmentId: assessmentS.id })) });
  const stratumS = await prisma.stratum.findFirstOrThrow({ where: { assessmentId: assessmentS.id, code: "S4" } });
  // Seperti hasil penguncian sebenarnya, snapshot memuat strata beserta id-nya.
  const snapshotS = assessmentS.parameterSnapshot as Record<string, unknown>;
  const lockedStrataS = await prisma.stratum.findMany({ where: { assessmentId: assessmentS.id }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, group: true, population: true, isContractor: true } });
  await prisma.assessment.update({ where: { id: assessmentS.id }, data: { parameterSnapshot: { ...snapshotS, schemaVersion: 1, strata: lockedStrataS, dpaSigned: true } as never } });
  const surveyTokens: Record<string, string> = {};
  for (const project of ["desktop-chromium", "mobile-chromium"]) {
    for (const purpose of ["main", "payload", "decline", "qr"]) {
      const raw = generateToken();
      await prisma.accessToken.create({
        data: {
          assessmentId: assessmentS.id,
          unitId: unitS.id,
          stratumId: purpose === "qr" ? null : stratumS.id,
          kind: "SURVEY",
          channel: purpose === "qr" ? "QR" : "LINK",
          tokenHash: hashToken(raw),
        },
      });
      surveyTokens[`${project}:${purpose}`] = raw;
    }
  }
  const revokedRaw = generateToken();
  await prisma.accessToken.create({
    data: { assessmentId: assessmentS.id, unitId: unitS.id, stratumId: stratumS.id, kind: "SURVEY", channel: "LINK", tokenHash: hashToken(revokedRaw), revokedAt: new Date(), revokedReason: "MANUAL" },
  });
  surveyTokens.revoked = revokedRaw;

  const secrets: Record<string, string> = {};
  async function user(key: string, email: string, org: string, role: Role, options: { totp?: boolean; unitScope?: string[]; mustChangePassword?: boolean } = {}) {
    const existing = await prisma.user.findUnique({ where: { email } });
    const u = existing ?? (await prisma.user.create({ data: { email, name: key, passwordHash, mustChangePassword: options.mustChangePassword ?? false } }));
    if (!existing) await prisma.membership.create({ data: { userId: u.id, organizationId: org, role, unitScope: options.unitScope ?? [] } });
    if (options.totp) {
      secrets[key] = generateSecret();
      await prisma.user.update({
        where: { id: u.id },
        data: { totpEnabled: true, totpEnabledAt: new Date(), totpSecretEnc: encryptField(secrets[key], fieldContext("User", "totpSecretEnc", u.id)) },
      });
    }
    return { id: u.id, email };
  }

  const users = {
    superAdmin: await user("superAdmin", "super@e2e.test", operator.id, "SUPER_ADMIN", { totp: true }),
    adminA: await user("adminA", "admin.alfa@e2e.test", orgA.id, "CLIENT_ADMIN", { totp: true }),
    adminB: await user("adminB", "admin.beta@e2e.test", orgB.id, "CLIENT_ADMIN", { totp: true }),
    coordinatorA: await user("coordinatorA", "koordinator.alfa@e2e.test", orgA.id, "UNIT_COORDINATOR", { unitScope: [unitA1.id] }),
    newAdminA: await user("newAdminA", "admin.baru@e2e.test", orgA.id, "CLIENT_ADMIN"),
    lockoutUser: await user("lockoutUser", "terkunci@e2e.test", orgA.id, "EXECUTIVE_VIEWER"),
    tempPasswordUser: await user("tempPasswordUser", "sementara@e2e.test", orgA.id, "EXECUTIVE_VIEWER", { mustChangePassword: true }),
    leadAssessor: await user("leadAssessor", "asesor.utama@e2e.test", operator.id, "LEAD_ASSESSOR", { totp: true }),
    assessorStaff: await user("assessorStaff", "asesor@e2e.test", operator.id, "ASSESSOR"),
    adminC: await user("adminC", "admin.gamma@e2e.test", orgC.id, "CLIENT_ADMIN", { totp: true }),
    coordinatorC: await user("coordinatorC", "koordinator.gamma@e2e.test", orgC.id, "UNIT_COORDINATOR", { unitScope: [unitC1.id] }),
    // Fase 7: administrator klien kedua organisasi C, agar kode TOTP-nya tidak bentrok dengan adminC.
    adminSurvey: await user("adminSurvey", "admin.survei@e2e.test", orgC.id, "CLIENT_ADMIN", { totp: true }),
    // Fase 8: koordinator unit asesmen survei (tanpa TOTP) untuk bukti dan observasi digital.
    coordinatorSurvey: await user("coordinatorSurvey", "koordinator.survei@e2e.test", orgC.id, "UNIT_COORDINATOR", { unitScope: [unitS.id] }),
    // Fase 9: lead assessor dan asesor yang ditugaskan pada asesmen survei untuk validasi daring.
    leadValidation: await user("leadValidation", "asesor.utama.validasi@e2e.test", operator.id, "LEAD_ASSESSOR", { totp: true }),
    assessorValidation: await user("assessorValidation", "asesor.validasi@e2e.test", operator.id, "ASSESSOR", { totp: true }),
  };
  // Fase 10: lead assessor dan asesor tersendiri untuk penilaian asesor dan rapat panel.
  const leadScoring = await user("leadScoring", "asesor.utama.penilaian@e2e.test", operator.id, "LEAD_ASSESSOR", { totp: true });
  const assessorScoring = await user("assessorScoring", "asesor.penilaian@e2e.test", operator.id, "ASSESSOR", { totp: true });
  Object.assign(users, { leadScoring, assessorScoring });
  await prisma.assessmentAssignment.createMany({
    data: [
      { assessmentId: assessmentS.id, userId: users.leadValidation.id, role: "LEAD_ASSESSOR" },
      { assessmentId: assessmentS.id, userId: users.assessorValidation.id, role: "ASSESSOR" },
      { assessmentId: assessmentS.id, userId: leadScoring.id, role: "LEAD_ASSESSOR" },
      { assessmentId: assessmentS.id, userId: assessorScoring.id, role: "ASSESSOR" },
    ],
  });
  const characteristics = await prisma.characteristic.findMany({ where: { instrumentVersionId: version.id }, orderBy: { order: "asc" }, select: { id: true, code: true } });
  const characteristicId = (code: string) => characteristics.find((c) => c.code === code)?.id as string;
  // Nilai asesor lain yang sudah ada untuk K2.1, agar layar penilaian menyembunyikannya sebelum asesor menyimpan.
  await prisma.evidenceRating.create({
    data: { assessmentId: assessmentS.id, characteristicId: characteristicId("K2.1"), assessorId: users.leadAssessor.id, level: 4, rationale: "Kebijakan K3 ditinjau tahunan dan dikomunikasikan ke proyek.", evidenceIds: [] },
  });

  // Fase 10: asesmen berstatus penilaian dengan data lengkap untuk eksekusi mesin dan rapat panel.
  const assessmentP = await prisma.assessment.create({
    data: {
      ...base,
      organizationId: orgC.id,
      name: "Asesmen Panel Gamma 2026",
      status: "SCORING",
      lockedAt: new Date(),
      dpaSigned: true,
      surveyOpensAt: new Date(Date.now() - 30 * 24 * 3_600_000),
      surveyClosesAt: new Date(Date.now() - 2 * 24 * 3_600_000),
    },
  });
  const unitP = await unit(assessmentP.id, "Proyek Panel Selatan");
  await prisma.stratum.createMany({
    data: [
      { assessmentId: assessmentP.id, code: "S2", name: "Manajemen menengah dan manajer proyek", group: "MANAGEMENT", population: 20 },
      { assessmentId: assessmentP.id, code: "S4", name: "Pelaksana dan pekerja sendiri", group: "FIELD", population: 200 },
    ],
  });
  const strataP = await prisma.stratum.findMany({ where: { assessmentId: assessmentP.id }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, group: true, population: true, isContractor: true } });
  await prisma.assessment.update({
    where: { id: assessmentP.id },
    data: {
      parameterSnapshot: {
        schemaVersion: 1,
        parameters,
        samplePlan: null,
        strata: strataP,
        consent: { id: "Persetujuan responden asesmen panel.", en: "Respondent consent for the panel assessment." },
        dpaSigned: true,
      } as never,
    },
  });
  await prisma.assessmentAssignment.createMany({
    data: [
      { assessmentId: assessmentP.id, userId: leadScoring.id, role: "LEAD_ASSESSOR" },
      { assessmentId: assessmentP.id, userId: assessorScoring.id, role: "ASSESSOR" },
    ],
  });
  // Persepsi: manajemen 4, lapangan 3 (K1.3 lebih tinggi agar selisih dengan bukti mencapai ambang).
  for (const [code, count, level] of [["S2", 5, 4], ["S4", 6, 3]] as const) {
    const stratumId = strataP.find((x) => x.code === code)?.id as string;
    for (let i = 0; i < count; i++) {
      await prisma.surveyResponse.create({
        data: {
          assessmentId: assessmentP.id,
          unitId: unitP.id,
          stratumId,
          instrumentVersionId: version.id,
          language: "id",
          submittedOn: new Date(Date.now() - 10 * 24 * 3_600_000),
          durationBucket: "FROM_10_TO_15",
          characteristicAnswers: { create: characteristics.map((c) => ({ characteristicId: c.id, level: c.code === "K1.3" ? 4 : level })) },
        },
      });
    }
  }
  // Bukti dari dua asesor: K1.3 rendah (selisih persepsi dan bukti), K3.1 berselisih 2,0 (perlu rekonsiliasi).
  const evidenceLevels = (code: string): [number, number] => (code === "K1.3" ? [2.5, 2.5] : code === "K3.1" ? [2, 4] : [3, 3.5]);
  await prisma.evidenceRating.createMany({
    data: characteristics.flatMap((c) =>
      [users.leadAssessor.id, users.assessorStaff.id].map((assessorId, i) => ({
        assessmentId: assessmentP.id,
        characteristicId: c.id,
        assessorId,
        level: evidenceLevels(c.code)[i] as number,
        rationale: `Penilaian bukti ${c.code} berdasarkan dokumen dan observasi proyek.`,
        evidenceIds: [],
      })),
    ),
  });
  const sessionP = await prisma.validationSession.create({ data: { assessmentId: assessmentP.id, type: "FOCUS_GROUP", label: "Diskusi kelompok S4 nomor 1", status: "COMPLETED" } });
  await prisma.validationRating.createMany({ data: characteristics.map((c) => ({ sessionId: sessionP.id, characteristicId: c.id, assessorId: users.leadAssessor.id, level: 3 })) });
  await prisma.sclFulfillment.createMany({
    data: ["A1", "A2", "A3", "A4", "A5", "A6"].flatMap((aspectCode) =>
      [2, 3, 4, 5].map((step) => ({ assessmentId: assessmentP.id, aspectCode, step, percent: [90, 82, 70, 50][step - 2] as number, justification: `Pemenuhan kriteria tingkat ${step}.`, enteredById: users.leadAssessor.id })),
    ),
  });

  // Fase 8: jendela observasi yang sedang terbuka dan yang sudah ditutup, di titik Jakarta dengan radius 500 meter.
  const site = { latitude: -6.2088, longitude: 106.8456, radiusMeters: 500 };
  const checklist = [
    { code: "O1", label: "Pemakaian alat pelindung diri di area kerja" },
    { code: "O2", label: "Rambu dan pembatas area berbahaya" },
  ];
  const observationOpen = await prisma.observationWindow.create({
    data: { assessmentId: assessmentS.id, unitId: unitS.id, title: "Observasi area kerja pekan pertama", opensAt: new Date(Date.now() - 3_600_000), closesAt: new Date(Date.now() + 7 * 24 * 3_600_000), checklist, createdById: users.leadAssessor.id, ...site },
  });
  const observationClosed = await prisma.observationWindow.create({
    data: { assessmentId: assessmentS.id, unitId: unitS.id, title: "Observasi yang sudah ditutup", opensAt: new Date(Date.now() - 3 * 24 * 3_600_000), closesAt: new Date(Date.now() - 2 * 24 * 3_600_000), checklist, createdById: users.leadAssessor.id, ...site },
  });

  // Fase 11: asesmen dengan hasil final untuk dasbor, periode sebelumnya untuk pembandingan, dan respons survei
  // dengan sel kecil (S1 3 responden; Proyek Dasbor Selatan 2 responden) untuk menguji penyembunyian sel.
  const engineParams = toEngineParameters(parameters as unknown as ParameterSnapshot);
  const resultFrom = (shift: number) =>
    runEngine({ characteristics: simulation.input.characteristics.map((c) => ({ ...c, perception: c.p + shift, evidence: c.e + shift, validation: c.v + shift })), targetLevel: 4 }, engineParams);
  const dashboardAssessment = async (name: string, periodStart: string) => {
    const a = await prisma.assessment.create({
      data: { ...base, organizationId: orgC.id, name, status: "ACTION_PLANNING", lockedAt: new Date(), dpaSigned: true, periodStart: new Date(periodStart), periodEnd: new Date(new Date(periodStart).getTime() + 90 * 86_400_000) },
    });
    await prisma.stratum.createMany({
      data: [
        { assessmentId: a.id, code: "S1", name: "Direksi dan manajemen puncak", group: "MANAGEMENT", population: 10 },
        { assessmentId: a.id, code: "S2", name: "Manajemen menengah dan manajer proyek", group: "MANAGEMENT", population: 40 },
        { assessmentId: a.id, code: "S4", name: "Pelaksana dan pekerja sendiri", group: "FIELD", population: 300 },
      ],
    });
    const strata = await prisma.stratum.findMany({ where: { assessmentId: a.id }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, group: true, population: true, isContractor: true } });
    await prisma.assessment.update({ where: { id: a.id }, data: { parameterSnapshot: { schemaVersion: 1, parameters, samplePlan: null, strata, consent: { id: "Persetujuan.", en: "Consent." }, dpaSigned: true } as never } });
    return { assessment: a, strata };
  };
  const previousD = await dashboardAssessment("Asesmen Dasbor Gamma 2025", "2025-11-01");
  await prisma.scoreRun.create({
    data: { assessmentId: previousD.assessment.id, engineVersion: "1.0.0", inputSnapshot: { sources: {} }, parameterSnapshot: { engine: engineParams } as never, result: resultFrom(-0.3) as never, runById: users.leadAssessor.id, isFinal: true, finalResult: resultFrom(-0.3) as never, finalizedAt: new Date(), finalizedById: users.leadAssessor.id },
  });
  const currentD = await dashboardAssessment("Asesmen Dasbor Gamma 2026", "2026-11-01");
  const assessmentD = currentD.assessment;
  const [unitD1, unitD2] = [await unit(assessmentD.id, "Proyek Dasbor Utara"), await unit(assessmentD.id, "Proyek Dasbor Selatan")];
  const climateItems = await prisma.climateItem.findMany({ where: { dimension: { instrumentVersionId: version.id } }, select: { id: true } });
  const patterns = [[4, 4, 3], [5, 4, 4], [3, 3, 3], [2, 3, 2], [4, 5, 4]];
  let responseNo = 0;
  for (const [stratumCode, unitId, count, level] of [["S1", unitD1.id, 3, 4], ["S2", unitD1.id, 6, 3], ["S4", unitD1.id, 6, 3], ["S4", unitD2.id, 2, 5]] as const) {
    const stratumId = currentD.strata.find((x) => x.code === stratumCode)?.id as string;
    for (let i = 0; i < count; i++, responseNo++) {
      const pattern = patterns[responseNo % patterns.length] as number[];
      await prisma.surveyResponse.create({
        data: {
          assessmentId: assessmentD.id,
          unitId,
          stratumId,
          instrumentVersionId: version.id,
          language: "id",
          submittedOn: new Date("2026-11-20"),
          durationBucket: "FROM_10_TO_15",
          characteristicAnswers: { create: characteristics.map((c) => ({ characteristicId: c.id, level: c.code === "K1.3" ? 4 : level })) },
          climateAnswers: { create: climateItems.map((item, j) => ({ itemId: item.id, value: pattern[j % 3] as number })) },
        },
      });
    }
  }
  const sourcesD = Object.fromEntries(characteristics.map((c) => [c.code, { surveyAnswers: 17, dontKnow: 0 }]));
  await prisma.scoreRun.create({
    data: { assessmentId: assessmentD.id, engineVersion: "1.0.0", inputSnapshot: { sources: sourcesD }, parameterSnapshot: { engine: engineParams } as never, result: resultFrom(0) as never, runById: users.leadAssessor.id, isFinal: true, finalResult: resultFrom(0) as never, finalizedAt: new Date(), finalizedById: users.leadAssessor.id },
  });
  // Respons bertanda pada asesmen survei untuk panel mutu data (keluarkan dan pulihkan).
  const stratumS4 = await prisma.stratum.findFirstOrThrow({ where: { assessmentId: assessmentS.id, code: "S4" } });
  const flaggedResponses: string[] = [];
  for (const flags of [["POLA_SERAGAM"], ["TERLALU_CEPAT", "BANYAK_TIDAK_TAHU"]] as const) {
    const r = await prisma.surveyResponse.create({
      data: {
        assessmentId: assessmentS.id,
        unitId: unitS.id,
        stratumId: stratumS4.id,
        instrumentVersionId: version.id,
        language: "id",
        submittedOn: new Date("2026-10-20"),
        durationBucket: flags.length === 1 ? "FROM_10_TO_15" : "UNDER_5",
        qualityFlags: [...flags],
        characteristicAnswers: { create: characteristics.map((c, i) => ({ characteristicId: c.id, level: flags.length === 1 || i % 3 === 0 ? 3 : null })) },
        climateAnswers: { create: climateItems.map((item) => ({ itemId: item.id, value: 3 })) },
      },
    });
    flaggedResponses.push(r.id);
  }
  const leadDashboard = await user("leadDashboard", "asesor.utama.dasbor@e2e.test", operator.id, "LEAD_ASSESSOR", { totp: true });
  const executiveC = await user("executiveC", "eksekutif.gamma@e2e.test", orgC.id, "EXECUTIVE_VIEWER");
  const coordinatorDashboard = await user("coordinatorDashboard", "koordinator.dasbor@e2e.test", orgC.id, "UNIT_COORDINATOR", { unitScope: [unitD2.id] });
  Object.assign(users, { leadDashboard, executiveC, coordinatorDashboard });
  await prisma.assessmentAssignment.createMany({
    data: [
      { assessmentId: assessmentD.id, userId: leadDashboard.id, role: "LEAD_ASSESSOR" },
      { assessmentId: assessmentS.id, userId: leadDashboard.id, role: "LEAD_ASSESSOR" },
    ],
  });

  // Fase 12: asesmen berstatus penyusunan rencana aksi dengan hasil final, untuk daftar kesenjangan dan tindakan.
  const planG = await dashboardAssessment("Asesmen Rencana Aksi Gamma 2026", "2026-11-01");
  const assessmentG = planG.assessment;
  const [unitG1] = [await unit(assessmentG.id, "Proyek Rencana Utara"), await unit(assessmentG.id, "Proyek Rencana Selatan")];
  await prisma.scoreRun.create({
    data: { assessmentId: assessmentG.id, engineVersion: "1.0.0", inputSnapshot: { sources: sourcesD }, parameterSnapshot: { engine: engineParams } as never, result: resultFrom(0) as never, runById: users.leadAssessor.id, isFinal: true, finalResult: resultFrom(0) as never, finalizedAt: new Date(), finalizedById: users.leadAssessor.id },
  });
  const leadPlan = await user("leadPlan", "asesor.utama.rencana@e2e.test", operator.id, "LEAD_ASSESSOR", { totp: true });
  const coordinatorPlan = await user("coordinatorPlan", "koordinator.rencana@e2e.test", orgC.id, "UNIT_COORDINATOR", { unitScope: [unitG1.id] });
  Object.assign(users, { leadPlan, coordinatorPlan });
  await prisma.assessmentAssignment.create({ data: { assessmentId: assessmentG.id, userId: leadPlan.id, role: "LEAD_ASSESSOR" } });

  const fixtures = {
    password: E2E_PASSWORD,
    organizations: { a: orgA.id, b: orgB.id, operator: operator.id },
    assessments: { a: assessmentA.id, b: assessmentB.id, c: assessmentC.id, survey: assessmentS.id, panel: assessmentP.id, dashboard: assessmentD.id, plan: assessmentG.id },
    flaggedResponses,
    surveyTokens,
    observationWindows: { open: observationOpen.id, closed: observationClosed.id, site },
    units: { a1: unitA1.id, a2: unitA2.id, b1: unitB1.id, c1: unitC1.id, c2: unitC2.id },
    users,
    totpSecrets: secrets,
  };
  writeFileSync(join(__dirname, ".fixtures.json"), JSON.stringify(fixtures, null, 2));
  await prisma.$disconnect();
  console.info(`E2E database ${name} siap.`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
