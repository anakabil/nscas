"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { z } from "zod";
import type { ActionState } from "@/components/forms/action-state";
import { actionErrorState } from "@/lib/assessments/action-errors";
import { requireRole } from "@/lib/auth/guard";
import { rolesFor, SURVEY_WINDOW_WRITE_ROLES } from "@/lib/auth/roles";
import { getRequestMeta } from "@/lib/request-meta";
import { MAX_ROSTER_FILE_BYTES, type RosterRowError } from "@/lib/respondents/roster-file";
import {
  createUnitQrCode,
  deactivateUnitQrCode,
  importRoster,
  issueSurveyLinks,
  qrInputSchema,
  queueInvitations,
  reissueSurveyToken,
  revokeSurveyToken,
  setSurveyWindow,
  surveyWindowSchema,
  type IssuedLink,
} from "@/lib/respondents/service";

// Server Action manajemen responden (docs/01 M2). Hak akses mengikuti docs/04 bagian 2: daftar responden
// diubah CLIENT_ADMIN dan UNIT_COORDINATOR (unitnya); token dan kode QR hanya CLIENT_ADMIN.

const idSchema = z.string().min(1).max(64);
const optionalUnit = z
  .union([z.literal(""), idSchema])
  .nullish()
  .transform((v) => v || null);

function refresh(assessmentId: string) {
  revalidatePath(`/assessments/${assessmentId}`, "layout");
}

// ---------------------------------------------------------------------------
// Impor daftar responden
// ---------------------------------------------------------------------------

/** Batas baris galat yang dikirim ke peramban; jumlah seluruhnya tetap dilaporkan. */
const MAX_ERRORS_SHOWN = 200;

export interface ImportState {
  error?: string;
  imported?: number;
  preview?: {
    totalRows: number;
    validRows: number;
    errorCount: number;
    errors: RosterRowError[];
    missingColumns: string[];
    tooManyRows: boolean;
    byUnit: { name: string; count: number }[];
    byStratum: { code: string; count: number }[];
  };
}

const importSchema = z.object({
  intent: z.enum(["preview", "commit"]),
  file: z.instanceof(File).refine((f) => f.size > 0 && f.size <= MAX_ROSTER_FILE_BYTES, { message: "FILE_SIZE" }),
});

export async function importRosterAction(assessmentId: string, formData: FormData): Promise<ImportState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), rolesFor("roster", "write"));
    const parsed = importSchema.safeParse({ intent: formData.get("intent"), file: formData.get("file") });
    if (!parsed.success) {
      const file = formData.get("file");
      return { error: file instanceof File && file.size > MAX_ROSTER_FILE_BYTES ? "FILE_TOO_LARGE" : "FILE_EMPTY" };
    }
    const bytes = new Uint8Array(await parsed.data.file.arrayBuffer());
    const result = await importRoster(access, bytes, parsed.data.intent === "commit", await getRequestMeta());
    if (!result.ok && result.error !== "INVALID_ROWS") return { error: result.error };

    const { validation, byUnit, byStratum } = result.summary;
    const preview: ImportState["preview"] = {
      totalRows: validation.totalRows,
      validRows: validation.valid.length,
      errorCount: validation.errors.length,
      errors: validation.errors.slice(0, MAX_ERRORS_SHOWN),
      missingColumns: validation.missingColumns,
      tooManyRows: validation.tooManyRows,
      byUnit: byUnit.map((u) => ({ name: u.name, count: u.count })),
      byStratum: byStratum.map((s) => ({ code: s.code, count: s.count })),
    };
    if (!result.ok) return { error: "INVALID_ROWS", preview };
    if (result.imported > 0) refresh(assessmentId);
    return { preview, imported: result.imported };
  } catch (error) {
    return actionErrorState(error);
  }
}

// ---------------------------------------------------------------------------
// Jendela survei
// ---------------------------------------------------------------------------

