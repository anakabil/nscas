// Pengiriman surel melalui SMTP (Mailpit saat pengembangan, docs/02 bagian 1).

import { existsSync } from "node:fs";
import { join } from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { EMAIL_HEADER_CID, EMAIL_HEADER_FILE } from "./email-header";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const globalForMail = globalThis as unknown as { nscasMailer?: Transporter };

function transporter(): Transporter {
  if (!globalForMail.nscasMailer) {
    const port = Number(process.env.SMTP_PORT || 1025);
    globalForMail.nscasMailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "localhost",
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
    });
  }
  return globalForMail.nscasMailer;
}

/**
 * Kepala surel dilampirkan sebagai gambar inline bila HTML memakainya. Bila berkasnya tidak ada, gambar dibuang
 * dari HTML agar surel tetap terkirim tanpa gambar rusak.
 */
function withHeaderImage(message: MailMessage): MailMessage & { attachments?: { filename: string; path: string; cid: string; contentDisposition: "inline" }[] } {
  const marker = `cid:${EMAIL_HEADER_CID}`;
  if (!message.html.includes(marker)) return message;
  const path = join(process.cwd(), EMAIL_HEADER_FILE);
  if (!existsSync(path)) return { ...message, html: message.html.replace(new RegExp(`<img src="${marker}"[^>]*>`, "g"), "") };
  return { ...message, attachments: [{ filename: "nscas.png", path, cid: EMAIL_HEADER_CID, contentDisposition: "inline" }] };
}

export async function sendMail(message: MailMessage): Promise<void> {
  await transporter().sendMail({
    from: process.env.MAIL_FROM || "NSCAS Nusa Safety <noreply@nusasafety.co.id>",
    ...withHeaderImage(message),
  });
}

export { appUrl } from "./app-url";
