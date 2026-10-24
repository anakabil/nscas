// Daftar kesenjangan dan rencana aksi (docs/01 M10). Murni.

import { z } from "zod";
import { aspectWeights, EPS, type EngineParameters, type EngineResult } from "@/lib/scoring";

export interface GapCandidate {
  code: string;
  aspectCode: string;
  isContextual: boolean;
  currentIndex: number;
  gap: number;
  aspectWeight: number;
  priorityScore: number;
  rank: number;
}

/**
 * Karakteristik dengan indeks akhir (nilai panel bila ada, selain itu nilai akhir mesin) di bawah tingkat
 * sasaran, diurutkan menurut bobot aspek dikali besar kesenjangan. Karakteristik kontekstual tidak berbobot
 * aspek sehingga skor prioritasnya nol dan berada di akhir daftar. Seri diputus menurut kesenjangan, lalu kode.
 */
export function buildGapList(result: EngineResult, params: EngineParameters, targetLevel: number): GapCandidate[] {
  const weights = aspectWeights(params);
  return result.characteristics
    .map((c) => ({ c, value: c.panelAdjusted ?? c.final }))
    .filter((x): x is { c: EngineResult["characteristics"][number]; value: number } => x.value !== null && x.value < targetLevel - EPS)
    .map(({ c, value }) => {
      const gap = targetLevel - value;
      const aspectWeight = c.isContextual ? 0 : (weights.get(c.aspectCode) ?? 0);
      return { code: c.code, aspectCode: c.aspectCode, isContextual: c.isContextual, currentIndex: value, gap, aspectWeight, priorityScore: aspectWeight * gap, rank: 0 };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || b.gap - a.gap || a.code.localeCompare(b.code, "en"))
    .map((g, i) => ({ ...g, rank: i + 1 }));
}

export const OPEN_STATUSES = ["PLANNED", "IN_PROGRESS"] as const;
export const DUE_SOON_DAYS = 7;
export const REMINDER_INTERVAL_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

/** Tanggal kalender WIB (UTC+7) sebagai yyyy-mm-dd. */
export function wibDay(date: Date): string {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Triwulan dari tanggal tenggat (kolom @db.Date, disimpan tengah malam UTC). */
export function quarterOf(dueDate: Date): { year: number; quarter: 1 | 2 | 3 | 4; key: string } {
  const year = dueDate.getUTCFullYear();
  const quarter = (Math.floor(dueDate.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  return { year, quarter, key: `${year}-Q${quarter}` };
}

export type DueState = "closed" | "overdue" | "dueSoon" | "onTrack";

export function dueState(action: { status: string; dueDate: Date }, now: Date): DueState {
  if (!(OPEN_STATUSES as readonly string[]).includes(action.status)) return "closed";
  const today = wibDay(now);
  const due = action.dueDate.toISOString().slice(0, 10);
  if (due < today) return "overdue";
  const days = (Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY;
  return days <= DUE_SOON_DAYS ? "dueSoon" : "onTrack";
}

/** Pengingat dikirim untuk tindakan terbuka yang mendekati atau melewati tenggat, paling sering seminggu sekali. */
export function reminderDue(action: { status: string; dueDate: Date; lastReminderAt: Date | null }, now: Date): boolean {
  const state = dueState(action, now);
  if (state !== "overdue" && state !== "dueSoon") return false;
  return !action.lastReminderAt || action.lastReminderAt.getTime() <= now.getTime() - REMINDER_INTERVAL_DAYS * DAY;
}

// ---------------------------------------------------------------------------
// Masukan
// ---------------------------------------------------------------------------

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

export const gapAnalysisSchema = z.object({
  rootCause: optionalText(4000),
  priority: z.enum(["HIGH", "MEDIUM", "LOW", ""]).transform((v) => (v === "" ? null : v)),
});

export const actionSchema = z.object({
  title: z.string().trim().min(5).max(300),
  description: optionalText(4000),
  ownerName: z.string().trim().min(2).max(200),
  ownerPosition: z.string().trim().min(2).max(200),
  ownerEmail: z.union([z.literal(""), z.email().max(254)]).transform((v) => (v === "" ? null : v.toLowerCase())),
  unitId: z.string().max(64).transform((v) => (v === "" ? null : v)),
  dueDate: z.iso.date(),
  successIndicator: z.string().trim().min(5).max(1000),
});

export const progressSchema = z.object({
  note: z.string().trim().min(10).max(4000),
  progressPercent: z.coerce.number().int().min(0).max(100),
  status: z.enum(["PLANNED", "IN_PROGRESS", "DONE", "CANCELLED"]),
});

export const verificationSchema = z.object({
  approve: z.boolean(),
  note: z.string().trim().min(10).max(4000),
});