export async function setSurveyWindowAction(assessmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), SURVEY_WINDOW_WRITE_ROLES);
    const parsed = surveyWindowSchema.safeParse({ opensAt: formData.get("opensAt"), closesAt: formData.get("closesAt") });
    if (!parsed.success) return { error: parsed.error.issues.some((i) => i.message === "WINDOW_ORDER") ? "WINDOW_ORDER" : "INVALID_INPUT" };
    await setSurveyWindow(access, parsed.data, await getRequestMeta());
    refresh(assessmentId);
    return { success: "SAVED" };
  } catch (error) {
    return actionErrorState(error);
  }
}

// ---------------------------------------------------------------------------
// Token: undangan surel, tautan, pencabutan, penerbitan ulang
// ---------------------------------------------------------------------------

export interface LinksState {
  error?: string;
  /** Tautan mentah; hanya ada di respons ini dan tidak dapat ditampilkan ulang. */
  links?: IssuedLink[];
  queued?: number;
}

async function tokenActor(assessmentId: string) {
  return requireRole(idSchema.parse(assessmentId), rolesFor("tokensAndParticipation", "write"));
}

export async function queueInvitationsAction(assessmentId: string, _prev: LinksState, formData: FormData): Promise<LinksState> {
  try {
    const access = await tokenActor(assessmentId);
    const unitId = optionalUnit.parse(formData.get("unitId"));
    const queued = await queueInvitations(access, { unitId }, await getRequestMeta());
    refresh(assessmentId);
    return { queued };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function issueLinksAction(assessmentId: string, _prev: LinksState, formData: FormData): Promise<LinksState> {
  try {
    const access = await tokenActor(assessmentId);
    const input = z
      .object({ unitId: optionalUnit, onlyWithoutEmail: z.literal("on").nullish().transform(Boolean) })
      .parse({ unitId: formData.get("unitId"), onlyWithoutEmail: formData.get("onlyWithoutEmail") });
    const links = await issueSurveyLinks(access, input, await getRequestMeta());
    refresh(assessmentId);
    return { links };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "INVALID_INPUT" };
    return actionErrorState(error);
  }
}

export async function revokeTokenAction(assessmentId: string, rosterEntryId: string): Promise<ActionState> {
  try {
    const access = await tokenActor(assessmentId);
    await revokeSurveyToken(access, idSchema.parse(rosterEntryId), await getRequestMeta());
    refresh(assessmentId);
    return { success: "REVOKED" };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function reissueTokenAction(assessmentId: string, rosterEntryId: string, channel: "link" | "email"): Promise<LinksState> {
  try {
    const access = await tokenActor(assessmentId);
    const link = await reissueSurveyToken(access, idSchema.parse(rosterEntryId), z.enum(["link", "email"]).parse(channel), await getRequestMeta());
    refresh(assessmentId);
    return link ? { links: [link] } : { queued: 1 };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "INVALID_INPUT" };
    return actionErrorState(error);
  }
}

// ---------------------------------------------------------------------------
// Kode QR unit
// ---------------------------------------------------------------------------

export interface QrState {
  error?: string;
  /** Kode mentah hanya ada di respons ini; mencetak ulang berarti membuat kode baru. */
  qr?: { link: string; image: string; unitName: string };
}

export async function createQrAction(assessmentId: string, _prev: QrState, formData: FormData): Promise<QrState> {
  try {
    const access = await tokenActor(assessmentId);
    const parsed = qrInputSchema.safeParse({ unitId: formData.get("unitId"), maxIssuance: formData.get("maxIssuance") ?? "" });
    if (!parsed.success) return { error: "INVALID_INPUT" };
    const created = await createUnitQrCode(access, parsed.data, await getRequestMeta());
    const svg = await QRCode.toString(created.link, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
    refresh(assessmentId);
    return { qr: { link: created.link, unitName: created.unitName, image: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` } };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function deactivateQrAction(assessmentId: string, qrId: string): Promise<ActionState> {
  try {
    const access = await tokenActor(assessmentId);
    await deactivateUnitQrCode(access, idSchema.parse(qrId), await getRequestMeta());
    refresh(assessmentId);
    return { success: "DEACTIVATED" };
  } catch (error) {
    return actionErrorState(error);
  }
}
