import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { AssessmentStatus, Role } from "@/generated/prisma/enums";
import { AssessmentRuleError } from "@/lib/assessments/service";
import { logAudit, type RequestMeta } from "@/lib/audit";
import type { SessionContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { detectFileType, MAX_UPLOAD_BYTES, OBSERVATION_MIME_TYPES } from "@/lib/files/content-type";
import { issueUploadTicket, readUploadTicket } from "@/lib/files/upload-ticket";
import { uploadRateLimiter } from "@/lib/rate-limit";
import { deleteObject, inspectObject, presignUpload } from "@/lib/storage";
import { checkRadius, parseChecklist, type ChecklistItem } from "./geo";

// Observasi digital (docs/01 M6). Asesor membuka jendela observasi per proyek; koordinator mengambil foto atau
// video langsung dari kamera di /o/[windowId]. Waktu pengambilan adalah waktu server, bukan waktu perangkat.
// Unggahan di luar jendela waktu ditolak; di luar radius diterima tetapi ditandai.

export interface ObservationActor {
  session: SessionContext;
  assessmentId: string;
  organizationId: string;
  roles: Role[];
  unitScope: string[] | null;
}

const WINDOW_STATUSES: readonly AssessmentStatus[] = ["LOCKED", "DATA_COLLECTION"];
const actorOf = (a: ObservationActor) => ({ id: a.session.user.id, role: a.roles[0] ?? null });

/** Isian datetime-local dibaca sebagai waktu WIB (UTC+7). */
const wibDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  .transform((v) => new Date(`${v}:00+07:00`));

export const windowSchema = z
  .object({
    unitId: z.string().min(1).max(64),
    title: z.string().trim().min(2).max(200),
    opensAt: wibDateTime,
    closesAt: wibDateTime,
    checklist: z.string().max(10_000).transform(parseChecklist),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radiusMeters: z.number().int().min(10).max(50_000),
  })
  .refine((w) => w.closesAt > w.opensAt, { message: "WINDOW_ORDER", path: ["closesAt"] })
  .refine((w) => w.checklist.length > 0, { message: "CHECKLIST_REQUIRED", path: ["checklist"] });

export async function createObservationWindow(actor: ObservationActor, input: z.output<typeof windowSchema>, meta: RequestMeta): Promise<{ id: string }> {
  return getDb().$transaction(async (tx) => {
    const a = await tx.assessment.findUniqueOrThrow({ where: { id: actor.assessmentId }, select: { status: true } });
    if (!WINDOW_STATUSES.includes(a.status)) throw new AssessmentRuleError(409, "DISTRIBUTION_CLOSED", { status: a.status });
    const unit = await tx.unit.findFirst({ where: { id: input.unitId, assessmentId: actor.assessmentId }, select: { id: true, name: true } });
    if (!unit) throw new AssessmentRuleError(404, "NOT_FOUND");
    const window = await tx.observationWindow.create({
      data: {
        assessmentId: actor.assessmentId,
        unitId: unit.id,
        title: input.title,
        opensAt: input.opensAt,
        closesAt: input.closesAt,
        checklist: input.checklist as unknown as Prisma.InputJsonArray,
        latitude: input.latitude,
        longitude: input.longitude,
        radiusMeters: input.radiusMeters,
        createdById: actor.session.user.id,
      },
      select: { id: true },
    });
    await logAudit(tx, {
      action: "observation.window_create",
      entityType: "ObservationWindow",
      entityId: window.id,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      after: {
        unit: unit.name,
        title: input.title,
        opensAt: input.opensAt.toISOString(),
        closesAt: input.closesAt.toISOString(),
        checklist: input.checklist,
        latitude: input.latitude,
        longitude: input.longitude,
        radiusMeters: input.radiusMeters,
      },
      meta,
    });
    return window;
  });
}

export async function listObservationWindows(assessmentId: string, unitScope: string[] | null) {
  const windows = await getDb().observationWindow.findMany({
    where: { assessmentId, ...(unitScope ? { unitId: { in: unitScope } } : {}) },
    orderBy: { opensAt: "desc" },
    select: {
      id: true,
      title: true,
      opensAt: true,
      closesAt: true,
      checklist: true,
      latitude: true,
      longitude: true,
      radiusMeters: true,
      unit: { select: { id: true, name: true } },
      captures: {
        orderBy: { serverCapturedAt: "desc" },
        select: {
          id: true,
          checklistItemCode: true,
          mimeType: true,
          serverCapturedAt: true,
          accuracyMeters: true,
          distanceFromSiteMeters: true,
          outsideRadius: true,
          latitude: true,
          note: true,
          uploadedBy: { select: { name: true } },
        },
      },
    },
  });
  return windows.map((w) => ({ ...w, checklist: w.checklist as unknown as ChecklistItem[] }));
}

/** Jendela untuk halaman /o: milik organisasi pengguna, unitnya dalam cakupan, dan belum ditutup. */
export async function openWindowsForUser(memberships: { organizationId: string; role: Role; unitScope: string[] }[], now: Date = new Date()) {
  const scopes = memberships.filter((m) => m.role === "CLIENT_ADMIN" || m.role === "UNIT_COORDINATOR");
  if (scopes.length === 0) return [];
  const windows = await getDb().observationWindow.findMany({
    where: {
      closesAt: { gt: now },
      assessment: { status: { in: [...WINDOW_STATUSES] }, organizationId: { in: scopes.map((s) => s.organizationId) } },
    },
    orderBy: { opensAt: "asc" },
    select: { id: true, title: true, opensAt: true, closesAt: true, unitId: true, unit: { select: { name: true } }, assessment: { select: { organizationId: true, name: true } } },
  });
  return windows.filter((w) =>
    scopes.some((s) => s.organizationId === w.assessment.organizationId && (s.role === "CLIENT_ADMIN" || s.unitScope.includes(w.unitId))),
  );
}

export async function loadWindow(windowId: string) {
  const w = await getDb().observationWindow.findUnique({
    where: { id: windowId },
    select: {
      id: true,
      assessmentId: true,
      unitId: true,
      title: true,
      opensAt: true,
      closesAt: true,
      checklist: true,
      latitude: true,
      longitude: true,
      radiusMeters: true,
      unit: { select: { name: true } },
      assessment: { select: { status: true, organization: { select: { name: true } } } },
      captures: { select: { checklistItemCode: true } },
    },
  });
  return w ? { ...w, checklist: w.checklist as unknown as ChecklistItem[] } : null;
}

export function windowOpen(w: { opensAt: Date; closesAt: Date; assessment: { status: AssessmentStatus } }, now: Date): boolean {
  return WINDOW_STATUSES.includes(w.assessment.status) && w.opensAt <= now && w.closesAt > now;
}

export const captureRequestSchema = z.object({
  checklistItemCode: z.string().min(1).max(20),
  contentType: z.string().max(100),
  size: z.number().int().min(1),
  location: z
    .object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy: z.number().min(0).max(100_000) })
    .nullable(),
});

