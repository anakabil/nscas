import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEVEL_COLORS, PALETTE } from "@/lib/theme";

// Palet laporan PDF dan surel (src/lib/theme.ts) harus sama dengan token antarmuka (src/app/globals.css).
const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");

function token(name: string): string | undefined {
  return css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase();
}

const TOKENS: Record<string, keyof typeof PALETTE> = {
  "brand-navy": "navy",
  "brand-navy-deep": "navyDeep",
  highlight: "highlight",
  "series-2": "series2",
  text: "text",
  "text-muted": "textMuted",
  surface: "surface",
  "surface-alt": "surfaceAlt",
  tint: "tint",
  border: "border",
  success: "success",
  warning: "warning",
  danger: "danger",
  "heat-good": "heatGood",
  "heat-mid": "heatMid",
  "heat-low": "heatLow",
  "heat-suppressed": "heatSuppressed",
};

describe("palet warna", () => {
  it.each(Object.entries(TOKENS))("token --%s sama dengan PALETTE", (name, key) => {
    expect(token(name)).toBe(PALETTE[key]);
  });

  it("gradasi tingkat kematangan sama", () => {
    expect([1, 2, 3, 4, 5].map((level) => token(`level-${level}`))).toEqual([...LEVEL_COLORS]);
  });

  it("teks utama dan teks sekunder memenuhi kontras WCAG AA di latar halaman", () => {
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    for (const foreground of [PALETTE.text, PALETTE.textMuted, PALETTE.navy, PALETTE.success, PALETTE.warning, PALETTE.danger]) {
      expect(contrast(foreground, PALETTE.surfaceAlt)).toBeGreaterThanOrEqual(4.5);
    }
    // Teks status di atas latar peta warna dan lencana.
    expect(contrast(PALETTE.success, PALETTE.heatGood)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(PALETTE.warning, PALETTE.heatMid)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(PALETTE.danger, PALETTE.heatLow)).toBeGreaterThanOrEqual(4.5);
    // Teks terang di kepala halaman.
    expect(contrast("#ffffff", PALETTE.navyDeep)).toBeGreaterThanOrEqual(7);
  });
});
