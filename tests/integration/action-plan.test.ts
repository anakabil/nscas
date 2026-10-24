// Daftar kesenjangan dan rencana aksi (docs/01 M10) terhadap PostgreSQL.

import { randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import seedParameters from "../../seed/aspek-dan-parameter.json";
import simulation from "../../seed/fixtures/skoring-simulasi.json";
import messages from "../../messages/id.json";

process.env.DATABASE_URL = inject("databaseUrl");
process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

const plan = await import("@/lib/action-plan/service");
const { actionSchema, progressSchema } = await import("@/lib/action-plan/rules");
const { buildActionPlanWorkbook } = await import("@/lib/action-plan/export");
const { deliverActionReminder } = await import("@/lib/jobs/action-reminders");
const { runEngine, toEngineParameters } = await import("@/lib/scoring");
const { getDb } = await import("@/lib/db");

const db = getDb();
const meta = { ipHash: null, userAgent: "vitest" };
const suffix = randomBytes(4).toString("hex");
const params = toEngineParameters(seedParameters);
const result = runEngine({ characteristics: simulation.input.characteristics.map((c) => ({ ...c, perception: c.p, evidence: c.e, validation: c.v })), targetLevel: 4 }, params);

type Actor = Parameters<typeof plan.generateGapList>[0];
let assessmentId: string;
let lead: Actor;
let client: Actor;
let coordinator: Actor;
let assessor: Actor;
let unitA: string;
let unitB: string;
const action = (overrides: Record<string, string> = {}) =>
  actionSchema.parse({ title: "Pelatihan pelaporan hampir celaka", description: "", ownerName: "Rina Wulandari", ownerPosition: "Manajer K3", ownerEmail: "", unitId: "", dueDate: "2027-03-31", successIndicator: "90 persen pekerja terlatih", ...overrides });

beforeAll(async () => {
  const org = await db.organization.create({ data: { name: `PT Uji M10 ${suffix}`, legalName: `PT Uji M10 ${suffix}` } });
  const users = [];
  for (const p of ["la", "ca", "uc", "as"]) users.push(await db.user.create({ data: { email: `${p}-m10-${suffix}@contoh.test`, name: `Pengguna ${p.toUpperCase()}`, passwordHash: "x" } }));
  const version = await db.instrumentVersion.create({ data: { code: `TEST-M10-${suffix}`, status: "PUBLISHED", defaultParameters: {} } });
  const aspectIds = new Map<string, string>();
  for (const a of seedParameters.aspects as { code: string; name: string }[]) aspectIds.set(a.code, (await db.aspect.create({ data: { instrumentVersionId: version.id, code: a.code, name: a.name } })).id);
  for (const [i, c] of simulation.input.characteristics.entries()) {
    await db.characteristic.create({ data: { instrumentVersionId: version.id, aspectId: aspectIds.get(c.aspectCode) as string, code: c.code, nameId: `Karakteristik ${c.code}`, isContextual: c.isContextual, order: i + 1 } });
  }
  assessmentId = (
    await db.assessment.create({
      data: { organizationId: org.id, name: "Asesmen M10", scopeType: "CORPORATE", periodStart: new Date("2026-11-01"), periodEnd: new Date("2027-01-31"), targetLevel: 4, instrumentVersionId: version.id, status: "PANEL_REVIEW" },
    })
  ).id;
  unitA = (await db.unit.create({ data: { assessmentId, name: "Proyek A", type: "PROJECT" } })).id;
  unitB = (await db.unit.create({ data: { assessmentId, name: "Proyek B", type: "PROJECT" } })).id;
  await db.membership.createMany({
    data: [
      { userId: users[1]!.id, organizationId: org.id, role: "CLIENT_ADMIN" },
      { userId: users[2]!.id, organizationId: org.id, role: "UNIT_COORDINATOR", unitScope: [unitA] },
    ],
  });
  await db.scoreRun.create({
    data: { assessmentId, engineVersion: "1.0.0", inputSnapshot: {}, parameterSnapshot: { engine: params } as never, result: result as never, runById: users[0]!.id, isFinal: true, finalResult: result as never, finalizedAt: new Date(), finalizedById: users[0]!.id },
  });
  const base = { assessmentId, organizationId: org.id, unitScope: null };
  lead = { ...base, session: { user: { id: users[0]!.id } } as never, roles: ["LEAD_ASSESSOR"] };
  client = { ...base, session: { user: { id: users[1]!.id } } as never, roles: ["CLIENT_ADMIN"] };
  coordinator = { ...base, session: { user: { id: users[2]!.id } } as never, roles: ["UNIT_COORDINATOR"], unitScope: [unitA] };
  assessor = { ...base, session: { user: { id: users[3]!.id } } as never, roles: ["ASSESSOR"] };
});

afterAll(async () => {
  await db.$disconnect();
});

describe("daftar kesenjangan", () => {
  it("dibentuk dari ScoreRun final setelah status penyusunan rencana aksi, terurut bobot aspek dikali kesenjangan", async () => {
    await expect(plan.generateGapList(lead, meta)).rejects.toMatchObject({ code: "PLAN_CLOSED" });
    await db.assessment.update({ where: { id: assessmentId }, data: { status: "ACTION_PLANNING" } });
    expect(await plan.generateGapList(lead, meta)).toBe(18);
    const model = await plan.loadActionPlan(assessmentId, null);
    expect(model.gaps.map((g) => g.rank)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(model.gaps[0]).toMatchObject({ characteristic: { code: "K1.3" }, gap: 2, currentIndex: 2 });
    expect(model.gaps.slice(-2).every((g) => g.isContextual)).toBe(true);
  });

  it("analisis penyebab dan prioritas dipertahankan saat daftar diperbarui", async () => {
    const top = (await plan.loadActionPlan(assessmentId, null)).gaps[0]!;
    await plan.updateGapAnalysis(client, top.id, { rootCause: "Pekerja khawatir laporan berujung sanksi.", priority: "HIGH" }, meta);
    await plan.generateGapList(lead, meta);
    expect((await plan.loadActionPlan(assessmentId, null)).gaps[0]).toMatchObject({ rootCause: "Pekerja khawatir laporan berujung sanksi.", priority: "HIGH" });
    expect(await db.auditLog.count({ where: { assessmentId, action: "gap.generate" } })).toBe(2);
  });
});

describe("tindakan", () => {
  let gapId: string;
  let actionId: string;

  beforeAll(async () => {
    gapId = (await plan.loadActionPlan(assessmentId, null)).gaps[0]!.id;
  });

  it("koordinator unit hanya mengelola tindakan unitnya", async () => {
    await expect(plan.createAction(coordinator, gapId, action(), meta)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(plan.createAction(coordinator, gapId, action({ unitId: unitB }), meta)).rejects.toMatchObject({ code: "FORBIDDEN" });
    actionId = await plan.createAction(coordinator, gapId, action({ unitId: unitA, ownerEmail: "rina@contoh.test" }), meta);
    const other = await plan.createAction(client, gapId, action({ title: "Kampanye pelaporan di Proyek B", unitId: unitB }), meta);
    await expect(plan.addProgress(coordinator, other, progressSchema.parse({ note: "Mencoba memperbarui unit lain.", progressPercent: 10, status: "IN_PROGRESS" }), meta)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const scoped = await plan.loadActionPlan(assessmentId, [unitA]);
    expect(scoped.gaps[0]?.actions.map((a) => a.id)).toEqual([actionId]);
  });

  it("kemajuan, selesai, verifikasi asesor; tindakan terverifikasi terkunci", async () => {
    await expect(plan.verifyAction(assessor, actionId, { approve: true, note: "Belum selesai tetapi dicoba." }, meta)).rejects.toMatchObject({ code: "ACTION_NOT_DONE" });
    await plan.addProgress(coordinator, actionId, progressSchema.parse({ note: "Pelatihan tahap 1 untuk 40 pekerja.", progressPercent: 40, status: "IN_PROGRESS" }), meta);
    await plan.addProgress(coordinator, actionId, progressSchema.parse({ note: "Seluruh pekerja proyek sudah dilatih.", progressPercent: 90, status: "DONE" }), meta);
    let a = await db.actionItem.findUniqueOrThrow({ where: { id: actionId }, include: { updates: { orderBy: { createdAt: "asc" } } } });
    expect(a.status).toBe("DONE");
    expect(a.updates.map((u) => [u.progressPercent, u.status])).toEqual([
      [40, "IN_PROGRESS"],
      [100, "DONE"],
    ]);

    await plan.verifyAction(assessor, actionId, { approve: false, note: "Daftar hadir pelatihan belum diunggah." }, meta);
    expect((await db.actionItem.findUniqueOrThrow({ where: { id: actionId } })).status).toBe("IN_PROGRESS");
    await plan.addProgress(coordinator, actionId, progressSchema.parse({ note: "Daftar hadir sudah diunggah ke bukti.", progressPercent: 100, status: "DONE" }), meta);
    await plan.verifyAction(assessor, actionId, { approve: true, note: "Daftar hadir dan materi sesuai indikator." }, meta);
    a = await db.actionItem.findUniqueOrThrow({ where: { id: actionId }, include: { updates: true } });
    expect(a).toMatchObject({ status: "VERIFIED", verifiedById: assessor.session.user.id });
    await expect(plan.updateAction(coordinator, actionId, action({ unitId: unitA }), meta)).rejects.toMatchObject({ code: "ACTION_VERIFIED" });
    await expect(plan.addProgress(coordinator, actionId, progressSchema.parse({ note: "Perubahan setelah verifikasi.", progressPercent: 100, status: "DONE" }), meta)).rejects.toMatchObject({ code: "ACTION_VERIFIED" });
    expect(await db.auditLog.count({ where: { entityId: actionId, action: { in: ["action.create", "action.progress", "action.verify"] } } })).toBe(6);
  });
});

describe("penerbitan, ekspor, dan pengingat", () => {
  it("rencana aksi diterbitkan hanya bila setiap butir memiliki analisis dan tindakan", async () => {
    await expect(plan.publishActionPlan(lead, meta)).rejects.toMatchObject({ code: "ACTION_PLAN_INCOMPLETE" });
    const err = await plan.publishActionPlan(lead, meta).catch((e: { details?: { unmet?: string[] } }) => e);
    expect((err as { details: { unmet: string[] } }).details.unmet).toHaveLength(17);
    for (const g of (await plan.loadActionPlan(assessmentId, null)).gaps.slice(1)) {
      await plan.updateGapAnalysis(client, g.id, { rootCause: `Penyebab ${g.characteristic.code} sudah dianalisis.`, priority: "MEDIUM" }, meta);
      await plan.createAction(client, g.id, action({ title: `Tindakan ${g.characteristic.code}` }), meta);
    }
    await plan.publishActionPlan(lead, meta);
    expect((await db.assessment.findUniqueOrThrow({ where: { id: assessmentId } })).actionPlanPublishedAt).toBeInstanceOf(Date);
  });

  it("ekspor Excel memuat daftar, tindakan, dan riwayat tanpa surel penanggung jawab", async () => {
    const model = await plan.loadActionPlan(assessmentId, null);
    const l = messages.gaps;
    const bytes = await buildActionPlanWorkbook(model, { sheets: l.exportLabels.sheets, columns: l.exportLabels.columns, statuses: l.statuses, priorities: l.priorities, due: l.due, noUnit: l.fields.noUnit }, { A1: 4800 / 18000 });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(bytes) as never);
    expect(workbook.worksheets.map((w) => w.name)).toEqual(["Daftar kesenjangan", "Rencana aksi", "Riwayat pembaruan"]);
    expect(workbook.getWorksheet("Daftar kesenjangan")?.rowCount).toBe(19);
    expect(workbook.getWorksheet("Rencana aksi")?.rowCount).toBe(1 + 19);
    // Tiga pembaruan kemajuan dan dua keputusan verifikasi.
    expect(workbook.getWorksheet("Riwayat pembaruan")?.rowCount).toBe(1 + 5);
    const all = workbook.worksheets.flatMap((w) => w.getSheetValues().flat().map(String));
    expect(all.some((v) => v.includes("rina@contoh.test"))).toBe(false);
  });

  it("pengingat tenggat ke penanggung jawab, administrator klien, dan koordinator unit; paling sering seminggu sekali", async () => {
    const id = await plan.createAction(client, (await plan.loadActionPlan(assessmentId, null)).gaps[2]!.id, action({ title: "Audit internal rambu", unitId: unitA, ownerEmail: "Pemilik@Contoh.test", dueDate: "2027-03-12" }), meta);
    const sent: { to: string; subject: string; text: string }[] = [];
    const deps = { send: async (m: { to: string; subject: string; text: string }) => void sent.push(m), baseUrl: "https://nscas.contoh.test" };
    const now = new Date("2027-03-10T00:00:00Z");
    expect(await deliverActionReminder({ actionId: id }, deps, now)).toBe("SENT");
    expect(sent.map((m) => m.to).sort()).toEqual([`ca-m10-${suffix}@contoh.test`, "pemilik@contoh.test", `uc-m10-${suffix}@contoh.test`]);
    expect(sent[0]?.subject).toBe("Pengingat tenggat tindakan keselamatan dan kesehatan kerja: Audit internal rambu");
    expect(sent[0]?.text).toContain("jatuh pada 12 Maret 2027");
    expect(sent[0]?.text).toContain(`https://nscas.contoh.test/assessments/${assessmentId}/gaps`);
    expect(await deliverActionReminder({ actionId: id }, deps, new Date("2027-03-12T00:00:00Z"))).toBe("SKIPPED");
    expect(await deliverActionReminder({ actionId: id }, deps, new Date("2027-03-17T01:00:00Z"))).toBe("SENT");
    expect(sent.at(-1)?.text).toContain("sudah melewati tenggat 12 Maret 2027");
    expect(await db.auditLog.count({ where: { entityId: id, action: "action.reminder_sent" } })).toBe(2);
  });
});