const CAPTURE_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/webm": "webm", "video/mp4": "mp4", "video/quicktime": "mov" };

/**
 * Meminta URL unggah untuk satu hasil kamera. Waktu server pada saat ini menjadi waktu pengambilan; permintaan
 * di luar jendela waktu ditolak. Jarak ke titik proyek dihitung dari lokasi peramban.
 */
export async function requestCaptureUpload(actor: ObservationActor, windowId: string, input: z.output<typeof captureRequestSchema>, now: Date = new Date()) {
  if (!uploadRateLimiter.consume(actor.session.user.id).allowed) throw new AssessmentRuleError(429, "RATE_LIMITED");
  if (input.size > MAX_UPLOAD_BYTES) throw new AssessmentRuleError(413, "FILE_TOO_LARGE");
  const window = await loadWindow(windowId);
  if (!window || window.assessmentId !== actor.assessmentId) throw new AssessmentRuleError(404, "NOT_FOUND");
  if (actor.unitScope && !actor.unitScope.includes(window.unitId)) throw new AssessmentRuleError(403, "FORBIDDEN");
  if (!windowOpen(window, now)) throw new AssessmentRuleError(409, "OUTSIDE_WINDOW");
  if (!window.checklist.some((c) => c.code === input.checklistItemCode)) throw new AssessmentRuleError(422, "UNKNOWN_ITEM");
  const contentType = (OBSERVATION_MIME_TYPES as readonly string[]).includes(input.contentType) ? input.contentType : null;
  if (!contentType) throw new AssessmentRuleError(422, "FILE_TYPE");

  const radius = checkRadius(window, input.location);
  const key = `${actor.organizationId}/${actor.assessmentId}/observation/${randomUUID()}.${CAPTURE_EXT[contentType]}`;
  const { url, headers } = await presignUpload(key, contentType, input.size);
  const ticket = issueUploadTicket({
    kind: "observation",
    key,
    userId: actor.session.user.id,
    assessmentId: actor.assessmentId,
    declaredSize: input.size,
    fileName: key,
    data: {
      windowId,
      checklistItemCode: input.checklistItemCode,
      serverCapturedAt: now.toISOString(),
      latitude: input.location?.latitude ?? null,
      longitude: input.location?.longitude ?? null,
      accuracyMeters: input.location?.accuracy ?? null,
      distanceFromSiteMeters: radius.distanceMeters,
      outsideRadius: radius.outsideRadius,
    },
  });
  return { url, headers, ticket, outsideRadius: radius.outsideRadius, distanceMeters: radius.distanceMeters };
}

