// Penilaian asesor dan rapat panel (docs/01 M8) terhadap PostgreSQL. Data asesmen demo disusun agar masukan
// mesinnya sama dengan seed/fixtures/skoring-simulasi.json: persepsi berbobot populasi strata dari jawaban survei,
// bukti dari lima asesor, validasi dari dua sesi, dan jalur setara dari persentase pemenuhan.

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import seedParameters from "../../seed/aspek-dan-parameter.json";
import simulation from "../../seed/fixtures/skoring-simulasi.json";

process.env.DATABASE_URL = inject("databaseUrl");
process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

const scoring = await import("@/lib/assessor-scoring/service");
const { evidenceRatingSchema, panelAdjustmentSchema, sclAspectSchema } = await import("@/lib/assessor-scoring/rules");
const { getDb } = await import("@/lib/db");

const db = getDb();
const meta = { ipHash: null, userAgent: "vitest" };
const suffix = randomBytes(4).toString("hex");
const TOL = 6; // toBeCloseTo(x, 6): selisih kurang dari 5e-7, di dalam toleransi 1e-6

type Actor = Parameters<typeof scoring.runScoring>[0];
let assessmentId: string;
let lead: Actor;
let assessors: Actor[];
let outsider: Actor;
const charId = new Map<string, string>();

/** n bilangan dengan langkah `step` yang rata-ratanya tepat `mean` dan selisih terbesar-terkecilnya satu langkah. */
function spread(mean: number, n: number, step: number): number[] {
  const units = Math.round((mean * n) / step);
  expect(Math.abs((units * step) / n - mean)).toBeLessThan(1e-9);
  const base = Math.floor(units / n);
  return Array.from({ length: n }, (_, i) => (base + (i < units % n ? 1 : 0)) * step);
}

