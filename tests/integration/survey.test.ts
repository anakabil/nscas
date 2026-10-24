// Survei responden (docs/01 M3) dan desain anonimitas (docs/02 bagian 4) terhadap PostgreSQL.

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

process.env.DATABASE_URL = inject("databaseUrl");
process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

const survey = await import("@/lib/survey/service");
const { generateToken, hashToken } = await import("@/lib/privacy/tokens");
const { getDb } = await import("@/lib/db");

const db = getDb();
const suffix = randomBytes(4).toString("hex");
const HOUR = 60 * 60 * 1000;

let assessmentId: string;
let unitId: string;
let strata: { id: string; code: string }[];
let characteristics: { id: string; statements: { id: string; level: number }[] }[];
let items: { id: string }[];

async function issue(options: { stratumId?: string | null; qr?: boolean } = {}): Promise<{ raw: string; id: string }> {
  const raw = generateToken();
  const token = await db.accessToken.create({
    data: {
      assessmentId,
      unitId,
      stratumId: options.stratumId === undefined ? (strata[0]?.id ?? null) : options.stratumId,
      kind: "SURVEY",
      channel: options.qr ? "QR" : "LINK",
      tokenHash: hashToken(raw),
    },
    select: { id: true },
  });
  return { raw, id: token.id };
}

/** Kiriman lengkap: karakteristik pertama Tidak tahu, sisanya tingkat 3; butir iklim bervariasi. */
function payload(overrides: Partial<Parameters<typeof survey.submitSurvey>[1]> = {}) {
  return {
    language: "id" as const,
    stratumId: null,
    durationSeconds: 700,
    characteristics: characteristics.map((c, i) => ({ characteristicId: c.id, statementId: i === 0 ? null : (c.statements.find((s) => s.level === 3)?.id as string) })),
    climate: items.map((item, i) => ({ itemId: item.id, value: (i % 5) + 1 })),
    ...overrides,
  };
}

beforeAll(async () => {
  const org = await db.organization.create({ data: { name: `PT Uji M3 ${suffix}`, legalName: `PT Uji M3 ${suffix}` } });
  // Versi instrumen kecil tersendiri: 4 karakteristik dan 6 butir iklim.
  const version = await db.instrumentVersion.create({ data: { code: `TEST-M3-${suffix}`, status: "PUBLISHED", defaultParameters: {} } });
  const aspect = await db.aspect.create({ data: { instrumentVersionId: version.id, code: "A1", name: "Aspek uji" } });
  characteristics = [];
  for (let c = 1; c <= 4; c++) {
    const created = await db.characteristic.create({
      data: {
        instrumentVersionId: version.id,
        aspectId: aspect.id,
        code: `K1.${c}`,
        nameId: `Karakteristik uji ${c}`,
        order: c,
        levelStatements: { create: [1, 2, 3, 4, 5].map((level) => ({ level, textId: `Pernyataan ${c}.${level}` })) },
      },
      select: { id: true, levelStatements: { select: { id: true, level: true } } },
    });
    characteristics.push({ id: created.id, statements: created.levelStatements });
  }
  items = [];
  for (let d = 1; d <= 2; d++) {
    const dimension = await db.climateDimension.create({ data: { instrumentVersionId: version.id, code: `D${d}`, nameId: `Dimensi ${d}`, order: d } });
    for (let i = 1; i <= 3; i++) {
      items.push(await db.climateItem.create({ data: { dimensionId: dimension.id, code: `D${d}.${i}`, textId: `Butir ${d}.${i}`, order: i }, select: { id: true } }));
    }
  }
  const assessment = await db.assessment.create({
    data: {
      organizationId: org.id,
      name: "Asesmen Uji M3",
      scopeType: "CORPORATE",
      periodStart: new Date("2026-11-01"),
      periodEnd: new Date("2027-01-31"),
      targetLevel: 3,
      instrumentVersionId: version.id,
      status: "DATA_COLLECTION",
      lockedAt: new Date(),
      surveyOpensAt: new Date(Date.now() - 24 * HOUR),
      surveyClosesAt: new Date(Date.now() + 24 * HOUR),
      parameterSnapshot: {
        consent: { id: "Teks persetujuan uji", en: "Test consent text" },
        parameters: { quality: { straightliningShare: 0.9, speedingFractionOfMedian: 0.33, dontKnowShareMax: 0.5 } },
      },
    },
    select: { id: true },
  });
  assessmentId = assessment.id;
  unitId = (await db.unit.create({ data: { assessmentId, name: "Proyek Uji", type: "PROJECT" }, select: { id: true } })).id;
  strata = [];
  for (const code of ["S1", "S4"]) {
    strata.push(await db.stratum.create({ data: { assessmentId, code, name: `Strata ${code}`, group: "FIELD", population: 50 }, select: { id: true, code: true } }));
  }
});

