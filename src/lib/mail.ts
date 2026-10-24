// Pengiriman surel melalui SMTP (Mailpit saat pengembangan, docs/02 bagian 1).

import nodemailer, { type Transporter } from "nodemailer";

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

export async function sendMail(message: MailMessage): Promise<void> {
  await transporter().sendMail({
    from: process.env.MAIL_FROM || "NSCAS Nusa Safety <noreply@nusasafety.co.id>",
    ...message,
  });
}

/** Alamat publik aplikasi untuk tautan di surel. */
export function appUrl(): string {
  return (process.env.APP_URL || process.env.AUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
}