beforeAll(async () => {
  const org = await db.organization.create({ data: { name: `PT Uji M8 ${suffix}`, legalName: `PT Uji M8 ${suffix}` } });
  const users = [];
  for (const p of ["la", "a1", "a2", "a3", "a4", "a5"]) {
    users.push(await db.user.create({ data: { email: `${p}-m8-${suffix}@contoh.test`, name: `Asesor ${p.toUpperCase()}`, passwordHash: "x" } }));
  }
  const version = await db.instrumentVersion.create({ data: { code: `TEST-M8-${suffix}`, status: "PUBLISHED", defaultParameters: {} } });
  const aspectIds = new Map<string, string>();
  for (const a of seedParameters.aspects as { code: string; name: string; maxPoints: Record<string, number> | null; excludedFromLevel?: boolean }[]) {
    const created = await db.aspect.create({
      data: { instrumentVersionId: version.id, code: a.code, name: a.name, maxPointsStep5: a.maxPoints?.["5"] ?? null, excludedFromLevel: a.excludedFromLevel ?? false },
    });
    aspectIds.set(a.code, created.id);
  }
  for (const [i, c] of simulation.input.characteristics.entries()) {
    const created = await db.characteristic.create({
      data: { instrumentVersionId: version.id, aspectId: aspectIds.get(c.aspectCode) as string, code: c.code, nameId: `Karakteristik ${c.code}`, isContextual: c.isContextual, order: i + 1 },
    });
    charId.set(c.code, created.id);
    await db.levelStatement.createMany({ data: [1, 2, 3, 4, 5].map((level) => ({ characteristicId: created.id, level, textId: `Pernyataan tingkat ${level} ${c.code}` })) });
  }

  const parameters = Object.fromEntries(Object.entries(seedParameters).filter(([k]) => !k.startsWith("_")));
  const assessment = await db.assessment.create({
    data: {
      organizationId: org.id,
      name: "Asesmen Uji M8",
      scopeType: "CORPORATE",
      periodStart: new Date("2026-11-01"),
      periodEnd: new Date("2027-01-31"),
      targetLevel: simulation.parameters.targetLevel,
      instrumentVersionId: version.id,
      status: "DATA_COLLECTION",
    },
  });
  assessmentId = assessment.id;
  const unit = await db.unit.create({ data: { assessmentId, name: "Proyek Uji", type: "PROJECT" } });
  // S4 dan S5 berbobot 200 dan 300 (0,4 dan 0,6). S1 hanya menjawab "Tidak tahu", sehingga tidak ikut dibobot.
  const strataInput = [
    { code: "S1", name: "Direksi", group: "MANAGEMENT" as const, population: 10 },
    { code: "S4", name: "Pelaksana", group: "FIELD" as const, population: 200 },
    { code: "S5", name: "Penyedia jasa", group: "FIELD" as const, population: 300 },
  ];
  const strata = [];
  for (const s of strataInput) strata.push(await db.stratum.create({ data: { ...s, assessmentId } }));
  await db.assessment.update({
    where: { id: assessmentId },
    data: { parameterSnapshot: { schemaVersion: 1, parameters, strata, consent: { id: "Persetujuan", en: "Consent" }, dpaSigned: true } as never },
  });

  const [s1, s4, s5] = strata;
  const response = async (stratumId: string, answers: Record<string, number | null>, excluded = false) =>
    db.surveyResponse.create({
      data: {
        assessmentId,
        unitId: unit.id,
        stratumId,
        instrumentVersionId: version.id,
        language: "id",
        submittedOn: new Date("2026-11-15"),
        durationBucket: "FROM_10_TO_15",
        excluded,
        characteristicAnswers: { create: Object.entries(answers).map(([code, level]) => ({ characteristicId: charId.get(code) as string, level })) },
      },
    });
  // Rata-rata S4 = P - 0,6 dan S5 = P + 0,4, sehingga 0,4 x S4 + 0,6 x S5 = P.
  const chars = simulation.input.characteristics;
  const s4Answers = Object.fromEntries(chars.map((c) => [c.code, spread(c.p - 0.6, 5, 1)]));
  const s5Answers = Object.fromEntries(chars.map((c) => [c.code, spread(c.p + 0.4, 5, 1)]));
  for (let i = 0; i < 5; i++) {
    await response(s4!.id, Object.fromEntries(chars.map((c) => [c.code, s4Answers[c.code]![i]!])));
    await response(s5!.id, Object.fromEntries(chars.map((c) => [c.code, s5Answers[c.code]![i]!])));
  }
  // Satu respons S5 menjawab "Tidak tahu" untuk semua karakteristik: tidak memengaruhi rata-rata.
  await response(s5!.id, Object.fromEntries(chars.map((c) => [c.code, null])));
  await response(s1!.id, Object.fromEntries(chars.map((c) => [c.code, null])));
  // Respons yang dikeluarkan asesor tidak ikut dihitung.
  await response(s4!.id, Object.fromEntries(chars.map((c) => [c.code, 1])), true);

  // Penilaian mandiri yang masih draf tidak ikut dihitung.
  const token = await db.accessToken.create({ data: { assessmentId, unitId: unit.id, kind: "SELF_ASSESSMENT", channel: "LINK", tokenHash: randomBytes(32).toString("hex") } });
  await db.selfAssessment.create({
    data: {
      assessmentId,
      accessTokenId: token.id,
      respondentName: "Direktur Uji",
      respondentPosition: "Direktur",
      answers: { create: chars.map((c) => ({ characteristicId: charId.get(c.code) as string, level: 5 })) },
    },
  });

  // Dua sesi validasi dengan lima asesor; sesi yang dibatalkan tidak ikut dihitung.
  const session = (status: "COMPLETED" | "CANCELLED", label: string) => db.validationSession.create({ data: { assessmentId, type: "FOCUS_GROUP", label, status } });
  const sessions = [await session("COMPLETED", "Diskusi 1"), await session("COMPLETED", "Diskusi 2"), await session("CANCELLED", "Diskusi batal")];
  for (const c of chars) {
    const v = spread(c.v, 5, 0.5);
    await db.validationRating.createMany({
      data: [
        ...users.slice(1).map((u, i) => ({ sessionId: sessions[0]!.id, characteristicId: charId.get(c.code) as string, assessorId: u.id, level: v[i]! })),
        ...users.slice(1).map((u, i) => ({ sessionId: sessions[1]!.id, characteristicId: charId.get(c.code) as string, assessorId: u.id, level: v[4 - i]! })),
        { sessionId: sessions[2]!.id, characteristicId: charId.get(c.code) as string, assessorId: users[1]!.id, level: 5 },
      ],
    });
  }

  const base = { assessmentId, organizationId: org.id };
  const actor = (u: { id: string }, role: "LEAD_ASSESSOR" | "ASSESSOR"): Actor => ({ ...base, session: { user: { id: u.id } } as never, roles: [role] });
  lead = actor(users[0]!, "LEAD_ASSESSOR");
  assessors = users.slice(1).map((u) => actor(u, "ASSESSOR"));
  outsider = actor(await db.user.create({ data: { email: `a6-m8-${suffix}@contoh.test`, name: "Asesor A6", passwordHash: "x" } }), "ASSESSOR");
});