afterAll(async () => {
  await db.$disconnect();
});

describe("status tautan", () => {
  it("membedakan tautan siap, tidak dikenal, dicabut, dan sudah dipakai", async () => {
    const ready = await issue();
    expect(await survey.resolveSurveyToken(ready.raw)).toMatchObject({ state: "READY", needsStratum: false, consent: { id: "Teks persetujuan uji", en: "Test consent text" } });
    expect(await survey.resolveSurveyToken(generateToken())).toEqual({ state: "INVALID" });
    expect(await survey.resolveSurveyToken("bukan-token")).toEqual({ state: "INVALID" });
    const revoked = await issue();
    await db.accessToken.update({ where: { id: revoked.id }, data: { revokedAt: new Date() } });
    expect(await survey.resolveSurveyToken(revoked.raw)).toEqual({ state: "INVALID" });
    const qr = await issue({ stratumId: null, qr: true });
    expect(await survey.resolveSurveyToken(qr.raw)).toMatchObject({ state: "READY", needsStratum: true });
  });

  it("menandai tautan pernah dibuka, dibulatkan ke jam, tanpa menimpa nilai sebelumnya", async () => {
    const token = await issue();
    const now = new Date("2026-11-03T02:29:00Z");
    await survey.markSurveyOpened(token.raw, now);
    await survey.markSurveyOpened(token.raw, new Date("2026-11-04T09:00:00Z"));
    expect((await db.accessToken.findUniqueOrThrow({ where: { id: token.id } })).firstOpenedAt?.toISOString()).toBe("2026-11-03T02:00:00.000Z");
  });

  it("memuat isi survei dengan urutan pernyataan tetap per token dan tanpa tingkat", async () => {
    const a = await survey.loadSurveyContent((await db.assessment.findUniqueOrThrow({ where: { id: assessmentId } })).instrumentVersionId, assessmentId, "benih-a", true);
    const again = await survey.loadSurveyContent((await db.assessment.findUniqueOrThrow({ where: { id: assessmentId } })).instrumentVersionId, assessmentId, "benih-a", true);
    expect(a).toEqual(again);
    expect(a.characteristics).toHaveLength(4);
    expect(a.climateScreens.map((s) => s.length)).toEqual([3, 3]);
    expect(a.strata.map((s) => s.name)).toEqual(["Strata S1", "Strata S4"]);
    expect(JSON.stringify(a)).not.toContain('"level"');
  });
});

