// Aturan 1 CLAUDE.md: mesin penilaian adalah kode murni tanpa impor Prisma, Next.js, atau I/O.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname, "..");
const sources = readdirSync(dir).filter((f) => f.endsWith(".ts"));
const FORBIDDEN = /from\s+["'](?!\.{1,2}\/)([^"']+)["']|import\(\s*["'](?!\.{1,2}\/)([^"']+)["']|require\(/;

describe("kemurnian modul src/lib/scoring", () => {
  it.each(sources)("%s hanya mengimpor berkas di dalam modul ini", (file) => {
    const content = readFileSync(join(dir, file), "utf8");
    expect(content).not.toMatch(FORBIDDEN);
    expect(content).not.toMatch(/\b(process|fetch|Date\.now|Math\.random)\b/);
  });
});
