import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";
import { generateSync } from "otplib";

export interface Fixtures {
  password: string;
  organizations: { a: string; b: string; operator: string };
  assessments: { a: string; b: string; c: string; survey: string; panel: string; dashboard: string };
  /** Id respons survei bertanda pada asesmen survei (Fase 11). */
  flaggedResponses: string[];
  /** Token survei mentah, berkunci "<proyek>:<keperluan>" dan "revoked". Hanya untuk basis data e2e. */
  surveyTokens: Record<string, string>;
  observationWindows: { open: string; closed: string; site: { latitude: number; longitude: number; radiusMeters: number } };
  units: { a1: string; a2: string; b1: string; c1: string; c2: string };
  users: Record<string, { id: string; email: string }>;
  totpSecrets: Record<string, string>;
}

export function fixtures(): Fixtures {
  return JSON.parse(readFileSync(join(__dirname, ".fixtures.json"), "utf8")) as Fixtures;
}

export function totpCode(secret: string): string {
  return generateSync({ secret });
}

/** Batas tunggu navigasi alur masuk: mode pengembangan mengompilasi rute saat pertama dibuka, ditambah hashing argon2. */
const LOGIN_NAVIGATION_TIMEOUT = 30_000;

/** Pesan galat dari komponen Alert (bukan elemen pengumuman rute bawaan Next.js yang juga ber-role alert). */
export function errorAlert(page: Page): Locator {
  return page.locator('[data-slot="alert"][role="alert"]');
}

export async function submitPassword(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Surel").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
}

/** Masuk lengkap, termasuk verifikasi dua langkah bila pengguna memiliki rahasia TOTP. */
export async function login(page: Page, key: string): Promise<void> {
  const f = fixtures();
  await submitPassword(page, f.users[key].email, f.password);
  const secret = f.totpSecrets[key];
  if (secret) {
    await expect(page).toHaveURL(/\/login\/verify$/, { timeout: LOGIN_NAVIGATION_TIMEOUT });
    await page.getByLabel("Kode verifikasi").fill(totpCode(secret));
    await page.getByRole("button", { name: "Verifikasi" }).click();
  }
  await expect(page).not.toHaveURL(/\/login/, { timeout: LOGIN_NAVIGATION_TIMEOUT });
}
