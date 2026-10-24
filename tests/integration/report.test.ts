// Pelaporan (docs/01 M11 dan bagian 6) terhadap PostgreSQL, pg-boss, MinIO, dan Chromium headless.

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import seedParameters from "../../seed/aspek-dan-parameter.json";
import simulation from "../../seed/fixtures/skoring-simulasi.json";
import messages from "../../messages/id.json";

process.env.DATABASE_URL = inject("databaseUrl");
process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");
// Chromium untuk PDF: sama dengan peramban tes e2e bila ditetapkan.
if (!process.env.PDF_CHROMIUM_EXECUTABLE && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) process.env.PDF_CHROMIUM_EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

const reports = await import("@/lib/report/service");
const { renderReportHtml } = await import("@/lib/report/html");
const { renderReport, chromiumPdf } = await import("@/lib/jobs/report-render");
const plan = await import("@/lib/action-plan/service");
const { runEngine, toEngineParameters } = await import("@/lib/scoring");
const { putObject } = await import("@/lib/storage");
const { stopBoss } = await import("@/lib/jobs/boss");
const { getDb } = await import("@/lib/db");

const db = getDb();
const meta = { ipHash: null, userAgent: "vitest" };
const suffix = randomBytes(4).toString("hex");
const params = toEngineParameters(seedParameters);
const parameters = Object.fromEntries(Object.entries(seedParameters).filter(([k]) => !k.startsWith("_")));
const result = runEngine({ characteristics: simulation.input.characteristics.map((c) => ({ ...c, perception: c.p, evidence: c.e, validation: c.v })), targetLevel: 4 }, params);
const STANDING = messages.common.resultDisclaimer;

type Actor = Parameters<typeof reports.createReportVersion>[0];
let assessmentId: string;
let lead: Actor;
const sig = { status: "DRAFT" as const, signerName: null, signerPosition: null, signedAt: null };
const assets = { logoSrc: "/brand/logo-long-color.png", fontSrc: null };