afterAll(async () => {
  await db.$disconnect();
});

describe("nilai bukti asesor", () => {
  it("kelipatan 0,5 dan alasan wajib", () => {
    expect(evidenceRatingSchema.safeParse({ level: "3.5", rationale: "Risalah rapat menunjukkan pembahasan K3 rutin." }).success).toBe(true);
    expect(evidenceRatingSchema.safeParse({ level: "3.25", rationale: "Risalah rapat menunjukkan pembahasan K3 rutin." }).success).toBe(false);
    expect(evidenceRatingSchema.safeParse({ level: "3", rationale: "Cukup" }).success).toBe(false);
  });

  it("lima asesor menilai; nilai asesor lain tersembunyi sampai asesor menyimpan nilainya sendiri", async () => {
    for (const c of simulation.input.characteristics) {
      const levels = spread(c.e, 5, 0.5);
      for (const [i, a] of assessors.entries()) {
        await scoring.saveEvidenceRating(a, c.code, evidenceRatingSchema.parse({ level: levels[i], rationale: `Penilaian bukti ${c.code} oleh asesor ${i + 1} berdasarkan dokumen.` }), meta);
      }
    }
    const before = await scoring.loadRatingWorkspace(assessmentId, "K1.1", outsider.session.user.id);
    expect(before?.own).toBeNull();
    expect(before?.others).toEqual([]);
    expect(before?.hiddenCount).toBe(5);
    expect(before?.statements.map((s) => s.level)).toEqual([1, 2, 3, 4, 5]);

    await scoring.saveEvidenceRating(outsider, "K1.1", evidenceRatingSchema.parse({ level: 3, rationale: "Nilai sementara asesor keenam untuk uji." }), meta);
    const after = await scoring.loadRatingWorkspace(assessmentId, "K1.1", outsider.session.user.id);
    expect(after?.own?.level).toBe(3);
    expect(after?.others).toHaveLength(5);
    // Asesor keenam hanya untuk uji tampilan; nilainya dihapus agar masukan mesin sama dengan fixture.
    await db.evidenceRating.deleteMany({ where: { assessorId: outsider.session.user.id } });
    expect(await db.auditLog.count({ where: { assessmentId, action: "rating.evidence_save" } })).toBe(18 * 5 + 1);
  });

  it("jalur setara Safety Culture Ladder: persentase per aspek per tingkat dengan alasan", async () => {
    for (const [aspectCode, steps] of Object.entries(simulation.input.sclFulfillment)) {
      const entries = Object.entries(steps).map(([step, f]) => ({ step, percent: String(f * 100), justification: `Pemenuhan kriteria tingkat ${step} aspek ${aspectCode}.` }));
      await scoring.saveSclAspect(lead, sclAspectSchema.parse({ aspectCode, entries }), meta);
    }
    expect(sclAspectSchema.safeParse({ aspectCode: "A1", entries: [{ step: 2, percent: 101, justification: "Melebihi seratus persen." }] }).success).toBe(false);
    await expect(scoring.saveSclAspect(lead, { aspectCode: "A7", entries: [2, 3, 4, 5].map((step) => ({ step, percent: 50, justification: "Aspek tidak dikenal." })) }, meta)).rejects.toMatchObject({ code: "UNKNOWN_ITEM" });
    const scl = await scoring.loadScl(assessmentId);
    expect(scl.complete).toBe(true);
    expect(scl.aspects.map((a) => a.code)).toEqual(["A1", "A2", "A3", "A4", "A5", "A6"]);
    expect(scl.aspects[0]?.weight).toBeCloseTo(4800 / 18000, 12);
  });
});

