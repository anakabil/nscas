// Konfigurasi asesmen (docs/01 M1) dan mesin status (docs/01 bagian 3) terhadap PostgreSQL.

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

process.env.DATABASE_URL = inject("databaseUrl");
process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

const service = await import("@/lib/assessments/service");
const { editablePart } = await import("@/lib/assessments/parameters");
const { toEngineParameters } = await import("@/lib/scoring");
const { loadSeedFiles, OPERATOR_ORGANIZATION } = await import("../../prisma/seeding");
const { getDb } = await import("@/lib/db");
const { SEED_DIR } = await import("./db");

const db = getDb();
const meta = { ipHash: null, userAgent: "vitest" };
const suffix = randomBytes(4).toString("hex");

type Actor = Parameters<typeof service.updateParameters>[0];
let lead: Actor;
let orgActor: Parameters<typeof service.createAssessment>[0];
let assessmentId: string;

async function rejects(promise: Promise<unknown>, status: number, code: string) {
  await expect(promise).rejects.toMatchObject({ name: "AssessmentRuleError", status, code });
}

async function strata() {
  return db.stratum.findMany({ where: { assessmentId }, orderBy: { code: "asc" } });
}

beforeAll(async () => {
  const operator =
    (await db.organization.findFirst({ where: { isOperator: true } })) ??
    (await db.organization.create({ data: { ...OPERATOR_ORGANIZATION, isOperator: true } }));
  const client = await db.organization.create({ data: { name: `PT Uji M1 ${suffix}`, legalName: `PT Uji M1 ${suffix}` } });
  const user = await db.user.create({ data: { email: `lead-${suffix}@contoh.test`, name: "Asesor Utama Uji", passwordHash: "x" } });
  await db.membership.create({ data: { userId: user.id, organizationId: operator.id, role: "LEAD_ASSESSOR" } });
  // Versi instrumen tersendiri agar tidak menandai NS-SCML-1.0 sebagai "sudah dipakai" bagi tes seed.
  const files = loadSeedFiles(SEED_DIR);
  const { _catatan, ...defaults } = files.parameters as Record<string, unknown>;
  void _catatan;
  const version = await db.instrumentVersion.create({
    data: { code: `TEST-M1-${suffix}`, status: "PUBLISHED", defaultParameters: defaults as never },
  });

  const session = { user: { id: user.id } } as never;
  orgActor = { session, organizationId: client.id, isOperator: false, roles: ["LEAD_ASSESSOR"] };
  ({ id: assessmentId } = await service.createAssessment(
    orgActor,
    { name: "Asesmen Uji M1", scopeType: "CORPORATE", periodStart: new Date("2026-11-01"), periodEnd: new Date("2027-01-31"), targetLevel: 4, instrumentVersionId: version.id },
    meta,
  ));
  lead = { session, assessmentId, organizationId: client.id, roles: ["LEAD_ASSESSOR"] };
});

afterAll(async () => {
  await db.$disconnect();
});

describe("pembuatan asesmen", () => {
  it("berstatus DRAFT dengan lima strata bawaan, draf parameter, teks persetujuan, dan pembuat sebagai asesor utama", async () => {
    const a = await db.assessment.findUniqueOrThrow({ where: { id: assessmentId }, include: { assignments: true } });
    expect(a.status).toBe("DRAFT");
    expect((await strata()).map((s) => [s.code, s.group, s.population])).toEqual([
      ["S1", "MANAGEMENT", 0],
      ["S2", "MANAGEMENT", 0],
      ["S3", "SUPERVISORY", 0],
      ["S4", "FIELD", 0],
      ["S5", "FIELD", 0],
    ]);
    expect(a.assignments.map((x) => x.role)).toEqual(["LEAD_ASSESSOR"]);
    expect(a.consentTextId).toContain(`atas permintaan PT Uji M1 ${suffix}`);
    expect(a.consentTextEn).toContain("36 months");
    expect((a.parameterDraft as { samplePlan: unknown }).samplePlan).toBeNull();
    expect(await db.auditLog.count({ where: { assessmentId, action: "assessment.create" } })).toBe(1);
  });

  it("tidak dapat dibuat untuk organisasi operator", async () => {
    await rejects(service.createAssessment({ ...orgActor, isOperator: true }, {} as never, meta), 422, "OPERATOR_ORGANIZATION");
  });
});

