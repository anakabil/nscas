import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { AssessmentStatus, Role, TokenKind } from "@/generated/prisma/enums";
import { AssessmentRuleError } from "@/lib/assessments/service";
import { logAudit, type RequestMeta } from "@/lib/audit";
import type { SessionContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { enqueue, QUEUES } from "@/lib/jobs/boss";
import { appUrl } from "@/lib/mail";
import { decryptField, encryptField, fieldContext } from "@/lib/privacy/crypto";
import { generateToken, hashToken, surveyLink, unitQrLink } from "@/lib/privacy/tokens";
import { normalizeKey, readRosterFile, validateRoster, type RosterValidation } from "./roster-file";

// Manajemen responden dan distribusi token (docs/01 M2, docs/04 bagian 3). Pemanggil wajib sudah lolos
// requireRole; akses koordinator unit dibatasi oleh access.unitScope. Partisipasi selalu dihitung dari
// AccessToken.completedAt, tidak pernah dari SurveyResponse (docs/02 bagian 4).

type Tx = Prisma.TransactionClient;

export interface RespondentActor {
  session: SessionContext;
  assessmentId: string;
  organizationId: string;
  roles: Role[];
  unitScope: string[] | null;
}

function actorOf(actor: RespondentActor) {
  return { id: actor.session.user.id, role: actor.roles[0] ?? null };
}

/** Daftar responden dan token dikelola setelah konfigurasi dikunci dan selama pengumpulan data. */
const DISTRIBUTION_STATUSES: readonly AssessmentStatus[] = ["LOCKED", "DATA_COLLECTION"];

async function lockForDistribution(tx: Tx, assessmentId: string): Promise<AssessmentStatus> {
  const rows = await tx.$queryRaw<{ status: AssessmentStatus }[]>`
    SELECT "status" FROM "Assessment" WHERE "id" = ${assessmentId} FOR UPDATE`;
  const status = rows[0]?.status;
  if (!status) throw new AssessmentRuleError(404, "NOT_FOUND");
  if (!DISTRIBUTION_STATUSES.includes(status)) throw new AssessmentRuleError(409, "DISTRIBUTION_CLOSED", { status });
  return status;
}

const emailContext = (id: string) => fieldContext("RosterEntry", "emailEnc", id);
const phoneContext = (id: string) => fieldContext("RosterEntry", "phoneEnc", id);

export function decryptRosterEmail(entry: { id: string; emailEnc: string | null }): string | null {
  return entry.emailEnc ? decryptField(entry.emailEnc, emailContext(entry.id)) : null;
}

export function decryptRosterPhone(entry: { id: string; phoneEnc: string | null }): string | null {
  return entry.phoneEnc ? decryptField(entry.phoneEnc, phoneContext(entry.id)) : null;
}

/** Token dianggap terpakai bila belum dicabut (aktif atau sudah selesai); responden tersebut tidak diberi token baru. */
const usableToken = { revokedAt: null } satisfies Prisma.AccessTokenWhereInput;

export async function createAccessToken(
  tx: Tx,
  data: {
    assessmentId: string;
    unitId: string;
    stratumId: string | null;
    rosterEntryId: string | null;
    kind: TokenKind;
    channel: "EMAIL" | "LINK" | "QR" | null;
    unitQrCodeId?: string | null;
    reminderCount?: number;
    lastReminderAt?: Date | null;
  },
): Promise<{ id: string; raw: string }> {
  const raw = generateToken();
  const token = await tx.accessToken.create({ data: { ...data, tokenHash: hashToken(raw) }, select: { id: true } });
  return { id: token.id, raw };
}

// ---------------------------------------------------------------------------
// Impor daftar responden
// ---------------------------------------------------------------------------

export interface ImportSummary {
  validation: RosterValidation;
  byUnit: { unitId: string; name: string; count: number }[];
  byStratum: { stratumId: string; code: string; count: number }[];
}

export type ImportResult =
  | { ok: true; imported: number; summary: ImportSummary }
  | { ok: false; error: "FILE_TYPE" | "FILE_EMPTY" | "FILE_UNREADABLE" | "FILE_TOO_LARGE" }
  | { ok: false; error: "INVALID_ROWS"; summary: ImportSummary };

async function buildLookups(tx: Tx, actor: RespondentActor) {
  // Berurutan: satu transaksi memakai satu koneksi, sehingga kueri tidak boleh berjalan bersamaan.
  const units = await tx.unit.findMany({ where: { assessmentId: actor.assessmentId }, select: { id: true, name: true } });
  const strata = await tx.stratum.findMany({ where: { assessmentId: actor.assessmentId }, select: { id: true, code: true, name: true, isContractor: true } });
  const existing = await tx.rosterEntry.findMany({ where: { assessmentId: actor.assessmentId }, select: { id: true, employeeNo: true, emailEnc: true } });
  const strataMap = new Map<string, { id: string; isContractor: boolean }>();
  for (const s of strata) {
    strataMap.set(normalizeKey(s.code), s);
    strataMap.set(normalizeKey(s.name), s);
  }
  return {
    units,
    strata,
    lookups: {
      units: new Map(units.map((u) => [normalizeKey(u.name), { id: u.id }])),
      strata: strataMap,
      unitScope: actor.unitScope ? new Set(actor.unitScope) : null,
      existingEmployeeNos: new Set(existing.flatMap((e) => (e.employeeNo ? [e.employeeNo.toLowerCase()] : []))),
      existingEmails: new Set(existing.flatMap((e) => (e.emailEnc ? [decryptRosterEmail(e) as string] : []))),
    },
  };
}

function summarize(validation: RosterValidation, units: { id: string; name: string }[], strata: { id: string; code: string }[]): ImportSummary {
  const count = <K extends string>(key: (r: (typeof validation.valid)[number]) => K) =>
    validation.valid.reduce((m, r) => m.set(key(r), (m.get(key(r)) ?? 0) + 1), new Map<K, number>());
  const byUnit = count((r) => r.unitId);
  const byStratum = count((r) => r.stratumId);
  return {
    validation,
    byUnit: units.filter((u) => byUnit.has(u.id)).map((u) => ({ unitId: u.id, name: u.name, count: byUnit.get(u.id) as number })),
    byStratum: strata.filter((s) => byStratum.has(s.id)).map((s) => ({ stratumId: s.id, code: s.code, count: byStratum.get(s.id) as number })),
  };
}

/**
 * Pratinjau (commit = false) atau impor (commit = true). Impor hanya dilakukan bila seluruh baris valid;
 * berkas dibaca dan divalidasi ulang di server pada saat impor, bukan memakai hasil pratinjau dari peramban.
 */
export async function importRoster(actor: RespondentActor, bytes: Uint8Array, commit: boolean, meta: RequestMeta): Promise<ImportResult> {
  const file = await readRosterFile(bytes);
  if ("error" in file) return { ok: false, error: file.error };

  const db = getDb();
  return db.$transaction(
    async (tx) => {
      await lockForDistribution(tx, actor.assessmentId);
      const { units, strata, lookups } = await buildLookups(tx, actor);
      const validation = validateRoster(file.rows, lookups);
      const summary = summarize(validation, units, strata);
      const invalid = validation.missingColumns.length > 0 || validation.tooManyRows || validation.errors.length > 0 || validation.valid.length === 0;
      if (!commit || invalid) {
        return invalid ? { ok: false as const, error: "INVALID_ROWS" as const, summary } : { ok: true as const, imported: 0, summary };
      }

      const rows = validation.valid.map((r) => {
        const id = randomUUID();
        return {
          id,
          assessmentId: actor.assessmentId,
          unitId: r.unitId,
          stratumId: r.stratumId,
          fullName: r.fullName,
          employeeNo: r.employeeNo,
          // Kontak dienkripsi AES-256-GCM dan diikat ke baris (docs/04 bagian 4).
          emailEnc: r.email ? encryptField(r.email, emailContext(id)) : null,
          phoneEnc: r.phone ? encryptField(r.phone, phoneContext(id)) : null,
          isContractor: r.isContractor,
        };
      });
      for (let i = 0; i < rows.length; i += 1000) await tx.rosterEntry.createMany({ data: rows.slice(i, i + 1000) });

      await logAudit(tx, {
        action: "roster.import",
        entityType: "Assessment",
        entityId: actor.assessmentId,
        actor: actorOf(actor),
        organizationId: actor.organizationId,
        assessmentId: actor.assessmentId,
        after: {
          imported: rows.length,
          withEmail: rows.filter((r) => r.emailEnc).length,
          byUnit: Object.fromEntries(summary.byUnit.map((u) => [u.name, u.count])),
          byStratum: Object.fromEntries(summary.byStratum.map((s) => [s.code, s.count])),
        },
        meta,
      });
      return { ok: true as const, imported: rows.length, summary };
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}

// ---------------------------------------------------------------------------
// Daftar responden
// ---------------------------------------------------------------------------

export type TokenState = "NONE" | "ISSUED" | "REVOKED";

export async function listRoster(actor: RespondentActor, query: { page: number; search?: string; unitId?: string | null }) {
  const pageSize = 50;
  const where: Prisma.RosterEntryWhereInput = {
    assessmentId: actor.assessmentId,
    ...(actor.unitScope ? { unitId: { in: actor.unitScope } } : {}),
    ...(query.unitId ? { unitId: query.unitId } : {}),
    ...(query.search
      ? { OR: [{ fullName: { contains: query.search, mode: "insensitive" } }, { employeeNo: { contains: query.search, mode: "insensitive" } }] }
      : {}),
  };
  const db = getDb();
  const [total, rows] = await Promise.all([
    db.rosterEntry.count({ where }),
    db.rosterEntry.findMany({
      where,
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
      skip: (query.page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        fullName: true,
        employeeNo: true,
        emailEnc: true,
        phoneEnc: true,
        isContractor: true,
        unit: { select: { name: true } },
        stratum: { select: { code: true } },
        accessTokens: { where: { kind: "SURVEY" }, select: { revokedAt: true }, orderBy: { issuedAt: "desc" }, take: 1 },
      },
    }),
  ]);
  return {
    total,
    pageSize,
    rows: rows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      employeeNo: r.employeeNo,
      email: decryptRosterEmail(r),
      phone: decryptRosterPhone(r),
      isContractor: r.isContractor,
      unitName: r.unit.name,
      stratumCode: r.stratum.code,
      // Status selesai sengaja tidak ditampilkan per orang; partisipasi hanya disajikan agregat.
      tokenState: (r.accessTokens[0] ? (r.accessTokens[0].revokedAt ? "REVOKED" : "ISSUED") : "NONE") as TokenState,
    })),
  };
}