export async function finalizeCapture(
  actor: ObservationActor,
  rawTicket: string,
  note: string,
  meta: RequestMeta,
): Promise<{ id: string; outsideRadius: boolean; serverCapturedAt: Date; distanceFromSiteMeters: number | null }> {
  const ticket = readUploadTicket(rawTicket, { kind: "observation", userId: actor.session.user.id, assessmentId: actor.assessmentId });
  if (!ticket) throw new AssessmentRuleError(400, "UPLOAD_EXPIRED");
  const inspected = await inspectObject(ticket.key, MAX_UPLOAD_BYTES);
  if (!inspected) throw new AssessmentRuleError(422, "UPLOAD_MISSING");
  const reject = async (code: string): Promise<never> => {
    await deleteObject(ticket.key).catch(() => undefined);
    throw new AssessmentRuleError(422, code);
  };
  if (inspected.size !== ticket.declaredSize || inspected.size > MAX_UPLOAD_BYTES) return reject("FILE_SIZE_MISMATCH");
  const detected = detectFileType(inspected.head);
  if (!detected || !(OBSERVATION_MIME_TYPES as readonly string[]).includes(detected.mime)) return reject("FILE_TYPE");

  const d = ticket.data as {
    windowId: string;
    checklistItemCode: string;
    serverCapturedAt: string;
    latitude: number | null;
    longitude: number | null;
    accuracyMeters: number | null;
    distanceFromSiteMeters: number | null;
    outsideRadius: boolean;
  };
  try {
    return await getDb().$transaction(async (tx) => {
      const window = await tx.observationWindow.findFirst({ where: { id: d.windowId, assessmentId: actor.assessmentId }, select: { id: true, unitId: true } });
      if (!window) throw new AssessmentRuleError(404, "NOT_FOUND");
      if (actor.unitScope && !actor.unitScope.includes(window.unitId)) throw new AssessmentRuleError(403, "FORBIDDEN");
      const capture = await tx.observationCapture.create({
        data: {
          windowId: window.id,
          checklistItemCode: d.checklistItemCode,
          storageKey: ticket.key,
          sha256: inspected.sha256,
          mimeType: detected.mime,
          sizeBytes: inspected.size,
          serverCapturedAt: new Date(d.serverCapturedAt),
          latitude: d.latitude,
          longitude: d.longitude,
          accuracyMeters: d.accuracyMeters,
          distanceFromSiteMeters: d.distanceFromSiteMeters,
          outsideRadius: d.outsideRadius,
          uploadedById: actor.session.user.id,
          note: note.trim() ? note.trim().slice(0, 1000) : null,
        },
        select: { id: true, outsideRadius: true, serverCapturedAt: true, distanceFromSiteMeters: true },
      });
      await logAudit(tx, {
        action: "observation.capture",
        entityType: "ObservationCapture",
        entityId: capture.id,
        actor: actorOf(actor),
        organizationId: actor.organizationId,
        assessmentId: actor.assessmentId,
        after: {
          windowId: window.id,
          checklistItemCode: d.checklistItemCode,
          sha256: inspected.sha256,
          mimeType: detected.mime,
          serverCapturedAt: d.serverCapturedAt,
          accuracyMeters: d.accuracyMeters,
          distanceFromSiteMeters: d.distanceFromSiteMeters,
          outsideRadius: d.outsideRadius,
        },
        meta,
      });
      return capture;
    });
  } catch (error) {
    await deleteObject(ticket.key).catch(() => undefined);
    throw error;
  }
}

export async function captureForDownload(assessmentId: string, captureId: string, unitScope: string[] | null) {
  return getDb().observationCapture.findFirst({
    where: { id: captureId, window: { assessmentId, ...(unitScope ? { unitId: { in: unitScope } } : {}) } },
    select: { storageKey: true, mimeType: true, checklistItemCode: true, serverCapturedAt: true },
  });
}
