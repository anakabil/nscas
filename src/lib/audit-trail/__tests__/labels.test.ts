// Setiap kode aksi jejak audit memiliki label yang dipahami pembaca dalam kedua bahasa (docs/05).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../../../messages/en.json";
import id from "../../../../messages/id.json";

const source = readFileSync(join(__dirname, "..", "..", "audit.ts"), "utf8");
const actions = [...source.matchAll(/^\s+\| "([a-zA-Z_]+\.[a-zA-Z_]+)"/gm)].map((m) => m[1]!);

function label(messages: typeof id, code: string): unknown {
  const [group, name] = code.split(".") as [string, string];
  return (messages.auditTrail.actions as Record<string, Record<string, string>>)[group]?.[name];
}

describe("label aksi jejak audit", () => {
  it("menemukan kode aksi di src/lib/audit.ts", () => {
    expect(actions.length).toBeGreaterThan(80);
    expect(actions).toContain("retention.destroy");
  });

  it.each(actions)("%s berlabel dalam bahasa Indonesia dan Inggris", (code) => {
    expect(label(id, code), "id").toEqual(expect.any(String));
    expect(label(en, code), "en").toEqual(expect.any(String));
  });

  it("label bahasa Indonesia tidak memakai singkatan teknis", () => {
    const all = Object.values(id.auditTrail.actions).flatMap((g) => Object.values(g as Record<string, string>));
    for (const text of all) expect(text).not.toMatch(/\b(TOTP|APD|FGD|SCL)\b/);
  });
});