// ---------------------------------------------------------------------------
// Penerbitan tautan, undangan, pencabutan
// ---------------------------------------------------------------------------

export interface IssuedLink {
  fullName: string;
  employeeNo: string | null;
  unitName: string;
  stratumCode: string;
  link: string;
}

function scopeWhere(actor: RespondentActor, unitId: string | null): Prisma.RosterEntryWhereInput {
  if (unitId && actor.unitScope && !actor.unitScope.includes(unitId)) throw new AssessmentRuleError(403, "FORBIDDEN");
  return {
    assessmentId: actor.assessmentId,
    ...(actor.unitScope ? { unitId: { in: actor.unitScope } } : {}),
    ...(unitId ? { unitId } : {}),
  };
}

/**
 * Menerbitkan token survei untuk responden yang belum memiliki token terpakai. Token mentah hanya
 * dikembalikan sekali ini (untuk ditampilkan dan diekspor ke CSV); basis data menyimpan hash.
 */
export async function issueSurveyLinks(
  actor: RespondentActor,
  input: { unitId: string | null; onlyWithoutEmail: boolean },
  meta: RequestMeta,
): Promise<IssuedLink[]> {
  const base = appUrl();
  return getDb().$transaction(
    async (tx) => {
      await lockForDistribution(tx, actor.assessmentId);
      const entries = await tx.rosterEntry.findMany({
        where: {
          ...scopeWhere(actor, input.unitId),
          ...(input.onlyWithoutEmail ? { emailEnc: null } : {}),
          accessTokens: { none: { kind: "SURVEY", ...usableToken } },
        },
        select: { id: true, fullName: true, employeeNo: true, unitId: true, stratumId: true, unit: { select: { name: true } }, stratum: { select: { code: true } } },
        orderBy: [{ unit: { name: "asc" } }, { fullName: "asc" }],
      });
      const links: IssuedLink[] = [];
      for (const e of entries) {
        const { raw } = await createAccessToken(tx, {
          assessmentId: actor.assessmentId,
          unitId: e.unitId,
          stratumId: e.stratumId,
          rosterEntryId: e.id,
          kind: "SURVEY",
          channel: "LINK",
        });
        links.push({ fullName: e.fullName, employeeNo: e.employeeNo, unitName: e.unit.name, stratumCode: e.stratum.code, link: surveyLink(base, raw) });
      }
      if (links.length > 0) {
        await logAudit(tx, {
          action: "token.issue",
          entityType: "Assessment",
          entityId: actor.assessmentId,
          actor: actorOf(actor),
          organizationId: actor.organizationId,
          assessmentId: actor.assessmentId,
          after: { channel: "link", count: links.length, unitId: input.unitId, onlyWithoutEmail: input.onlyWithoutEmail },
          meta,
        });
      }
      return links;
    },
    { timeout: 120_000 },
  );
}

