// Validasi daring (docs/01 M7) terhadap PostgreSQL.

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

process.env.DATABASE_URL = inject("databaseUrl");
process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

const validation = await import("@/lib/validation/service");
const { samplePlan } = await import("@/lib/scoring");
const { getDb } = await import("@/lib/db");

const db = getDb();
const meta = { ipHash: null, userAgent: "vitest" };
const suffix = randomBytes(4).toString("hex");

let lead: Parameters<typeof validation.createSession>[0];
let assessor: Parameters<typeof validation.createSession>[0];
let assessmentId: string;
let characteristics: { id: string; code: string }[];
const label = (s: { type: string; stratumCode: string | null; sequence: number }) => `${s.type} ${s.stratumCode ?? "-"} ${s.sequence}`;

beforeAll(async () => {
  const org = await db.organization.create({ data: { name: `PT Uji M7 ${suffix}`, legalName: `PT Uji M7 ${suffix}` } });
  const [la, as] = await Promise.all(["la", "as"].map((p) => db.user.create({ data: { email: `${p}-m7-${suffix}@contoh.test`, name: `Asesor ${p}`, passwordHash: "x" } })));
  const version = await db.instrumentVersion.create({ data: { code: `TEST-M7-${suffix}`, status: "PUBLISHED", defaultParameters: {} } });
  const aspect = await db.aspect.create({ data: { instrumentVersionId: version.id, code: "A5", name: "Aspek" } });
  characteristics = [];
  for (const [i, code] of ["K5.1", "K5.2", "K9.9"].entries()) {
    characteristics.push(await db.characteristic.create({ data: { instrumentVersionId: version.id, aspectId: aspect.id, code, nameId: `Karakteristik ${code}`, order: i + 1 }, select: { id: true, code: true } }));
  }
  const strataInput = [
    { code: "S1", name: "Direksi", group: "MANAGEMENT" as const, population: 15 },
    { code: "S2", name: "Manajemen", group: "MANAGEMENT" as const, population: 120 },
    { code: "S3", name: "Penyelia", group: "SUPERVISORY" as const, population: 300 },
    { code: "S4", name: "Pelaksana", group: "FIELD" as const, population: 1800 },
    { code: "S5", name: "Penyedia jasa", group: "FIELD" as const, population: 765 },
  ];
  const plan = samplePlan({ workers: 3000, projects: 40, locations: 12, strata: strataInput });
  assessmentId = (
    await db.assessment.create({
      data: {
        organizationId: org.id,
        name: "Asesmen Uji M7",
        scopeType: "CORPORATE",
        periodStart: new Date("2026-11-01"),
        periodEnd: new Date("2027-01-31"),
        targetLevel: 3,
        instrumentVersionId: version.id,
        status: "LOCKED",
        parameterSnapshot: {
          parameters: { sampling: { fgdMaxParticipantsPerSession: 8 } },
          samplePlan: { projects: 40, locations: 12, computedAt: new Date().toISOString(), result: plan },
        } as never,
      },
      select: { id: true },
    })
  ).id;
  await db.stratum.createMany({ data: strataInput.map((s) => ({ ...s, assessmentId })) });
  const base = { assessmentId, organizationId: org.id };
  lead = { ...base, session: { user: { id: la.id } } as never, roles: ["LEAD_ASSESSOR"] };
  assessor = { ...base, session: { user: { id: as.id } } as never, roles: ["ASSESSOR"] };
});

afterAll(async () => {
  await db.$disconnect();
});

describe("templat panduan pertanyaan", () => {
  it("dibuat per lapisan jabatan dengan satu pertanyaan per karakteristik, K5.1 sesuai ketentuan", async () => {
    const templates = await validation.loadGuideTemplates(assessmentId);
    expect(templates.map((t) => t.layer)).toEqual(["MANAGEMENT", "SUPERVISORY", "FIELD"]);
    for (const t of templates) expect(t.questions.map((q) => q.characteristicCode)).toEqual(["K5.1", "K5.2", "K9.9"]);
    expect(templates[2]?.questions[0]?.question).toBe("Ceritakan laporan terakhir yang Anda buat atau terima. Apa tindak lanjutnya, dan berapa lama?");
    expect(templates[2]?.intro).toContain("diskusi kelompok terarah");
  });

  it("lead assessor dapat mengubahnya dan perubahan tercatat; karakteristik asing ditolak", async () => {
    const [management] = await validation.loadGuideTemplates(assessmentId);
    const questions = management!.questions.map((q) => (q.characteristicCode === "K5.2" ? { ...q, question: "Pertanyaan baru tentang investigasi." } : q));
    await validation.updateGuideTemplate(lead, { layer: "MANAGEMENT", intro: "Pengantar baru", questions }, meta);
    const updated = (await validation.loadGuideTemplates(assessmentId))[0]!;
    expect(updated.intro).toBe("Pengantar baru");
    expect(updated.questions[1]?.question).toBe("Pertanyaan baru tentang investigasi.");
    expect(await db.auditLog.count({ where: { assessmentId, action: "validation.guide_update" } })).toBe(1);
    await expect(validation.updateGuideTemplate(lead, { layer: "MANAGEMENT", intro: "x", questions: [{ characteristicCode: "K1.1", question: "x" }] }, meta)).rejects.toMatchObject({ code: "UNKNOWN_ITEM" });
  });
});

