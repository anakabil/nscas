import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { AssessmentStatus, Role } from "@/generated/prisma/enums";
import { AssessmentRuleError } from "@/lib/assessments/service";
import { logAudit, type RequestMeta } from "@/lib/audit";
import type { SessionContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { detectFileType, EVIDENCE_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/lib/files/content-type";
import { issueUploadTicket, readUploadTicket } from "@/lib/files/upload-ticket";
import { uploadRateLimiter } from "@/lib/rate-limit";
import { deleteObject, inspectObject, presignUpload } from "@/lib/storage";
import { buildChecklist, DEFAULT_MIN_EVIDENCE_TYPES } from "./rules";

// Penyimpanan bukti (docs/01 M5, docs/02 bagian 5). Berkas diunggah langsung dari peramban ke penyimpanan
// objek; server hanya menerima catatan bukti setelah ukuran, jenis berdasarkan isi, dan SHA-256 diverifikasi.

type Tx = Prisma.TransactionClient;

export interface EvidenceActor {
  session: SessionContext;
  assessmentId: string;
  organizationId: string;
  roles: Role[];
  unitScope: string[] | null;
}

/** Bukti dapat diunggah sejak konfigurasi dikunci sampai rapat panel, karena panel dapat meminta bukti tambahan. */
const UPLOAD_STATUSES: readonly AssessmentStatus[] = ["LOCKED", "DATA_COLLECTION", "SCORING", "PANEL_REVIEW"];

const actorOf = (a: EvidenceActor) => ({ id: a.session.user.id, role: a.roles[0] ?? null });

async function assertUploadStatus(db: Pick<Tx, "assessment">, assessmentId: string) {
  const a = await db.assessment.findUniqueOrThrow({ where: { id: assessmentId }, select: { status: true } });
  if (!UPLOAD_STATUSES.includes(a.status)) throw new AssessmentRuleError(409, "EVIDENCE_CLOSED", { status: a.status });
}

function assertUnit(actor: EvidenceActor, unitId: string | null) {
  // Koordinator unit hanya mengunggah untuk unitnya; bukti tingkat organisasi (tanpa unit) oleh administrator.
  if (actor.unitScope && (!unitId || !actor.unitScope.includes(unitId))) throw new AssessmentRuleError(403, "FORBIDDEN");
}

/** Bukti yang dapat dilihat pelaku: koordinator unit hanya bukti unitnya. */
export function evidenceScope(assessmentId: string, unitScope: string[] | null): Prisma.EvidenceItemWhereInput {
  return { assessmentId, ...(unitScope ? { unitId: { in: unitScope } } : {}) };
}

const EXTENSION_GROUPS: Record<string, string[]> = { jpg: ["jpg", "jpeg"], heic: ["heic", "heif"] };

function declaredExtension(fileName: string): string {
  const ext = fileName.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1] ?? "";
  return ext;
}

export const uploadRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  size: z.number().int().min(1),
  contentType: z.string().max(200),
  title: z.string().trim().min(2).max(300),
  description: z.string().trim().max(2000).optional().default(""),
  unitId: z.string().min(1).max(64).nullable(),
  supersedesId: z.string().min(1).max(64).nullable(),
});

export type UploadRequest = z.output<typeof uploadRequestSchema>;

export interface UploadGrant {
  url: string;
  headers: Record<string, string>;
  ticket: string;
}