/** Mengantre surel undangan; token dibuat oleh worker saat surel dikirim sehingga token mentah tidak pernah disimpan. */
export async function queueInvitations(actor: RespondentActor, input: { unitId: string | null }, meta: RequestMeta): Promise<number> {
  return getDb().$transaction(
    async (tx) => {
      await lockForDistribution(tx, actor.assessmentId);
      const entries = await tx.rosterEntry.findMany({
        where: { ...scopeWhere(actor, input.unitId), emailEnc: { not: null }, accessTokens: { none: { kind: "SURVEY", ...usableToken } } },
        select: { id: true },
      });
      for (const e of entries) {
        await enqueue(tx, QUEUES.invitationSend, { assessmentId: actor.assessmentId, rosterEntryId: e.id }, { singletonKey: `invite:${e.id}` });
      }
      if (entries.length > 0) {
        await logAudit(tx, {
          action: "invitation.queue",
          entityType: "Assessment",
          entityId: actor.assessmentId,
          actor: actorOf(actor),
          organizationId: actor.organizationId,
          assessmentId: actor.assessmentId,
          after: { count: entries.length, unitId: input.unitId },
          meta,
        });
      }
      return entries.length;
    },
    { timeout: 120_000 },
  );
}

async function loadEntry(tx: Tx, actor: RespondentActor, rosterEntryId: string) {
  const entry = await tx.rosterEntry.findFirst({
    where: { id: rosterEntryId, ...scopeWhere(actor, null) },
    select: {
      id: true,
      fullName: true,
      employeeNo: true,
      emailEnc: true,
      unitId: true,
      stratumId: true,
      unit: { select: { name: true } },
      stratum: { select: { code: true } },
      accessTokens: { where: { kind: "SURVEY", revokedAt: null }, select: { id: true, completedAt: true } },
    },
  });
  if (!entry) throw new AssessmentRuleError(404, "NOT_FOUND");
  return entry;
}