describe("pengiriman survei", () => {
  it("dalam satu transaksi: token selesai (dibulatkan ke jam), jawaban tanpa rujukan token, tanggal saja, durasi dalam rentang", async () => {
    const token = await issue({ stratumId: strata[1]?.id });
    const auditBefore = await db.auditLog.count();
    const now = new Date("2026-11-03T16:40:00Z"); // 23.40 WIB
    await db.assessment.update({ where: { id: assessmentId }, data: { surveyOpensAt: new Date("2026-11-01T00:00:00Z"), surveyClosesAt: new Date("2026-11-30T00:00:00Z") } });

    expect(await survey.submitSurvey(token.raw, payload(), now)).toEqual({ ok: true });

    const stored = await db.accessToken.findUniqueOrThrow({ where: { id: token.id } });
    expect(stored.completedAt?.toISOString()).toBe("2026-11-03T17:00:00.000Z");
    expect(stored.consentAt?.toISOString()).toBe("2026-11-03T17:00:00.000Z");

    const responses = await db.surveyResponse.findMany({ where: { assessmentId }, include: { characteristicAnswers: true, climateAnswers: true } });
    expect(responses).toHaveLength(1);
    const r = responses[0]!;
    expect(r).toMatchObject({ unitId, stratumId: strata[1]?.id, language: "id", durationBucket: "FROM_10_TO_15", excluded: false });
    expect(r.submittedOn.toISOString()).toBe("2026-11-03T00:00:00.000Z");
    expect(r.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const levels = Object.fromEntries(r.characteristicAnswers.map((x) => [x.characteristicId, x.level]));
    expect(characteristics.map((c) => levels[c.id])).toEqual([null, 3, 3, 3]);
    expect(r.climateAnswers.map((x) => x.value).sort()).toEqual([1, 2, 3, 4, 5, 1].sort());
    expect(r.qualityFlags).toEqual([]);
    expect(JSON.stringify(r)).not.toContain(token.id);
    // Pengiriman survei tidak menulis jejak audit apa pun (waktu audit akan membuka kaitan dengan token).
    expect(await db.auditLog.count()).toBe(auditBefore);

    await db.assessment.update({ where: { id: assessmentId }, data: { surveyOpensAt: new Date(Date.now() - 24 * HOUR), surveyClosesAt: new Date(Date.now() + 24 * HOUR) } });
  });

  it("token yang sudah dipakai, dicabut, atau tidak dikenal ditolak", async () => {
    const token = await issue();
    expect(await survey.submitSurvey(token.raw, payload())).toEqual({ ok: true });
    expect(await survey.submitSurvey(token.raw, payload())).toEqual({ ok: false, status: 409, code: "ALREADY_SUBMITTED" });
    expect(await survey.resolveSurveyToken(token.raw)).toEqual({ state: "USED" });

    const revoked = await issue();
    await db.accessToken.update({ where: { id: revoked.id }, data: { revokedAt: new Date(), revokedReason: "MANUAL" } });
    expect(await survey.submitSurvey(revoked.raw, payload())).toEqual({ ok: false, status: 404, code: "INVALID_TOKEN" });
    expect(await survey.submitSurvey(generateToken(), payload())).toEqual({ ok: false, status: 404, code: "INVALID_TOKEN" });
  });

  it("dua kiriman bersamaan dengan token yang sama hanya menyimpan satu jawaban", async () => {
    const token = await issue();
    const before = await db.surveyResponse.count({ where: { assessmentId } });
    const results = await Promise.all([survey.submitSurvey(token.raw, payload()), survey.submitSurvey(token.raw, payload())]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, status: 409, code: "ALREADY_SUBMITTED" }]);
    expect(await db.surveyResponse.count({ where: { assessmentId } })).toBe(before + 1);
  });

  it("di luar jendela survei atau sebelum pengumpulan data ditolak", async () => {
    const token = await issue();
    const closed = new Date(Date.now() + 48 * HOUR);
    expect(await survey.submitSurvey(token.raw, payload(), closed)).toEqual({ ok: false, status: 409, code: "SURVEY_CLOSED" });
    expect(await survey.resolveSurveyToken(token.raw, closed)).toEqual({ state: "CLOSED" });
    const early = new Date(Date.now() - 48 * HOUR);
    expect(await survey.submitSurvey(token.raw, payload(), early)).toEqual({ ok: false, status: 409, code: "SURVEY_NOT_OPEN" });

    await db.assessment.update({ where: { id: assessmentId }, data: { status: "LOCKED" } });
    expect(await survey.submitSurvey(token.raw, payload())).toEqual({ ok: false, status: 409, code: "SURVEY_NOT_OPEN" });
    expect(await survey.resolveSurveyToken(token.raw)).toEqual({ state: "NOT_OPEN", opensAt: null });
    await db.assessment.update({ where: { id: assessmentId }, data: { status: "SCORING" } });
    expect(await survey.resolveSurveyToken(token.raw)).toEqual({ state: "CLOSED" });
    await db.assessment.update({ where: { id: assessmentId }, data: { status: "DATA_COLLECTION" } });
  });

  it("token kode QR wajib memilih strata asesmen ini, lalu strata disimpan di token dan jawaban", async () => {
    const qr = await issue({ stratumId: null, qr: true });
    expect(await survey.submitSurvey(qr.raw, payload())).toEqual({ ok: false, status: 422, code: "STRATUM_REQUIRED" });
    const foreign = await db.stratum.findFirstOrThrow({ where: { assessmentId: { not: assessmentId } }, select: { id: true } }).catch(() => ({ id: "strata-lain" }));
    expect(await survey.submitSurvey(qr.raw, payload({ stratumId: foreign.id }))).toEqual({ ok: false, status: 422, code: "STRATUM_REQUIRED" });
    expect(await survey.submitSurvey(qr.raw, payload({ stratumId: strata[1]?.id }))).toEqual({ ok: true });
    expect((await db.accessToken.findUniqueOrThrow({ where: { id: qr.id } })).stratumId).toBe(strata[1]?.id);
  });

  it("jawaban tidak lengkap, berulang, atau memakai pernyataan karakteristik lain ditolak", async () => {
    const token = await issue();
    const base = payload();
    expect(await survey.submitSurvey(token.raw, { ...base, characteristics: base.characteristics.slice(1) })).toMatchObject({ code: "INCOMPLETE" });
    expect(await survey.submitSurvey(token.raw, { ...base, climate: base.climate.slice(1) })).toMatchObject({ code: "INCOMPLETE" });
    expect(await survey.submitSurvey(token.raw, { ...base, characteristics: [...base.characteristics.slice(1), base.characteristics[1]!] })).toMatchObject({ code: "INCOMPLETE" });
    const swapped = base.characteristics.map((c, i) => (i === 1 ? { ...c, statementId: characteristics[2]!.statements[0]!.id } : c));
    expect(await survey.submitSurvey(token.raw, { ...base, characteristics: swapped })).toMatchObject({ status: 422, code: "UNKNOWN_ITEM" });
    expect((await db.accessToken.findUniqueOrThrow({ where: { id: token.id } })).completedAt).toBeNull();
  });

  it("menghitung tanda mutu sesuai docs/03 bagian 8", async () => {
    const uniform = await issue();
    await survey.submitSurvey(uniform.raw, payload({ climate: items.map((i) => ({ itemId: i.id, value: 4 })) }));
    const dontKnow = await issue();
    await survey.submitSurvey(dontKnow.raw, payload({ characteristics: characteristics.map((c, i) => ({ characteristicId: c.id, statementId: i < 3 ? null : c.statements[0]!.id })) }));
    const fast = await issue();
    // Kurang dari 0,33 x 15 menit (durasi nominal, karena jawaban asesmen ini belum 10).
    await survey.submitSurvey(fast.raw, payload({ durationSeconds: 4 * 60 }));

    const flags = (await db.surveyResponse.findMany({ where: { assessmentId }, select: { qualityFlags: true } })).map((r) => r.qualityFlags.join(","));
    expect(flags).toContain("POLA_SERAGAM");
    expect(flags).toContain("BANYAK_TIDAK_TAHU");
    expect(flags).toContain("TERLALU_CEPAT");
  });
});

