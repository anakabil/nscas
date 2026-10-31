// Surel undangan dan pengingat survei, dua bahasa (Indonesia lalu Inggris). Teks dari messages/*.json.

import { createTranslator } from "use-intl/core";
import en from "../../../messages/en.json";
import id from "../../../messages/id.json";
import type { MailMessage } from "@/lib/mail";
import { PALETTE } from "@/lib/theme";
import { emailHeaderHtml } from "@/lib/email-header";

export type SurveyEmailKind = "invitation" | "reminder" | "continue";

export interface SurveyEmailInput {
  kind: SurveyEmailKind;
  to: string;
  name: string;
  organization: string;
  /** Tidak ada untuk pengingat "lanjutkan" (token yang sudah dibuka tidak diganti). */
  link: string | null;
  closesAt: Date | null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);
}

function formatDeadline(date: Date, locale: "id" | "en"): string {
  const d = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Jakarta",
  }).format(date);
  return `${d} WIB`;
}

function section(locale: "id" | "en", input: SurveyEmailInput) {
  const t = createTranslator({ locale, messages: locale === "id" ? id : en, namespace: "email" });
  const lines = [
    t("greeting", { name: input.name }),
    t(`${input.kind}.intro`, { organization: input.organization }),
    t("anonymity"),
    ...(input.kind === "continue" ? [] : [t("duration")]),
    ...(input.link ? [t("linkIntro"), input.link, t("personal")] : []),
    ...(input.closesAt ? [t("deadline", { date: formatDeadline(input.closesAt, locale) })] : []),
    t("closing"),
    t("signature"),
  ];
  const subject = t(`${input.kind}.subject`, { organization: input.organization });
  const html = [
    `<p>${escapeHtml(t("greeting", { name: input.name }))}</p>`,
    `<p>${escapeHtml(t(`${input.kind}.intro`, { organization: input.organization }))}</p>`,
    `<p>${escapeHtml(t("anonymity"))}${input.kind === "continue" ? "" : ` ${escapeHtml(t("duration"))}`}</p>`,
    input.link
      ? `<p><a href="${escapeHtml(input.link)}" style="display:inline-block;background:${PALETTE.navy};color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(t("button"))}</a></p>` +
        `<p style="font-size:13px;color:${PALETTE.textMuted}">${escapeHtml(t("linkIntro"))}<br>${escapeHtml(input.link)}</p>` +
        `<p style="font-size:13px;color:${PALETTE.textMuted}">${escapeHtml(t("personal"))}</p>`
      : "",
    input.closesAt ? `<p>${escapeHtml(t("deadline", { date: formatDeadline(input.closesAt, locale) }))}</p>` : "",
    `<p>${escapeHtml(t("closing"))}<br>${escapeHtml(t("signature"))}</p>`,
  ].join("");
  return { subject, text: lines.join("\n\n"), html, other: t("otherLanguage") };
}

export function buildSurveyEmail(input: SurveyEmailInput): MailMessage {
  const idPart = section("id", input);
  const enPart = section("en", input);
  return {
    to: input.to,
    subject: idPart.subject,
    text: `${idPart.text}\n\n${idPart.other}\n\n----------\n\n${enPart.text}`,
    html:
      `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:${PALETTE.text};max-width:560px">` +
      emailHeaderHtml() +
      `${idPart.html}<p style="font-size:13px;color:${PALETTE.textMuted}">${escapeHtml(idPart.other)}</p>` +
      `<hr style="border:none;border-top:1px solid ${PALETTE.border};margin:24px 0">${enPart.html}</div>`,
  };
}
