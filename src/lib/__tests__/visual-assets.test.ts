import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EMAIL_HEADER_FILE } from "@/lib/email-header";
import { REPORT_ASSET_FILES } from "@/lib/report/assets";

// Aset visual (docs/11) dirujuk sebagai teks di kode; tes ini memastikan setiap rujukan menunjuk berkas yang ada,
// dan berkas halaman survei tetap di bawah batasnya karena dibuka pekerja dengan sinyal lemah.

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "generated" || entry.name === "__tests__" ? [] : sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(entry.name) ? [path] : [];
  });
}

describe("aset visual", () => {
  it("setiap gambar yang dirujuk kode tersedia di public/", () => {
    const referenced = new Set<string>();
    for (const file of sourceFiles("src")) {
      for (const match of readFileSync(file, "utf8").matchAll(/\/(illustrations|brand|icons\/nav)\/([a-z0-9-]+\.(?:png|webp|jpg|svg))/g)) {
        referenced.add(`${match[1]}/${match[2]}`);
      }
    }
    // Rujukan lewat konstanta (laporan dan surel) dan nama berkas yang disusun saat berjalan (lencana tingkat).
    for (const file of [REPORT_ASSET_FILES.logo, REPORT_ASSET_FILES.cover, ...REPORT_ASSET_FILES.levelBadges]) referenced.add(file);
    referenced.add(EMAIL_HEADER_FILE.replace(/^public\//, ""));
    expect(referenced.size).toBeGreaterThan(25);
    const missing = [...referenced].filter((file) => {
      try {
        return !statSync(join("public", file)).isFile();
      } catch {
        return true;
      }
    });
    expect(missing).toEqual([]);
  });

  it.each([
    ["survey-welcome.webp", 25],
    ["survey-thanks.webp", 25],
    ["survey-privacy.webp", 15],
    ["state-link-unavailable.png", 40],
  ])("%s tidak melebihi %i KB", (file, limitKb) => {
    expect(statSync(join("public/illustrations", file)).size).toBeLessThanOrEqual(limitKb * 1024);
  });
});