describe("anonimitas di tingkat basis data", () => {
  const tables = ["SurveyResponse", "CharacteristicAnswer", "ClimateAnswer"];

  it("tabel jawaban tidak memiliki kolom token, responden, alamat, atau cap waktu", async () => {
    const columns = await db.$queryRaw<{ table_name: string; column_name: string; data_type: string }[]>`
      SELECT table_name, column_name, data_type FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = ANY(${tables}) ORDER BY table_name, ordinal_position`;
    const byTable = (t: string) => columns.filter((c) => c.table_name === t).map((c) => c.column_name);
    expect(byTable("SurveyResponse")).toEqual([
      "id",
      "assessmentId",
      "unitId",
      "stratumId",
      "instrumentVersionId",
      "language",
      "submittedOn",
      "durationBucket",
      "qualityFlags",
      "excluded",
      "excludedReason",
      "excludedById",
    ]);
    expect(byTable("CharacteristicAnswer")).toEqual(["id", "responseId", "characteristicId", "level"]);
    expect(byTable("ClimateAnswer")).toEqual(["id", "responseId", "itemId", "value"]);
    const timeColumns = columns.filter((c) => /time|interval/.test(c.data_type));
    expect(timeColumns).toEqual([]);
    expect(columns.find((c) => c.column_name === "submittedOn")?.data_type).toBe("date");
  });

  it("tidak ada kunci asing dari tabel jawaban ke token atau daftar responden, maupun sebaliknya", async () => {
    const fks = await db.$queryRaw<{ source: string; target: string }[]>`
      SELECT conrelid::regclass::text AS source, confrelid::regclass::text AS target
      FROM pg_constraint WHERE contype = 'f'`;
    const clean = fks.map((f) => ({ source: f.source.replace(/"/g, ""), target: f.target.replace(/"/g, "") }));
    for (const fk of clean.filter((f) => tables.includes(f.source))) {
      expect(["AccessToken", "RosterEntry", "UnitQrCode", "SelfAssessment"]).not.toContain(fk.target);
    }
    expect(clean.filter((f) => ["AccessToken", "RosterEntry"].includes(f.source) && tables.includes(f.target))).toEqual([]);
  });

  it("id jawaban adalah UUID versi 4 yang acak, bukan berurutan menurut waktu", async () => {
    const ids = (await db.surveyResponse.findMany({ where: { assessmentId }, select: { id: true } })).map((r) => r.id);
    expect(ids.length).toBeGreaterThan(3);
    for (const id of ids) expect(id[14]).toBe("4");
  });
});