beforeAll(async () => {
  const org = await db.organization.create({ data: { name: `PT Uji Laporan ${suffix}`, legalName: `PT Uji Laporan Konstruksi ${suffix}`, sector: "Konstruksi" } });
  const leadUser = await db.user.create({ data: { email: `la-m11-${suffix}@contoh.test`, name: "Ir. Asesor Utama", passwordHash: "x" } });
  const version = await db.instrumentVersion.create({ data: { code: `TEST-M11-${suffix}`, status: "PUBLISHED", defaultParameters: {} } });
  const aspectIds = new Map<string, string>();
  for (const a of seedParameters.aspects as { code: string; name: string; maxPoints: Record<string, number> | null; excludedFromLevel?: boolean }[]) {
    aspectIds.set(a.code, (await db.aspect.create({ data: { instrumentVersionId: version.id, code: a.code, name: a.name, maxPointsStep5: a.maxPoints?.["5"] ?? null, excludedFromLevel: a.excludedFromLevel ?? false } })).id);
  }
  const charIds = new Map<string, string>();
  for (const [i, c] of simulation.input.characteristics.entries()) {
    charIds.set(c.code, (await db.characteristic.create({ data: { instrumentVersionId: version.id, aspectId: aspectIds.get(c.aspectCode) as string, code: c.code, nameId: `Karakteristik ${c.code}`, isContextual: c.isContextual, order: i + 1 } })).id);
  }
  const assessment = await db.assessment.create({
    data: { organizationId: org.id, name: "Asesmen Budaya K3 Uji 2026", scopeType: "CORPORATE", periodStart: new Date("2026-11-01"), periodEnd: new Date("2027-01-31"), targetLevel: 4, instrumentVersionId: version.id, status: "ACTION_PLANNING", lockedAt: new Date("2026-10-20T03:00:00Z") },
  });
  assessmentId = assessment.id;
  const unit = await db.unit.create({ data: { assessmentId, name: "Proyek Gedung Uji", type: "PROJECT" } });
  const strata = [];
  for (const s of [
    { code: "S2", name: "Manajemen", group: "MANAGEMENT" as const, population: 30 },
    { code: "S4", name: "Pelaksana", group: "FIELD" as const, population: 300 },
  ])
    strata.push(await db.stratum.create({ data: { ...s, assessmentId } }));
  await db.assessment.update({ where: { id: assessmentId }, data: { parameterSnapshot: { schemaVersion: 1, parameters, samplePlan: null, strata, consent: { id: "x", en: "x" }, dpaSigned: true } as never } });
  // S2 hanya 3 responden: selnya disembunyikan di laporan.
  for (const [stratumId, count] of [[strata[0]!.id, 3], [strata[1]!.id, 8]] as const) {
    for (let i = 0; i < count; i++) {
      await db.surveyResponse.create({
        data: {
          assessmentId,
          unitId: unit.id,
          stratumId,
          instrumentVersionId: version.id,
          language: "id",
          submittedOn: new Date("2026-11-20"),
          durationBucket: "FROM_10_TO_15",
          characteristicAnswers: { create: simulation.input.characteristics.map((c) => ({ characteristicId: charIds.get(c.code) as string, level: 3 })) },
        },
      });
    }
  }
  const session = await db.validationSession.create({ data: { assessmentId, type: "FOCUS_GROUP", label: "Diskusi kelompok S4 nomor 1", status: "COMPLETED", scheduledAt: new Date("2026-12-02T02:00:00Z") } });
  await db.validationParticipant.createMany({ data: [{ sessionId: session.id, fullName: "Budi Santoso", position: "Mandor" }, { sessionId: session.id, fullName: "Siti Aminah", position: "Pelaksana" }] });
  const evidence = await db.evidenceItem.create({
    data: { assessmentId, unitId: unit.id, title: "Risalah rapat K3 bulanan", storageKey: `${org.id}/${assessmentId}/evidence/${suffix}.pdf`, sha256: "a".repeat(64), mimeType: "application/pdf", sizeBytes: 1000, uploadedById: leadUser.id },
  });
  await db.evidenceLink.create({ data: { evidenceItemId: evidence.id, characteristicId: charIds.get("K1.1") as string } });
  const sources = Object.fromEntries(simulation.input.characteristics.map((c) => [c.code, { surveyAnswers: c.code === "K2.1" ? 3 : 11, dontKnow: 0, evidenceAssessors: 2, validationSessions: 1 }]));
  await db.scoreRun.create({
    data: {
      assessmentId,
      engineVersion: "1.0.0",
      inputSnapshot: { engineInput: {}, sources, counts: { responses: 11, selfAssessments: 0, evidenceRatings: 36, validationRatings: 18 }, strata: [], sclComplete: false } as never,
      parameterSnapshot: { engine: params } as never,
      result: result as never,
      runById: leadUser.id,
      isFinal: true,
      finalResult: result as never,
      finalizedAt: new Date("2027-02-05T03:00:00Z"),
      finalizedById: leadUser.id,
    },
  });
  lead = { assessmentId, organizationId: org.id, session: { user: { id: leadUser.id } } as never, roles: ["LEAD_ASSESSOR"] };
  await plan.generateGapList({ ...lead, unitScope: null }, meta);
});

afterAll(async () => {
  await stopBoss();
  await db.$disconnect();
});