export async function revokeSurveyToken(actor: RespondentActor, rosterEntryId: string, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await lockForDistribution(tx, actor.assessmentId);
    const entry = await loadEntry(tx, actor, rosterEntryId);
    const active = entry.accessTokens.filter((t) => !t.completedAt);
    if (active.length === 0) throw new AssessmentRuleError(422, "NO_ACTIVE_TOKEN");
    await tx.accessToken.updateMany({ where: { id: { in: active.map((t) => t.id) } }, data: { revokedAt: new Date(), revokedReason: "MANUAL" } });
    await logAudit(tx, {
      action: "token.revoke",
      entityType: "RosterEntry",
      entityId: entry.id,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      after: { tokens: active.length },
      meta,
    });
  });
}

/**
 * Penerbitan ulang: token aktif dicabut lalu token baru diterbitkan sebagai tautan (dikembalikan sekali)
 * atau dikirim lewat surel oleh worker. Ditolak bila responden sudah menyelesaikan survei.
 */
export async function reissueSurveyToken(
  actor: RespondentActor,
  rosterEntryId: string,
  channel: "link" | "email",
  meta: RequestMeta,
): Promise<IssuedLink | null> {
  const base = appUrl();
  return getDb().$transaction(async (tx) => {
    await lockForDistribution(tx, actor.assessmentId);
    const entry = await loadEntry(tx, actor, rosterEntryId);
    if (entry.accessTokens.some((t) => t.completedAt)) throw new AssessmentRuleError(422, "TOKEN_ALREADY_USED");
    if (channel === "email" && !entry.emailEnc) throw new AssessmentRuleError(422, "NO_EMAIL");
    if (entry.accessTokens.length > 0) {
      await tx.accessToken.updateMany({ where: { id: { in: entry.accessTokens.map((t) => t.id) } }, data: { revokedAt: new Date(), revokedReason: "REISSUED" } });
    }
    let link: IssuedLink | null = null;
    if (channel === "link") {
      const { raw } = await createAccessToken(tx, { assessmentId: actor.assessmentId, unitId: entry.unitId, stratumId: entry.stratumId, rosterEntryId: entry.id, kind: "SURVEY", channel: "LINK" });
      link = { fullName: entry.fullName, employeeNo: entry.employeeNo, unitName: entry.unit.name, stratumCode: entry.stratum.code, link: surveyLink(base, raw) };
    } else {
      await enqueue(tx, QUEUES.invitationSend, { assessmentId: actor.assessmentId, rosterEntryId: entry.id }, { singletonKey: `invite:${entry.id}:${Date.now()}` });
    }
    await logAudit(tx, {
      action: "token.reissue",
      entityType: "RosterEntry",
      entityId: entry.id,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      after: { channel, revoked: entry.accessTokens.length },
      meta,
    });
    return link;
  });
}