describe("eksekusi mesin", () => {
  it("hanya dapat dijalankan saat penilaian", async () => {
    await expect(scoring.runScoring(lead, meta)).rejects.toMatchObject({ code: "RUN_NOT_ALLOWED" });
  });

  it("data asesmen demo menghasilkan indeks organisasi 3,143463 sama dengan fixture", async () => {
    await db.assessment.update({ where: { id: assessmentId }, data: { status: "SCORING" } });
    const { id, result } = await scoring.runScoring(lead, meta);
    const expected = simulation.expected;
    expect(result.organization.index).toBeCloseTo(3.143463, TOL);
    expect(result.organization.index).toBeCloseTo(expected.organization.index, TOL);
    expect(result.organization.indicativeLevel).toBe(3);
    expect(result.organization.consolidated).toBe(true);
    expect(result.organization.priorityAspect).toBe("A1");
    expect(result.organization.contextualIndex).toBeCloseTo(3.165, TOL);
    expect(result.sclTrack?.indicativeLevel).toBe(3);
    for (const e of expected.characteristics) {
      const c = result.characteristics.find((x) => x.code === e.code);
      expect(c?.combined, e.code).toBeCloseTo(e.combined, TOL);
      expect(c?.final, e.code).toBeCloseTo(e.final, TOL);
      expect(c?.flags, e.code).toEqual(e.flags);
    }

    const stored = await db.scoreRun.findUniqueOrThrow({ where: { id } });
    expect(stored.isFinal).toBe(false);
    // Snapshot masukan memuat nilai lapisan dan hitungan, tanpa jawaban mentah responden.
    const input = stored.inputSnapshot as { counts: { responses: number }; strata: { code: string; responses: number }[]; sources: Record<string, { surveyAnswers: number; dontKnow: number; evidenceAssessors: number; validationSessions: number }> };
    expect(Object.keys(input).sort()).toEqual(["counts", "engineInput", "sclComplete", "sources", "strata"]);
    expect(input.counts.responses).toBe(12);
    expect(input.sources["K1.1"]).toMatchObject({ surveyAnswers: 10, dontKnow: 2, evidenceAssessors: 5, validationSessions: 2 });
    expect(JSON.stringify(stored.inputSnapshot)).not.toContain("characteristicAnswers");
    expect(await db.auditLog.count({ where: { entityId: id, action: "score.run" } })).toBe(1);
  });
});