describe("transisi DRAFT ke CONFIGURED", () => {
  it("ditolak selama unit dan populasi strata belum ada", async () => {
    await expect(service.transitionAssessment(lead, "CONFIGURED", meta)).rejects.toMatchObject({
      status: 422,
      code: "TRANSITION_BLOCKED",
      details: { unmet: ["HAS_UNITS", "STRATA_POPULATED"] },
    });
  });

  it("lolos setelah unit bertingkat dan populasi 3.000 pekerja diisi", async () => {
    const { id: hq } = await service.createUnit(lead, { name: "Kantor Pusat", type: "HEAD_OFFICE", parentId: null, latitude: null, longitude: null, radiusMeters: null }, meta);
    await service.createUnit(lead, { name: "Proyek Tol Seksi 1", type: "PROJECT", parentId: hq, latitude: -6.2088, longitude: 106.8456, radiusMeters: 500 }, meta);
    const populations = { S1: 15, S2: 120, S3: 300, S4: 1800, S5: 765 } as Record<string, number>;
    await service.updateStrataPopulations(lead, Object.fromEntries((await strata()).map((s) => [s.id, populations[s.code]])), meta);
    await service.transitionAssessment(lead, "CONFIGURED", meta);
    expect((await db.assessment.findUniqueOrThrow({ where: { id: assessmentId } })).status).toBe("CONFIGURED");
  });

  it("unit tidak dapat menjadi induk dari unit di bawahnya", async () => {
    const units = await db.unit.findMany({ where: { assessmentId } });
    const hq = units.find((u) => u.type === "HEAD_OFFICE")!;
    const project = units.find((u) => u.type === "PROJECT")!;
    await rejects(service.updateUnit(lead, hq.id, { name: hq.name, type: "HEAD_OFFICE", parentId: project.id, latitude: null, longitude: null, radiusMeters: null }, meta), 422, "UNIT_CYCLE");
    await rejects(service.deleteUnit(lead, hq.id, meta), 422, "UNIT_HAS_CHILDREN");
  });
});

describe("kalkulator sampel dan penguncian", () => {
  it("ditolak selama perjanjian pemrosesan data dan kalkulator sampel belum ada", async () => {
    await expect(service.transitionAssessment(lead, "LOCKED", meta)).rejects.toMatchObject({
      code: "TRANSITION_BLOCKED",
      details: { unmet: ["DPA_SIGNED", "SAMPLE_PLAN_SAVED"] },
    });
  });

  it("kalkulator menghasilkan 33, 66, 353, 341, dan sasaran 901 untuk 3.000 pekerja, 40 proyek, 12 lokasi", async () => {
    await service.saveSamplePlan(lead, { projects: 40, locations: 12 }, meta);
    const a = await db.assessment.findUniqueOrThrow({ where: { id: assessmentId } });
    const plan = (a.parameterDraft as { samplePlan: { result: Record<string, unknown> } }).samplePlan.result;
    expect(plan).toMatchObject({
      sclMinimumInterviewManagement: 33,
      sclMinimumInterviewOperational: 66,
      slovin: 353,
      cochranCorrected: 341,
      recommendedSurvey: 353,
      projectsToVisit: 4,
      locationsToVisit: 4,
      surveyTargetTotal: 901,
    });
    expect((plan.strata as { surveyTarget: number }[]).map((s) => s.surveyTarget)).toEqual([5, 36, 90, 540, 230]);
  });

  it("mengubah populasi strata membatalkan hasil kalkulator", async () => {
    const s1 = (await strata())[0];
    await service.updateStrataPopulations(lead, { [s1.id]: 16 }, meta);
    expect(((await db.assessment.findUniqueOrThrow({ where: { id: assessmentId } })).parameterDraft as { samplePlan: unknown }).samplePlan).toBeNull();
    await service.updateStrataPopulations(lead, { [s1.id]: 15 }, meta);
    await service.saveSamplePlan(lead, { projects: 40, locations: 12 }, meta);
  });

  it("kunci menyalin parameter, strata, hasil kalkulator, dan teks persetujuan ke parameterSnapshot", async () => {
    const draft = (await db.assessment.findUniqueOrThrow({ where: { id: assessmentId } })).parameterDraft as never;
    const parameters = { ...editablePart(draft), selfAssessmentWeightInPerception: 0.25 };
    await service.updateParameters(lead, { parameters, consentTextId: "Teks persetujuan uji.", consentTextEn: "Test consent text.", dpaSigned: true }, meta);
    await service.transitionAssessment(lead, "LOCKED", meta);

    const a = await db.assessment.findUniqueOrThrow({ where: { id: assessmentId } });
    expect(a.status).toBe("LOCKED");
    expect(a.lockedById).toBe((lead.session as { user: { id: string } }).user.id);
    const snapshot = a.parameterSnapshot as unknown as {
      parameters: Parameters<typeof toEngineParameters>[0] & { selfAssessmentWeightInPerception: number };
      samplePlan: { result: { surveyTargetTotal: number } };
      strata: { population: number }[];
      consent: { id: string; en: string };
      instrumentVersion: { code: string };
    };
    expect(snapshot.parameters.selfAssessmentWeightInPerception).toBe(0.25);
    expect(snapshot.parameters).not.toHaveProperty("samplePlan");
    expect(snapshot.samplePlan.result.surveyTargetTotal).toBe(901);
    expect(snapshot.strata.map((s: { population: number }) => s.population)).toEqual([15, 120, 300, 1800, 765]);
    expect(snapshot.consent).toEqual({ id: "Teks persetujuan uji.", en: "Test consent text." });
    expect(snapshot.instrumentVersion.code).toBe(`TEST-M1-${suffix}`);
    // Snapshot dapat dipakai langsung oleh mesin penilaian.
    expect(toEngineParameters(snapshot.parameters).selfAssessmentWeightInPerception).toBe(0.25);

    const audit = await db.auditLog.findFirst({ where: { assessmentId, action: "assessment.status_change", after: { path: ["status"], equals: "LOCKED" } } });
    expect(audit?.before).toEqual({ status: "CONFIGURED" });
  });

  it("setelah dikunci, perubahan parameter, strata, rincian, dan kalkulator ditolak dengan 409", async () => {
    const s1 = (await strata())[0];
    const draft = (await db.assessment.findUniqueOrThrow({ where: { id: assessmentId } })).parameterDraft as never;
    await rejects(service.updateParameters(lead, { parameters: editablePart(draft), consentTextId: "x", consentTextEn: "x", dpaSigned: true }, meta), 409, "CONFIGURATION_LOCKED");
    await rejects(service.updateStrataPopulations(lead, { [s1.id]: 99 }, meta), 409, "CONFIGURATION_LOCKED");
    await rejects(service.updateStratum(lead, s1.id, { code: "S1", name: "x", group: "MANAGEMENT", population: 1, isContractor: false }, meta), 409, "CONFIGURATION_LOCKED");
    await rejects(service.createStratum(lead, { code: "S9", name: "Baru", group: "FIELD", population: 1, isContractor: false }, meta), 409, "CONFIGURATION_LOCKED");
    await rejects(service.saveSamplePlan(lead, { projects: 1, locations: 1 }, meta), 409, "CONFIGURATION_LOCKED");
    await rejects(service.updateAssessmentDetails(lead, { name: "Diubah", scopeType: "CORPORATE", periodStart: new Date(), periodEnd: new Date(), targetLevel: 5, instrumentVersionId: "x" }, meta), 409, "CONFIGURATION_LOCKED");
    expect((await strata())[0].population).toBe(15);
  });

  it("unit tetap dapat dilengkapi setelah dikunci", async () => {
    await expect(
      service.createUnit(lead, { name: "Proyek Tambahan", type: "PROJECT", parentId: null, latitude: -7.25, longitude: 112.75, radiusMeters: 300 }, meta),
    ).resolves.toHaveProperty("id");
  });
});

