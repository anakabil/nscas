// Berita acara pemusnahan data mentah (docs/04 bagian 7). Murni: dokumen HTML A4 tanpa skrip, dirender worker ke PDF.

import { createTranslator } from "use-intl/core";
import id from "../../../messages/id.json";
import { documentStyles, type ReportAssets } from "@/lib/report/html";

/** Urutan kategori data mentah di berita acara. */
export const DESTROYED_CATEGORIES = ["rosterEntries", "accessTokens", "surveyResponses", "characteristicAnswers", "climateAnswers", "selfAssessments", "selfAssessmentAnswers", "evidenceItems", "evidenceLinks", "observationCaptures", "validationParticipants", "storageObjects"] as const;

export interface DestructionMinutes {
  recordId: string;
  organization: string;
  assessment: string;
  executedAt: string;
  executedBy: string;
  witnessName: string;
  notes: string | null;
  clientConfirmationRef: string;
  clientConfirmedOn: string | null;
  clientConfirmedBy: string;
  finalReportSignedAt: string | null;
  retentionMonths: number;
  retentionEnd: string | null;
  counts: Record<string, number>;
}

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);
}

const TZ = "Asia/Jakarta";
const date = (v: string | null, utc = false) => (v ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: utc ? "UTC" : TZ }).format(new Date(v)) : "");
function dateTime(v: string): string {
  const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ }).format(new Date(v));
  return `${date(v)}, ${time} WIB`;
}
const int = (n: number) => new Intl.NumberFormat("id-ID").format(n);

export function renderDestructionHtml(m: DestructionMinutes, assets: ReportAssets): string {
  const t = createTranslator({ locale: "id", messages: id, namespace: "retentionDoc" }) as unknown as (key: string, values?: Record<string, string | number>) => string;
  const kv = (rows: [string, string][]) => `<table class="kv"><tbody>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</tbody></table>`;
  const order = [...DESTROYED_CATEGORIES.filter((k) => k in m.counts), ...Object.keys(m.counts).filter((k) => !(DESTROYED_CATEGORIES as readonly string[]).includes(k))];
  const counts = order.map((k) => [k, m.counts[k] ?? 0] as const).map(([k, n]) => `<tr><td>${esc(t(`categories.${k}`))}</td><td class="num">${esc(int(n))}</td></tr>`).join("");
  const body = `<header><span class="logo-wrap"><img class="logo" src="${esc(assets.logoSrc)}" alt="${esc(t("logoAlt"))}"></span><h1>${esc(t("title"))}</h1><p class="muted">${esc(t("number", { id: m.recordId }))}</p></header>
<p>${esc(t("opening", { date: date(m.executedAt), organization: m.organization, assessment: m.assessment }))}</p>
<h2>${esc(t("basis.title"))}</h2>${kv([
    [t("basis.law"), t("basis.lawValue")],
    [t("basis.finalReport"), date(m.finalReportSignedAt)],
    [t("basis.months"), t("basis.monthsValue", { months: m.retentionMonths })],
    [t("basis.end"), date(m.retentionEnd)],
  ])}
<h2>${esc(t("confirmation.title"))}</h2>${kv([
    [t("confirmation.ref"), m.clientConfirmationRef],
    [t("confirmation.date"), date(m.clientConfirmedOn, true)],
    [t("confirmation.by"), m.clientConfirmedBy],
  ])}
<h2>${esc(t("destroyed.title"))}</h2><table><thead><tr><th>${esc(t("destroyed.category"))}</th><th class="num">${esc(t("destroyed.count"))}</th></tr></thead><tbody>${counts}</tbody></table>
<h2>${esc(t("retained.title"))}</h2><p>${esc(t("retained.body"))}</p>
${m.notes ? `<h2>${esc(t("notes"))}</h2><p>${esc(m.notes)}</p>` : ""}
<h2>${esc(t("execution.title"))}</h2>${kv([
    [t("execution.by"), m.executedBy],
    [t("execution.at"), dateTime(m.executedAt)],
    [t("execution.witness"), m.witnessName],
  ])}
<div class="signature" style="display:grid;grid-template-columns:1fr 1fr;gap:10mm;margin-top:14mm"><div><p>${esc(t("execution.by"))}</p><p style="margin-top:18mm"><strong>${esc(m.executedBy)}</strong></p></div><div><p>${esc(t("execution.witness"))}</p><p style="margin-top:18mm"><strong>${esc(m.witnessName)}</strong></p></div></div>`;
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(t("title"))}</title><style>${documentStyles(assets)}</style></head><body><main class="page">${body}</main></body></html>`;
}