describe("usulan dan penjadwalan sesi", () => {
  it("usulan dari kalkulator sampel: 33 wawancara, 66 peserta diskusi kelompok maksimal 8 per sesi, 4 kunjungan virtual", async () => {
    const proposal = await validation.loadProposal(assessmentId);
    expect(proposal.available).toBe(true);
    if (!proposal.available) return;
    expect(proposal.interviews.reduce((s, i) => s + i.count, 0)).toBe(33);
    expect(proposal.focusGroups.reduce((s, g) => s + g.participants, 0)).toBe(66);
    expect(proposal.virtualVisits).toBe(4);

    const count = await validation.createSessionsFromProposal(lead, label, meta);
    expect(count).toBe(proposal.sessions.length);
    const sessions = await validation.listSessions(assessmentId);
    expect(sessions).toHaveLength(count);
    expect(sessions.filter((s) => s.type === "INTERVIEW").every((s) => ["S1", "S2", "S3"].includes(s.stratum?.code ?? ""))).toBe(true);
    expect(sessions.filter((s) => s.type === "FOCUS_GROUP").every((s) => ["S3", "S4", "S5"].includes(s.stratum?.code ?? "") && (s.participantCount ?? 0) <= 8)).toBe(true);
    expect(sessions.every((s) => s.scheduledAt === null)).toBe(true);
    await expect(validation.createSessionsFromProposal(lead, label, meta)).rejects.toMatchObject({ code: "SESSIONS_EXIST" });
  });

  it("jadwal dan tautan rapat HTTPS diatur, lalu tercatat di jejak audit", async () => {
    const created = await validation.createSession(
      lead,
      validation.sessionSchema.parse({ type: "INTERVIEW", label: "Wawancara direktur operasi", scheduledAt: "2026-11-10T09:00", meetingUrl: "https://meet.google.com/abc-defg-hij", guideLayer: "MANAGEMENT" }),
      meta,
    );
    const stored = await db.validationSession.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.scheduledAt?.toISOString()).toBe("2026-11-10T02:00:00.000Z");
    expect(validation.sessionSchema.safeParse({ type: "INTERVIEW", label: "x2", meetingUrl: "http://zoom.us/j/1", guideLayer: "FIELD" }).success).toBe(false);
    await validation.updateSession(
      lead,
      created.id,
      validation.sessionUpdateSchema.parse({ label: "Wawancara direktur operasi", scheduledAt: "2026-11-11T13:30", meetingUrl: "https://teams.microsoft.com/l/meetup-join/1", guideLayer: "MANAGEMENT", status: "COMPLETED" }),
      meta,
    );
    expect(await db.auditLog.count({ where: { entityId: created.id, action: { in: ["validation.session_create", "validation.session_update"] } } })).toBe(2);
  });
});

describe("formulir asesor dan narasumber", () => {
  let sessionId: string;

  beforeAll(async () => {
    sessionId = (await db.validationSession.findFirstOrThrow({ where: { assessmentId, type: "FOCUS_GROUP" } })).id;
  });

  it("nilai hanya selama pengumpulan data dan penilaian, kelipatan 0,5, dan hanya milik asesor itu", async () => {
    const form = (level: number | null) => ({ recordingConsent: true, notes: "Peserta menyebut pelaporan lambat.", ratings: [{ characteristicId: characteristics[0]!.id, level, note: "Ada contoh konkret" }] });
    await expect(validation.saveAssessorForm(assessor, sessionId, form(3.5), meta)).rejects.toMatchObject({ code: "RATINGS_CLOSED" });
    await db.assessment.update({ where: { id: assessmentId }, data: { status: "DATA_COLLECTION" } });
    await expect(validation.saveAssessorForm(assessor, sessionId, form(3.25), meta)).rejects.toMatchObject({ code: "INVALID_RATING" });
    await validation.saveAssessorForm(assessor, sessionId, form(3.5), meta);
    await validation.saveAssessorForm(lead, sessionId, { recordingConsent: true, notes: "Peserta menyebut pelaporan lambat.", ratings: [{ characteristicId: characteristics[0]!.id, level: 2.5, note: "" }] }, meta);

    const ratings = await db.validationRating.findMany({ where: { sessionId }, orderBy: { level: "asc" } });
    expect(ratings.map((r) => r.level)).toEqual([2.5, 3.5]);
    const mine = await validation.loadSession(assessmentId, sessionId, assessor.session.user.id);
    expect(mine?.ratings).toEqual([{ characteristicId: characteristics[0]!.id, level: 3.5, note: "Ada contoh konkret" }]);
    expect(mine).toMatchObject({ recordingConsent: true, notes: "Peserta menyebut pelaporan lambat." });

    // Nilai kosong menghapus nilai asesor itu saja.
    await validation.saveAssessorForm(assessor, sessionId, form(null), meta);
    expect(await db.validationRating.count({ where: { sessionId } })).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: sessionId, action: "validation.rating_save" } })).toBe(3);
  });

  it("narasumber disimpan di tabel terpisah tanpa kaitan ke catatan atau nilai", async () => {
    await validation.addParticipant(assessor, sessionId, { fullName: "Budi Santoso", position: "Mandor" }, meta);
    const participant = await db.validationParticipant.findFirstOrThrow({ where: { sessionId } });
    const session = await db.validationSession.findUniqueOrThrow({ where: { id: sessionId }, include: { ratings: true } });
    expect(JSON.stringify(session)).not.toContain("Budi Santoso");
    expect(Object.keys(participant).sort()).toEqual(["createdAt", "fullName", "id", "position", "sessionId", "updatedAt"]);
    await validation.removeParticipant(assessor, participant.id, meta);
    expect(await db.validationParticipant.count({ where: { sessionId } })).toBe(0);
  });

  it("setelah rapat panel, nilai tidak dapat diubah", async () => {
    await db.assessment.update({ where: { id: assessmentId }, data: { status: "PANEL_REVIEW" } });
    await expect(validation.saveAssessorForm(lead, sessionId, { recordingConsent: true, notes: "", ratings: [] }, meta)).rejects.toMatchObject({ code: "RATINGS_CLOSED" });
  });
});
