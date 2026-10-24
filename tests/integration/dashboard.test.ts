// Dasbor dan ekspor (docs/01 M9, CLAUDE.md aturan 3) terhadap PostgreSQL: tidak ada titik data yang berasal dari
// kurang dari 5 respons, baik di model dasbor maupun di berkas Excel.

import { randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import seedParameters from "../../seed/aspek-dan-parameter.json";
import simulation from "../../seed/fixtures/skoring-simulasi.json";
import messages from "../../messages/id.json";

process.env.DATABASE_URL = inject("databaseUrl");
process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

const dashboard = await import("@/lib/dashboard/service");
const { buildDashboardWorkbook } = await import("@/lib/dashboard/export");
const { runEngine, toEngineParameters } = await import("@/lib/scoring");
const { allVisibleMeetMinimum } = await import("@/lib/privacy/suppression");
const { getDb } = await import("@/lib/db");

const db = getDb();
const meta = { ipHash: null, userAgent: "vitest" };
const suffix = randomBytes(4).toString("hex");
const params = toEngineParameters(seedParameters);
const parameters = Object.fromEntries(Object.entries(seedParameters).filter(([k]) => !k.startsWith("_")));
const engineResult = runEngine({ characteristics: simulation.input.characteristics.map((c) => ({ ...c, perception: c.p, evidence: c.e, validation: c.v })), targetLevel: 4 }, params);

let assessmentId: string;
let organizationId: string;
let leadId: string;
let unitNorth: string;
let unitSouth: string;
const responseIds: string[] = [];

type Model = Awaited<ReturnType<typeof dashboard.loadDashboard>>;
const assessor = { roles: ["LEAD_ASSESSOR" as const], unitScope: null };

async function createAssessment(name: string, periodStart: string, versionId: string, status: "SCORING" | "ACTION_PLANNING", strata: unknown[]) {
  return db.assessment.create({
    data: {
      organizationId,
      name,
      scopeType: "CORPORATE",
      periodStart: new Date(periodStart),
      periodEnd: new Date(new Date(periodStart).getTime() + 90 * 86_400_000),
      targetLevel: 4,
      instrumentVersionId: versionId,
      status,
      parameterSnapshot: { schemaVersion: 1, parameters, strata, consent: { id: "x", en: "x" }, dpaSigned: true } as never,
    },
  });
}

async function finalRun(id: string, result: unknown, isFinal: boolean, sources: Record<string, unknown> = {}) {
  return db.scoreRun.create({
    data: {
      assessmentId: id,
      engineVersion: "1.0.0",
      inputSnapshot: { sources } as never,
      parameterSnapshot: {},
      result: result as never,
      runById: leadId,
      ...(isFinal ? { isFinal: true, finalResult: result as never, finalizedAt: new Date(), finalizedById: leadId } : {}),
    },
  });
}

beforeAll(async () => {
  const org = await db.organization.create({ data: { name: `PT Uji Dasbor ${suffix}`, legalName: `PT Uji Dasbor ${suffix}` } });
  organizationId = org.id;
  leadId = (await db.user.create({ data: { email: `la-m9-${suffix}@contoh.test`, name: "Asesor Utama", passwordHash: "x" } })).id;
  const version = await db.instrumentVersion.create({ data: { code: `TEST-M9-${suffix}`, status: "PUBLISHED", defaultParameters: {} } });
  const aspectIds = new Map<string, string>();
  for (const a of seedParameters.aspects as { code: string; name: string; maxPoints: Record<string, number> | null; excludedFromLevel?: boolean }[]) {
    aspectIds.set(a.code, (await db.aspect.create({ data: { instrumentVersionId: version.id, code: a.code, name: a.name, maxPointsStep5: a.maxPoints?.["5"] ?? null, excludedFromLevel: a.excludedFromLevel ?? false } })).id);
  }
  const charIds = new Map<string, string>();
  for (const [i, c] of simulation.input.characteristics.entries()) {
    charIds.set(c.code, (await db.characteristic.create({ data: { instrumentVersionId: version.id, aspectId: aspectIds.get(c.aspectCode) as string, code: c.code, nameId: `Karakteristik ${c.code}`, isContextual: c.isContextual, order: i + 1 } })).id);
  }
  const dimension = await db.climateDimension.create({ data: { instrumentVersionId: version.id, code: "D1", nameId: "Komitmen", order: 1 } });
  const items = [];
  for (const [i, reverse] of [false, false, true].entries()) items.push(await db.climateItem.create({ data: { dimensionId: dimension.id, code: `D1.${i + 1}`, textId: `Butir ${i + 1}`, reverseCoded: reverse, order: i + 1 } }));

  // Periode sebelumnya dengan hasil final, untuk pembandingan antarperiode.
  const previous = await createAssessment("Asesmen 2025", "2025-11-01", version.id, "ACTION_PLANNING", []);
  const previousResult = runEngine({ characteristics: simulation.input.characteristics.map((c) => ({ ...c, perception: c.p - 0.3, evidence: c.e - 0.2, validation: c.v - 0.2 })), targetLevel: 4 }, params);
  await finalRun(previous.id, previousResult, true);

  const current = await createAssessment("Asesmen 2026", "2026-11-01", version.id, "SCORING", []);
  assessmentId = current.id;
  unitNorth = (await db.unit.create({ data: { assessmentId, name: "Proyek Utara", type: "PROJECT" } })).id;
  unitSouth = (await db.unit.create({ data: { assessmentId, name: "Proyek Selatan", type: "PROJECT" } })).id;
  const strataInput = [
    { code: "S1", name: "Direksi", group: "MANAGEMENT" as const, population: 10 },
    { code: "S2", name: "Manajemen", group: "MANAGEMENT" as const, population: 40 },
    { code: "S4", name: "Pelaksana", group: "FIELD" as const, population: 300 },
  ];
  const strata = [];
  for (const s of strataInput) strata.push(await db.stratum.create({ data: { ...s, assessmentId } }));
  await db.assessment.update({ where: { id: assessmentId }, data: { parameterSnapshot: { schemaVersion: 1, parameters, strata, consent: { id: "x", en: "x" }, dpaSigned: true } as never } });

  // S1: 3 responden; S2: 6; S4: 6 di Proyek Utara dan 2 di Proyek Selatan.
  const plan: [string, string, number, number][] = [
    [strata[0]!.id, unitNorth, 3, 4],
    [strata[1]!.id, unitNorth, 6, 3],
    [strata[2]!.id, unitNorth, 6, 2],
    [strata[2]!.id, unitSouth, 2, 5],
  ];
  let k = 0;
  for (const [stratumId, unitId, count, level] of plan) {
    for (let i = 0; i < count; i++, k++) {
      const climate = [[4, 4, 2], [5, 5, 1], [3, 4, 3], [2, 2, 4], [4, 5, 2]][k % 5] as number[];
      const r = await db.surveyResponse.create({
        data: {
          assessmentId,
          unitId,
          stratumId,
          instrumentVersionId: version.id,
          language: "id",
          submittedOn: new Date("2026-11-15"),
          durationBucket: "FROM_10_TO_15",
          qualityFlags: k === 0 ? ["POLA_SERAGAM"] : [],
          characteristicAnswers: { create: simulation.input.characteristics.map((c) => ({ characteristicId: charIds.get(c.code) as string, level })) },
          climateAnswers: { create: items.map((item, j) => ({ itemId: item.id, value: climate[j] as number })) },
        },
      });
      responseIds.push(r.id);
    }
  }
  // K1.3 terkena aturan selisih persepsi dan bukti. Snapshot eksekusi mencatat hanya 4 jawaban survei K1.3
  // (misalnya karena banyak "Tidak tahu"), sehingga persepsinya disembunyikan pada daftar.
  await finalRun(assessmentId, engineResult, false, { "K1.3": { surveyAnswers: 4 }, "K1.1": { surveyAnswers: 17 } });
});

afterAll(async () => {
  await db.$disconnect();
});

function heatmapCells(model: Model) {
  if (!model.available || !model.heatmaps) return [];
  return [model.heatmaps.strata, model.heatmaps.units].flatMap((h) => h?.rows.flatMap((r) => r.cells) ?? []);
}

describe("model dasbor", () => {
  it("peta warna menyembunyikan sel di bawah 5 responden dan sel pelengkapnya", async () => {
    const model = await dashboard.loadDashboard(assessmentId, assessor);
    expect(model.available).toBe(true);
    if (!model.available || !model.heatmaps?.strata) return;
    expect(model.run.isFinal).toBe(false);
    for (const row of model.heatmaps.strata.rows) expect(row.cells.map((c) => c.state)).toEqual(["suppressed", "secondary", "visible"]);
    const units = model.heatmaps.units;
    expect(units.columns.map((c) => c.label)).toEqual(["Proyek Selatan", "Proyek Utara"]);
    for (const row of units.rows) expect(row.cells.map((c) => [c.state, c.n])).toEqual([["suppressed", null], ["visible", 15]]);
    expect(allVisibleMeetMinimum(heatmapCells(model), 5)).toBe(true);

    // Kelompok manajemen 9 responden dan lapangan 8: kesenjangan ditampilkan.
    expect(model.perceptionGap?.every((g) => !g.suppressed)).toBe(true);
    // Persepsi K1.3 dari 4 jawaban disembunyikan pada daftar selisih persepsi dan bukti.
    expect(model.divergence?.find((d) => d.code === "K1.3")).toMatchObject({ perception: null, perceptionHidden: true, divergence: null });
    expect(model.summary.index).toBeCloseTo(3.143463, 6);
    expect(model.comparison?.previous).toHaveLength(1);
  });

  it("kesenjangan persepsi disembunyikan bila satu kelompok di bawah 5 responden", async () => {
    // Mengeluarkan 4 respons lapangan Proyek Utara menyisakan 4 respons lapangan.
    const field = await db.surveyResponse.findMany({ where: { assessmentId, unitId: unitNorth, stratum: { code: "S4" } }, select: { id: true }, take: 4 });
    await db.surveyResponse.updateMany({ where: { id: { in: field.map((f) => f.id) } }, data: { excluded: true, excludedReason: "uji" } });
    const model = await dashboard.loadDashboard(assessmentId, assessor);
    if (!model.available) throw new Error("tidak tersedia");
    expect(model.perceptionGap?.every((g) => g.suppressed && g.management === null && g.gap === null)).toBe(true);
    expect(allVisibleMeetMinimum(heatmapCells(model), 5)).toBe(true);
    await db.surveyResponse.updateMany({ where: { id: { in: field.map((f) => f.id) } }, data: { excluded: false, excludedReason: null } });
  });

  it("pimpinan eksekutif dan koordinator unit hanya setelah final; eksekutif tanpa peta warna, koordinator hanya unitnya", async () => {
    expect(await dashboard.loadDashboard(assessmentId, { roles: ["EXECUTIVE_VIEWER"], unitScope: null })).toEqual({ available: false, reason: "NOT_FINAL" });
    expect(await dashboard.loadDashboard(assessmentId, { roles: ["UNIT_COORDINATOR"], unitScope: [unitNorth] })).toEqual({ available: false, reason: "NOT_FINAL" });
    const client = await dashboard.loadDashboard(assessmentId, { roles: ["CLIENT_ADMIN"], unitScope: null });
    expect(client.available && client.run.isFinal).toBe(false);

    await finalRun(assessmentId, engineResult, true, { "K1.3": { surveyAnswers: 4 } });
    const executive = await dashboard.loadDashboard(assessmentId, { roles: ["EXECUTIVE_VIEWER"], unitScope: null });
    if (!executive.available) throw new Error("tidak tersedia");
    expect(executive).toMatchObject({ audience: "executive", heatmaps: null, divergence: null, perceptionGap: null });
    expect(executive.comparison?.previous[0]?.name).toBe("Asesmen 2025");

    const unit = await dashboard.loadDashboard(assessmentId, { roles: ["UNIT_COORDINATOR"], unitScope: [unitSouth] });
    if (!unit.available) throw new Error("tidak tersedia");
    expect(unit.heatmaps?.strata).toBeNull();
    expect(unit.heatmaps?.units.columns.map((c) => c.label)).toEqual(["Proyek Selatan"]);
    // Unit koordinator hanya memiliki 2 respons: seluruh selnya disembunyikan.
    expect(unit.heatmaps?.units.rows.every((r) => r.cells.every((c) => c.state === "suppressed" && c.value === null && c.n === null))).toBe(true);
  });
});

describe("ekspor Excel", () => {
  it("tidak memuat nilai atau jumlah responden dari sel di bawah 5 respons", async () => {
    const model = await dashboard.loadDashboard(assessmentId, assessor);
    if (!model.available) throw new Error("tidak tersedia");
    const labels = messages.dashboard.exportLabels;
    const bytes = await buildDashboardWorkbook(model, labels, { assessmentName: "Asesmen 2026", organizationName: "PT Uji" });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(bytes) as never);
    expect(workbook.worksheets.map((w) => w.name)).toEqual(Object.values(labels.sheets));

    let visible = 0;
    let hiddenRows = 0;
    for (const name of [labels.sheets.strata, labels.sheets.units]) {
      workbook.getWorksheet(name)?.eachRow((row, i) => {
        if (i === 1) return;
        const [value, n, note] = [row.getCell(3).value, row.getCell(4).value, row.getCell(5).value];
        if (note === labels.hidden || note === labels.secondary) {
          hiddenRows += 1;
          expect(value).toBeNull();
          expect(n).toBeNull();
        } else {
          visible += 1;
          expect(typeof value).toBe("number");
          expect(n as number).toBeGreaterThanOrEqual(5);
        }
      });
    }
    // 6 aspek x (2 strata tersembunyi + 1 unit tersembunyi) dan 6 aspek x (1 strata + 1 unit) yang tampil.
    expect(hiddenRows).toBe(18);
    expect(visible).toBe(12);
    const divergence = workbook.getWorksheet(labels.sheets.divergence);
    const k13 = divergence?.getRows(2, divergence.rowCount - 1)?.find((r) => r.getCell(1).value === "K1.3");
    expect(k13?.getCell(3).value).toBeNull();
    expect(k13?.getCell(6).value).toBe(labels.hidden);
  });
});