// ---------------------------------------------------------------------------
// Kode QR unit untuk pekerja penyedia jasa tanpa surel
// ---------------------------------------------------------------------------

export const qrInputSchema = z.object({
  unitId: z.string().min(1).max(64),
  maxIssuance: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(100_000)])
    .transform((v) => (v === "" ? null : v)),
});

/** Membuat kode QR baru untuk unit; kode lama unit itu dinonaktifkan. Kode mentah hanya dikembalikan sekali. */
export async function createUnitQrCode(
  actor: RespondentActor,
  input: z.output<typeof qrInputSchema>,
  meta: RequestMeta,
): Promise<{ id: string; link: string; unitName: string }> {
  const base = appUrl();
  return getDb().$transaction(async (tx) => {
    await lockForDistribution(tx, actor.assessmentId);
    const unit = await tx.unit.findFirst({ where: { id: input.unitId, assessmentId: actor.assessmentId }, select: { id: true, name: true } });
    if (!unit) throw new AssessmentRuleError(404, "NOT_FOUND");
    const deactivated = await tx.unitQrCode.updateMany({ where: { assessmentId: actor.assessmentId, unitId: unit.id, isActive: true }, data: { isActive: false } });
    const raw = generateToken();
    const qr = await tx.unitQrCode.create({
      data: { assessmentId: actor.assessmentId, unitId: unit.id, codeHash: hashToken(raw), maxIssuance: input.maxIssuance },
      select: { id: true },
    });
    await logAudit(tx, {
      action: "qr.create",
      entityType: "UnitQrCode",
      entityId: qr.id,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      after: { unitId: unit.id, maxIssuance: input.maxIssuance, previousDeactivated: deactivated.count },
      meta,
    });
    return { id: qr.id, link: unitQrLink(base, raw), unitName: unit.name };
  });
}

export async function deactivateUnitQrCode(actor: RespondentActor, qrId: string, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const qr = await tx.unitQrCode.findFirst({ where: { id: qrId, assessmentId: actor.assessmentId }, select: { id: true, isActive: true } });
    if (!qr) throw new AssessmentRuleError(404, "NOT_FOUND");
    if (!qr.isActive) return;
    await tx.unitQrCode.update({ where: { id: qr.id }, data: { isActive: false } });
    await logAudit(tx, {
      action: "qr.deactivate",
      entityType: "UnitQrCode",
      entityId: qr.id,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      meta,
    });
  });
}

export type QrScanResult =
  | { ok: true; raw: string; qrId: string; reused: boolean }
  | { ok: false; reason: "INVALID" | "CLOSED" | "LIMIT" };

