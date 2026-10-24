// Token responden (docs/04 bagian 3, docs/02 bagian 4): 32 byte acak dalam base64url. Token mentah hanya
// ada di tautan; basis data hanya menyimpan hash SHA-256 (AccessToken.tokenHash, UnitQrCode.codeHash).

import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/** Bentuk token yang sah: 43 karakter base64url (32 byte). Pemeriksaan murah sebelum menyentuh basis data. */
export function looksLikeToken(raw: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(raw);
}

function base(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function surveyLink(baseUrl: string, raw: string): string {
  return `${base(baseUrl)}/s/${raw}`;
}

export function selfAssessmentLink(baseUrl: string, raw: string): string {
  return `${base(baseUrl)}/sa/${raw}`;
}

export function unitQrLink(baseUrl: string, raw: string): string {
  return `${base(baseUrl)}/q/${raw}`;
}

/** docs/02 bagian 4 butir 4: AccessToken.completedAt dibulatkan ke jam terdekat. */
export function roundToNearestHour(date: Date): Date {
  const hour = 60 * 60 * 1000;
  return new Date(Math.round(date.getTime() / hour) * hour);
}