describe("panel mutu data", () => {
  it("alfa Cronbach dan rwg per unit; unit di bawah 5 responden disembunyikan", async () => {
    const q = await dashboard.loadQuality(assessmentId, { includeResponses: true });
    if (!q) throw new Error("tidak tersedia");
    expect(q.alpha[0]?.alpha.n).toBe(17);
    expect(q.alpha[0]?.alpha.value).toBeGreaterThan(0.7);
    expect(q.rwg.map((u) => [u.name, u.n])).toEqual([
      ["Proyek Selatan", null],
      ["Proyek Utara", 15],
    ]);
    expect(q.rwg[0]?.perDimension.every((c) => c.value === null)).toBe(true);
    expect(q.flagged.map((f) => f.flags)).toEqual([["POLA_SERAGAM"]]);
    // Tidak ada jumlah responden di bawah 5 yang tampil, termasuk ketika nilainya tidak terhitung.
    const counts = [...q.alpha.map((a) => a.alpha.n), ...q.rwg.flatMap((u) => [u.n, ...u.perDimension.map((c) => c.n)])];
    expect(counts.every((n) => n === null || n >= 5)).toBe(true);
  });

  it("respons bertanda dikeluarkan dan dipulihkan dengan alasan, tercatat di jejak audit; ditutup setelah rapat panel", async () => {
    const actor = { session: { user: { id: leadId } } as never, assessmentId, organizationId, roles: ["LEAD_ASSESSOR" as const] };
    const id = responseIds[0] as string;
    await dashboard.setResponseExclusion(actor, id, { excluded: true, reason: "Pola jawaban seragam pada seluruh butir." }, meta);
    await expect(dashboard.setResponseExclusion(actor, id, { excluded: true, reason: "Diulang tanpa perubahan." }, meta)).rejects.toMatchObject({ code: "NO_CHANGE" });
    expect(await db.surveyResponse.findUniqueOrThrow({ where: { id }, select: { excluded: true, excludedReason: true, excludedById: true } })).toEqual({ excluded: true, excludedReason: "Pola jawaban seragam pada seluruh butir.", excludedById: leadId });
    await dashboard.setResponseExclusion(actor, id, { excluded: false, reason: "Ditinjau ulang, pola masih wajar." }, meta);
    expect(await db.auditLog.count({ where: { entityId: id, action: { in: ["survey.exclude", "survey.restore"] } } })).toBe(2);

    await db.assessment.update({ where: { id: assessmentId }, data: { status: "PANEL_REVIEW" } });
    await expect(dashboard.setResponseExclusion(actor, id, { excluded: true, reason: "Setelah rapat panel dimulai." }, meta)).rejects.toMatchObject({ code: "EXCLUSION_CLOSED" });
  });
});