describe("versi laporan", () => {
  let reportIds: string[];

  it("satu versi berisi tiga dokumen dengan snapshot yang sama dan mengantre report.render", async () => {
    expect(await reports.createReportVersion(lead, meta)).toBe(1);
    const rows = await db.report.findMany({ where: { assessmentId }, orderBy: { kind: "asc" } });
    expect(rows.map((r) => [r.kind, r.version, r.status, r.pdfStatus])).toEqual([
      ["FULL", 1, "DRAFT", "PENDING"],
      ["EXECUTIVE_SUMMARY", 1, "DRAFT", "PENDING"],
      ["STATEMENT", 1, "DRAFT", "PENDING"],
    ]);
    reportIds = rows.map((r) => r.id);
    const jobs = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM pgboss.job WHERE name = 'report.render' AND data->>'reportId' = ANY(${reportIds})`;
    expect(Number(jobs[0]?.n)).toBe(3);
    expect(await db.auditLog.count({ where: { assessmentId, action: "report.create" } })).toBe(1);
  });

  it("isi mengikuti struktur docs/01 bagian 6 dan pernyataan kedudukan hasil tampil di ketiga dokumen", async () => {
    const full = await db.report.findFirstOrThrow({ where: { assessmentId, kind: "FULL" } });
    const content = full.content as never;
    for (const kind of ["FULL", "EXECUTIVE_SUMMARY", "STATEMENT"] as const) {
      const html = renderReportHtml(content, kind, sig, assets);
      expect(html).toContain(STANDING);
      expect(html).toContain("3,14");
      expect(html).not.toContain("<script");
    }
    const html = renderReportHtml(content, "FULL", sig, assets);
    for (const title of Object.values(messages.reportDoc.sections)) expect(html).toContain(title);
    // Lampiran: narasumber, bukti, parameter terkunci.
    expect(html).toContain("Budi Santoso, Mandor");
    expect(html).toContain("Risalah rapat K3 bulanan");
    expect(html).toContain("layerWeights.perception");
    // Persepsi K2.1 dari 3 jawaban dan sel strata S2 (3 responden) disembunyikan.
    const c = full.content as { result: { characteristics: { code: string; perception: number | null; perceptionHidden: boolean }[] }; strataHeatmap: { rows: { cells: { state: string; n: number | null }[] }[] } };
    expect(c.result.characteristics.find((x) => x.code === "K2.1")).toMatchObject({ perception: null, perceptionHidden: true });
    const cells = c.strataHeatmap.rows.flatMap((r) => r.cells);
    expect(cells.every((cell) => cell.n === null || cell.n >= 5)).toBe(true);
    expect(cells.some((cell) => cell.state === "suppressed")).toBe(true);
    expect(html).not.toContain("3 responden");
  });

  it("PDF dirender Chromium dan disimpan ke penyimpanan objek", async () => {
    expect(await renderReport({ reportId: reportIds[0] as string })).toBe("RENDERED");
    const r = await db.report.findUniqueOrThrow({ where: { id: reportIds[0] } });
    expect(r).toMatchObject({ pdfStatus: "READY" });
    expect(r.storageKey).toMatch(/reports\/laporan-asesmen-v1-draft-.+\.pdf$/);
    const pdf = await chromiumPdf(renderReportHtml(r.content as never, "STATEMENT", sig, assets), "<span></span>");
    expect(Buffer.from(pdf.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
  }, 60_000);

  it("finalisasi menandatangani ketiga dokumen, merender ulang, lalu terkunci", async () => {
    await reports.finalizeReportVersion(lead, 1, "Lead Assessor Nusa Safety", meta);
    const rows = await db.report.findMany({ where: { assessmentId, version: 1 } });
    for (const r of rows) expect(r).toMatchObject({ status: "FINAL", signerName: "Ir. Asesor Utama", signerPosition: "Lead Assessor Nusa Safety", pdfStatus: "PENDING", storageKey: null });
    const statement = rows.find((r) => r.kind === "STATEMENT")!;
    const html = renderReportHtml(statement.content as never, "STATEMENT", { status: "FINAL", signerName: statement.signerName, signerPosition: statement.signerPosition, signedAt: statement.signedAt!.toISOString() }, assets);
    expect(html).toContain("Ir. Asesor Utama, Lead Assessor Nusa Safety");
    expect(html).toContain("Versi final ini terkunci");

    const puts: string[] = [];
    expect(await renderReport({ reportId: statement.id }, { toPdf: async () => new Uint8Array([37, 80, 68, 70]), put: async (key) => void puts.push(key) })).toBe("RENDERED");
    expect(puts[0]).toContain("pernyataan-hasil-v1-final");

    await expect(reports.finalizeReportVersion(lead, 1, "Jabatan lain", meta)).rejects.toMatchObject({ code: "REPORT_FINAL" });
    await expect(db.report.update({ where: { id: statement.id }, data: { content: {} } })).rejects.toThrow(/immutable/);
    await expect(db.report.update({ where: { id: statement.id }, data: { signerPosition: "Diubah" } })).rejects.toThrow(/signature and status cannot change/);
    await expect(db.report.delete({ where: { id: statement.id } })).rejects.toThrow(/Report is final/);
    expect(await db.auditLog.count({ where: { assessmentId, action: "report.finalize" } })).toBe(1);
  });

  it("render draf yang selesai setelah finalisasi tidak menimpa PDF final", async () => {
    expect(await reports.createReportVersion(lead, meta)).toBe(2);
    const draft = await db.report.findFirstOrThrow({ where: { assessmentId, version: 2, kind: "FULL" } });
    const outcome = await renderReport(
      { reportId: draft.id },
      {
        toPdf: async () => {
          // Lead assessor memfinalisasi versi 2 saat render draf masih berjalan.
          await reports.finalizeReportVersion(lead, 2, "Lead Assessor Nusa Safety", meta);
          return new Uint8Array([37, 80, 68, 70]);
        },
        put: (key, body, type) => putObject(key, body, type),
      },
    );
    expect(outcome).toBe("SKIPPED");
    expect(await db.report.findUniqueOrThrow({ where: { id: draft.id } })).toMatchObject({ status: "FINAL", storageKey: null, pdfStatus: "PENDING" });
  });
});