export async function requestEvidenceUpload(actor: EvidenceActor, input: UploadRequest): Promise<UploadGrant> {
  if (!uploadRateLimiter.consume(actor.session.user.id).allowed) throw new AssessmentRuleError(429, "RATE_LIMITED");
  if (input.size > MAX_UPLOAD_BYTES) throw new AssessmentRuleError(413, "FILE_TOO_LARGE");
  const db = getDb();
  await assertUploadStatus(db, actor.assessmentId);

  let unitId = input.unitId;
  if (input.supersedesId) {
    const previous = await db.evidenceItem.findFirst({
      where: { id: input.supersedesId, ...evidenceScope(actor.assessmentId, actor.unitScope), deletedAt: null, supersededBy: null },
      select: { unitId: true },
    });
    if (!previous) throw new AssessmentRuleError(404, "NOT_FOUND");
    unitId = previous.unitId;
  } else if (unitId && !(await db.unit.findFirst({ where: { id: unitId, assessmentId: actor.assessmentId }, select: { id: true } }))) {
    throw new AssessmentRuleError(404, "NOT_FOUND");
  }
  assertUnit(actor, unitId);

  const ext = declaredExtension(input.fileName);
  const key = `${actor.organizationId}/${actor.assessmentId}/evidence/${randomUUID()}${ext ? `.${ext}` : ""}`;
  // Jenis yang dinyatakan peramban hanya dipakai untuk header unggah; jenis sebenarnya diperiksa dari isi.
  const contentType = (EVIDENCE_MIME_TYPES as readonly string[]).includes(input.contentType) ? input.contentType : "application/octet-stream";
  const { url, headers } = await presignUpload(key, contentType, input.size);
  const ticket = issueUploadTicket({
    kind: "evidence",
    key,
    userId: actor.session.user.id,
    assessmentId: actor.assessmentId,
    declaredSize: input.size,
    fileName: input.fileName,
    data: { title: input.title, description: input.description, unitId, supersedesId: input.supersedesId },
  });
  return { url, headers, ticket };
}

export const linksSchema = z
  .array(z.object({ characteristicId: z.string().min(1).max(64), requirementIds: z.array(z.string().min(1).max(64)).max(20) }))
  .max(100);

export type EvidenceLinkInput = z.output<typeof linksSchema>;

/** Memvalidasi karakteristik dan butir daftar periksa terhadap versi instrumen asesmen. */
async function validLinks(tx: Tx, assessmentId: string, links: EvidenceLinkInput) {
  const { instrumentVersionId } = await tx.assessment.findUniqueOrThrow({ where: { id: assessmentId }, select: { instrumentVersionId: true } });
  const ids = [...new Set(links.map((l) => l.characteristicId))];
  const characteristics = await tx.characteristic.findMany({
    where: { id: { in: ids }, instrumentVersionId },
    select: { id: true, code: true, evidenceRequirements: { select: { id: true } } },
  });
  if (characteristics.length !== ids.length) throw new AssessmentRuleError(422, "UNKNOWN_ITEM");
  return ids.map((id) => {
    const c = characteristics.find((x) => x.id === id) as (typeof characteristics)[number];
    const requested = new Set(links.filter((l) => l.characteristicId === id).flatMap((l) => l.requirementIds));
    const allowed = new Set(c.evidenceRequirements.map((r) => r.id));
    if ([...requested].some((r) => !allowed.has(r))) throw new AssessmentRuleError(422, "UNKNOWN_ITEM");
    return { characteristicId: id, code: c.code, requirementIds: [...requested] };
  });
}

export type FinalizeResult = { id: string; version: number };

/**
 * Menyelesaikan unggahan: objek diperiksa (ada, ukuran sama dengan yang dinyatakan dan paling besar 25 MB,
 * jenis dari isi termasuk yang diizinkan dan sesuai ekstensi), SHA-256 dihitung, lalu catatan bukti dibuat.
 * Berkas yang gagal diperiksa dihapus dari penyimpanan objek.
 */
