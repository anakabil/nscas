export const locales = ["id", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "id";

// Bahasa dipilih melalui cookie, bukan awalan URL, karena rute survei
// (/s/[token]) dan konsol tidak memakai segmen locale (docs/02 bagian 2).
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