describe("transisi sesudah dikunci", () => {
  it("tidak dapat melompat atau mundur (409)", async () => {
    await rejects(service.transitionAssessment(lead, "SCORING", meta), 409, "INVALID_TRANSITION");
    await rejects(service.transitionAssessment(lead, "CONFIGURED", meta), 409, "INVALID_TRANSITION");
  });

  it("LOCKED ke DATA_COLLECTION menunggu daftar responden dan token", async () => {
    await expect(service.transitionAssessment(lead, "DATA_COLLECTION", meta)).rejects.toMatchObject({
      details: { unmet: ["ROSTER_IMPORTED", "TOKENS_ISSUED"] },
    });
  });

  it("peran selain pelaku transisi ditolak (403)", async () => {
    await rejects(service.transitionAssessment({ ...lead, roles: ["SUPER_ADMIN"] }, "DATA_COLLECTION", meta), 403, "FORBIDDEN");
  });
});

describe("tim asesor", () => {
  it("hanya staf asesor Nusa Safety yang dapat ditugaskan, dan asesor utama terakhir tidak dapat dicabut", async () => {
    const outsider = await db.user.create({ data: { email: `luar-${suffix}@contoh.test`, name: "Bukan Staf", passwordHash: "x" } });
    await rejects(service.addAssignment(lead, { userId: outsider.id, role: "ASSESSOR" }, meta), 422, "NOT_ASSESSOR_STAFF");

    const only = await db.assessmentAssignment.findFirstOrThrow({ where: { assessmentId, role: "LEAD_ASSESSOR" } });
    await rejects(service.removeAssignment(lead, only.id, meta), 422, "LAST_LEAD_ASSESSOR");
    await rejects(service.addAssignment(lead, { userId: only.userId, role: "ASSESSOR" }, meta), 422, "ALREADY_ASSIGNED");
  });
});