export async function finalizeEvidenceUpload(actor: EvidenceActor, rawTicket: string, links: EvidenceLinkInput | null, meta: RequestMeta): Promise<FinalizeResult> {
  const ticket = readUploadTicket(rawTicket, { kind: "evidence", userId: actor.session.user.id, assessmentId: actor.assessmentId });
  if (!ticket) throw new AssessmentRuleError(400, "UPLOAD_EXPIRED");
  const inspected = await inspectObject(ticket.key, MAX_UPLOAD_BYTES);
  if (!inspected) throw new AssessmentRuleError(422, "UPLOAD_MISSING");
  const reject = async (code: string, status: 413 | 422 = 422): Promise<never> => {
    await deleteObject(ticket.key).catch(() => undefined);
    throw new AssessmentRuleError(status, code);
  };
  if (inspected.size > MAX_UPLOAD_BYTES) return reject("FILE_TOO_LARGE", 413);
  if (inspected.size !== ticket.declaredSize) return reject("FILE_SIZE_MISMATCH");
  const detected = detectFileType(inspected.head, ticket.fileName);
  if (!detected || !(EVIDENCE_MIME_TYPES as readonly string[]).includes(detected.mime)) return reject("EVIDENCE_FILE_TYPE");
  const declared = declaredExtension(ticket.fileName);
  if (declared && !(EXTENSION_GROUPS[detected.ext] ?? [detected.ext]).includes(declared)) return reject("EVIDENCE_FILE_TYPE");

  const data = ticket.data as { title: string; description: string; unitId: string | null; supersedesId: string | null };
  try {
    return await getDb().$transaction(async (tx) => {
      await assertUploadStatus(tx, actor.assessmentId);
      assertUnit(actor, data.unitId);
      let version = 1;
      let inherited: EvidenceLinkInput = [];
      if (data.supersedesId) {
        const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "EvidenceItem" WHERE "id" = ${data.supersedesId} FOR UPDATE`;
        const previous = locked.length
          ? await tx.evidenceItem.findFirst({
              where: { id: data.supersedesId, assessmentId: actor.assessmentId, deletedAt: null, supersededBy: null },
              select: { version: true, links: { select: { characteristicId: true, requirementIds: true } } },
            })
          : null;
        if (!previous) throw new AssessmentRuleError(409, "EVIDENCE_SUPERSEDED");
        version = previous.version + 1;
        inherited = previous.links;
      }
      const resolved = await validLinks(tx, actor.assessmentId, links ?? inherited);
      const item = await tx.evidenceItem.create({
        data: {
          assessmentId: actor.assessmentId,
          unitId: data.unitId,
          title: data.title,
          description: data.description || null,
          storageKey: ticket.key,
          sha256: inspected.sha256,
          mimeType: detected.mime,
          sizeBytes: inspected.size,
          version,
          supersedesId: data.supersedesId,
          uploadedById: actor.session.user.id,
          links: { create: resolved.map((l) => ({ characteristicId: l.characteristicId, requirementIds: l.requirementIds })) },
        },
        select: { id: true },
      });
      await logAudit(tx, {
        action: data.supersedesId ? "evidence.version" : "evidence.upload",
        entityType: "EvidenceItem",
        entityId: item.id,
        actor: actorOf(actor),
        organizationId: actor.organizationId,
        assessmentId: actor.assessmentId,
        after: {
          title: data.title,
          fileName: ticket.fileName,
          sha256: inspected.sha256,
          mimeType: detected.mime,
          sizeBytes: inspected.size,
          version,
          supersedesId: data.supersedesId,
          unitId: data.unitId,
          characteristics: resolved.map((l) => l.code),
        },
        meta,
      });
      return { id: item.id, version };
    });
  } catch (error) {
    await deleteObject(ticket.key).catch(() => undefined);
    throw error;
  }
}

export async function updateEvidenceLinks(actor: EvidenceActor, evidenceId: string, links: EvidenceLinkInput, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await assertUploadStatus(tx, actor.assessmentId);
    const item = await tx.evidenceItem.findFirst({
      where: { id: evidenceId, ...evidenceScope(actor.assessmentId, actor.unitScope), deletedAt: null, supersededBy: null },
      select: { id: true, links: { select: { characteristic: { select: { code: true } }, requirementIds: true } } },
    });
    if (!item) throw new AssessmentRuleError(404, "NOT_FOUND");
    const resolved = await validLinks(tx, actor.assessmentId, links);
    await tx.evidenceLink.deleteMany({ where: { evidenceItemId: item.id } });
    if (resolved.length) await tx.evidenceLink.createMany({ data: resolved.map((l) => ({ evidenceItemId: item.id, characteristicId: l.characteristicId, requirementIds: l.requirementIds })) });
    await logAudit(tx, {
      action: "evidence.map",
      entityType: "EvidenceItem",
      entityId: item.id,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      before: { characteristics: item.links.map((l) => l.characteristic.code), requirementIds: item.links.flatMap((l) => l.requirementIds) },
      after: { characteristics: resolved.map((l) => l.code), requirementIds: resolved.flatMap((l) => l.requirementIds) },
      meta,
    });
  });
}

/** Penghapusan logis (docs/04 bagian 6): berkas tetap tersimpan sampai pemusnahan data asesmen. */
export async function deleteEvidence(actor: EvidenceActor, evidenceId: string, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await assertUploadStatus(tx, actor.assessmentId);
    const item = await tx.evidenceItem.findFirst({
      where: { id: evidenceId, ...evidenceScope(actor.assessmentId, actor.unitScope), deletedAt: null, supersededBy: null },
      select: { id: true, title: true },
    });
    if (!item) throw new AssessmentRuleError(404, "NOT_FOUND");
    await tx.evidenceItem.update({ where: { id: item.id }, data: { deletedAt: new Date() } });
    await logAudit(tx, {
      action: "evidence.delete",
      entityType: "EvidenceItem",
      entityId: item.id,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      before: { title: item.title },
      meta,
    });
  });
}

/** Bukti versi terbaru yang belum dihapus, beserta riwayat versinya. */
export async function listEvidence(assessmentId: string, unitScope: string[] | null) {
  const items = await getDb().evidenceItem.findMany({
    where: evidenceScope(assessmentId, unitScope),
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      mimeType: true,
      sizeBytes: true,
      sha256: true,
      version: true,
      supersedesId: true,
      deletedAt: true,
      createdAt: true,
      unit: { select: { name: true } },
      uploadedBy: { select: { name: true } },
      supersededBy: { select: { id: true } },
      links: { select: { characteristicId: true, requirementIds: true, characteristic: { select: { code: true } } } },
    },
  });
  const byId = new Map(items.map((i) => [i.id, i]));
  const history = (item: (typeof items)[number]) => {
    const versions: (typeof items)[number][] = [];
    let cursor = item.supersedesId ? byId.get(item.supersedesId) : undefined;
    while (cursor) {
      versions.push(cursor);
      cursor = cursor.supersedesId ? byId.get(cursor.supersedesId) : undefined;
    }
    return versions;
  };
  return items
    .filter((i) => !i.deletedAt && !i.supersededBy)
    .map((i) => ({
      ...i,
      unitName: i.unit?.name ?? null,
      uploadedByName: i.uploadedBy.name,
      characteristicCodes: i.links.map((l) => l.characteristic.code).sort(),
      previousVersions: history(i).map((v) => ({ id: v.id, version: v.version, createdAt: v.createdAt, sha256: v.sha256 })),
    }));
}

export async function loadEvidenceChecklist(assessmentId: string, unitScope: string[] | null) {
  const db = getDb();
  const assessment = await db.assessment.findUniqueOrThrow({ where: { id: assessmentId }, select: { instrumentVersionId: true, parameterSnapshot: true, parameterDraft: true } });
  const quality = ((assessment.parameterSnapshot as { parameters?: { quality?: Record<string, number> } } | null)?.parameters?.quality ??
    (assessment.parameterDraft as { quality?: Record<string, number> } | null)?.quality ??
    {}) as Record<string, number>;
  const [characteristics, links] = await Promise.all([
    db.characteristic.findMany({
      where: { instrumentVersionId: assessment.instrumentVersionId },
      orderBy: { order: "asc" },
      select: { id: true, code: true, nameId: true, evidenceRequirements: { orderBy: { order: "asc" }, select: { id: true, description: true } } },
    }),
    db.evidenceLink.findMany({
      where: { evidenceItem: { ...evidenceScope(assessmentId, unitScope), deletedAt: null, supersededBy: null } },
      select: { evidenceItemId: true, characteristicId: true, requirementIds: true },
    }),
  ]);
  const minTypes = quality.minEvidenceTypesPerCharacteristic ?? DEFAULT_MIN_EVIDENCE_TYPES;
  return {
    minTypes,
    rows: buildChecklist({
      characteristics: characteristics.map((c) => ({ id: c.id, code: c.code, name: c.nameId, requirements: c.evidenceRequirements })),
      links,
      minTypes,
    }),
  };
}

/** Data unduhan; versi lama dan bukti yang dihapus secara logis tetap dapat diunduh oleh yang berhak. */
export async function evidenceForDownload(assessmentId: string, evidenceId: string, unitScope: string[] | null) {
  return getDb().evidenceItem.findFirst({
    where: { id: evidenceId, ...evidenceScope(assessmentId, unitScope) },
    select: { storageKey: true, title: true, mimeType: true, version: true },
  });
}