export function isSurveyOpen(a: { status: AssessmentStatus; surveyOpensAt: Date | null; surveyClosesAt: Date | null }, now: Date): boolean {
  return a.status === "DATA_COLLECTION" && (!a.surveyOpensAt || a.surveyOpensAt <= now) && (!a.surveyClosesAt || a.surveyClosesAt > now);
}

/**
 * Pemindaian kode QR unit: menerbitkan token survei sekali pakai tanpa daftar responden. Strata dipilih
 * responden dari daftar tertutup di halaman survei. Bila perangkat yang sama masih menyimpan token dari
 * pemindaian sebelumnya yang belum selesai, token itu dipakai ulang agar satu orang tidak menghabiskan
 * kuota. Tidak mencatat alamat IP maupun jejak audit per pemindaian.
 */
export async function issueTokenFromQr(rawCode: string, previousRaw: string | null, now: Date = new Date()): Promise<QrScanResult> {
  return getDb().$transaction(async (tx) => {
    const qr = await tx.unitQrCode.findUnique({
      where: { codeHash: hashToken(rawCode) },
      select: { id: true, isActive: true, unitId: true, maxIssuance: true, assessment: { select: { id: true, status: true, surveyOpensAt: true, surveyClosesAt: true } } },
    });
    if (!qr || !qr.isActive) return { ok: false, reason: "INVALID" };
    if (!isSurveyOpen(qr.assessment, now)) return { ok: false, reason: "CLOSED" };

    if (previousRaw) {
      const previous = await tx.accessToken.findUnique({
        where: { tokenHash: hashToken(previousRaw) },
        select: { unitQrCodeId: true, revokedAt: true, completedAt: true },
      });
      if (previous && previous.unitQrCodeId === qr.id && !previous.revokedAt && !previous.completedAt) {
        return { ok: true, raw: previousRaw, qrId: qr.id, reused: true };
      }
    }

    // Mengunci baris kode QR agar batas penerbitan tidak terlampaui oleh pemindaian bersamaan.
    await tx.$queryRaw`SELECT "id" FROM "UnitQrCode" WHERE "id" = ${qr.id} FOR UPDATE`;
    if (qr.maxIssuance !== null && (await tx.accessToken.count({ where: { unitQrCodeId: qr.id } })) >= qr.maxIssuance) {
      return { ok: false, reason: "LIMIT" };
    }
    const { raw } = await createAccessToken(tx, {
      assessmentId: qr.assessment.id,
      unitId: qr.unitId,
      stratumId: null,
      rosterEntryId: null,
      kind: "SURVEY",
      channel: "QR",
      unitQrCodeId: qr.id,
    });
    return { ok: true, raw, qrId: qr.id, reused: false };
  });
}

// ---------------------------------------------------------------------------
// Jendela survei
// ---------------------------------------------------------------------------

/** Isian datetime-local dibaca sebagai waktu WIB (UTC+7). */
const wibDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  .transform((v) => new Date(`${v}:00+07:00`));

export const surveyWindowSchema = z
  .object({ opensAt: wibDateTime, closesAt: wibDateTime })
  .refine((w) => w.closesAt > w.opensAt, { message: "WINDOW_ORDER", path: ["closesAt"] });

export async function setSurveyWindow(actor: RespondentActor, input: z.output<typeof surveyWindowSchema>, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await lockForDistribution(tx, actor.assessmentId);
    const before = await tx.assessment.findUniqueOrThrow({ where: { id: actor.assessmentId }, select: { surveyOpensAt: true, surveyClosesAt: true } });
    await tx.assessment.update({ where: { id: actor.assessmentId }, data: { surveyOpensAt: input.opensAt, surveyClosesAt: input.closesAt } });
    await logAudit(tx, {
      action: "assessment.survey_window",
      entityType: "Assessment",
      entityId: actor.assessmentId,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      before: { opensAt: before.surveyOpensAt?.toISOString() ?? null, closesAt: before.surveyClosesAt?.toISOString() ?? null },
      after: { opensAt: input.opensAt.toISOString(), closesAt: input.closesAt.toISOString() },
      meta,
    });
  });
}