describe("rapat panel", () => {
  it("penyesuaian hanya saat rapat panel, dengan alasan wajib; nilai mesin tetap tersimpan", async () => {
    const adjust = panelAdjustmentSchema.parse({ characteristicCode: "K1.3", adjustedValue: "2.6", rationale: "Wawancara menunjukkan pelaporan berjalan meski bukti tertulis terbatas." });
    await expect(scoring.savePanelAdjustment(lead, adjust, meta)).rejects.toMatchObject({ code: "PANEL_CLOSED" });
    await db.assessment.update({ where: { id: assessmentId }, data: { status: "PANEL_REVIEW" } });
    await expect(scoring.saveEvidenceRating(assessors[0]!, "K1.1", evidenceRatingSchema.parse({ level: 4, rationale: "Perubahan setelah rapat panel dimulai." }), meta)).rejects.toMatchObject({ code: "EVIDENCE_RATING_CLOSED" });
    expect(panelAdjustmentSchema.safeParse({ ...adjust, rationale: "Terlalu singkat" }).success).toBe(false);
    expect(panelAdjustmentSchema.safeParse({ ...adjust, adjustedValue: "2.555" }).success).toBe(false);

    await scoring.savePanelAdjustment(lead, adjust, meta);
    await scoring.savePanelAdjustment(lead, panelAdjustmentSchema.parse({ characteristicCode: "K5.1", adjustedValue: "3", rationale: "Penyesuaian sementara yang kemudian dibatalkan." }), meta);
    await scoring.removePanelAdjustment(lead, "K5.1", meta);

    const panel = await scoring.loadPanel(assessmentId);
    expect(panel?.engine.organization.index).toBeCloseTo(3.143463, TOL);
    // K1.3: F = 2,0 menjadi 2,6; I_A1 naik 0,2 dan O naik 0,2 x 4800/18000.
    expect(panel?.current.organization.index).toBeCloseTo(3.143463 + 0.2 * (4800 / 18000), TOL);
    const k13 = panel?.current.characteristics.find((c) => c.code === "K1.3");
    expect(k13).toMatchObject({ final: 2, panelAdjusted: 2.6 });
    expect(k13?.flags).toContain("SELISIH_PERSEPSI_BUKTI");
    expect(panel?.adjustments).toEqual([expect.objectContaining({ code: "K1.3", engineValue: 2, adjustedValue: 2.6 })]);
  });

  it("finalisasi menyimpan hasil dengan penyesuaian; setelah final tidak ada yang dapat diubah", async () => {
    const { id, result } = await scoring.finalizePanel(lead, meta);
    expect(result.organization.index).toBeCloseTo(3.196796, TOL);
    const run = await db.scoreRun.findUniqueOrThrow({ where: { id }, include: { panelAdjustments: true } });
    expect(run).toMatchObject({ isFinal: true, finalizedById: lead.session.user.id });
    expect((run.result as { organization: { index: number } }).organization.index).toBeCloseTo(3.143463, TOL);

    await expect(scoring.finalizePanel(lead, meta)).rejects.toMatchObject({ code: "RESULT_FINAL" });
    await expect(scoring.savePanelAdjustment(lead, panelAdjustmentSchema.parse({ characteristicCode: "K1.3", adjustedValue: "3", rationale: "Upaya mengubah setelah hasil ditetapkan." }), meta)).rejects.toMatchObject({ code: "RESULT_FINAL" });
    await expect(scoring.removePanelAdjustment(lead, "K1.3", meta)).rejects.toMatchObject({ code: "RESULT_FINAL" });

    // Pemicu basis data menolak perubahan langsung, termasuk dari luar aplikasi.
    await expect(db.scoreRun.update({ where: { id }, data: { finalResult: {} } })).rejects.toThrow(/ScoreRun is final/);
    await expect(db.scoreRun.delete({ where: { id } })).rejects.toThrow(/ScoreRun is final/);
    const adjustmentId = run.panelAdjustments[0]!.id;
    await expect(db.panelAdjustment.update({ where: { id: adjustmentId }, data: { adjustedValue: 4 } })).rejects.toThrow(/final ScoreRun/);
    await expect(db.panelAdjustment.delete({ where: { id: adjustmentId } })).rejects.toThrow(/final ScoreRun/);
    await expect(
      db.panelAdjustment.create({ data: { scoreRunId: id, characteristicId: charId.get("K2.1") as string, engineValue: 3.19, adjustedValue: 3.5, rationale: "Penambahan langsung ke basis data.", decidedById: lead.session.user.id } }),
    ).rejects.toThrow(/final ScoreRun/);
    expect(await db.auditLog.count({ where: { entityId: id, action: "panel.finalize" } })).toBe(1);
    expect(await db.auditLog.count({ where: { assessmentId, action: { in: ["panel.adjust", "panel.adjust_remove"] } } })).toBe(3);
  });

  it("masukan dan hasil eksekusi yang belum final pun tidak dapat ditimpa", async () => {
    const run = await db.scoreRun.create({
      data: { assessmentId, engineVersion: "1.0.0", inputSnapshot: {}, parameterSnapshot: {}, result: { organization: { index: 1 } }, runById: lead.session.user.id },
    });
    await expect(db.scoreRun.update({ where: { id: run.id }, data: { result: { organization: { index: 5 } } } })).rejects.toThrow(/immutable/);
    await expect(db.scoreRun.update({ where: { id: run.id }, data: { isFinal: true } })).rejects.toThrow(/finalization requires/);
    await db.scoreRun.delete({ where: { id: run.id } });
  });
});
