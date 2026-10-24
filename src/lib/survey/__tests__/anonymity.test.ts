// CLAUDE.md aturan 2 dan docs/02 bagian 4: tabel jawaban survei tidak boleh memuat kolom yang dapat dipakai
// untuk menemukan token atau responden, dan rute survei tidak boleh mencatat alamat IP atau isi permintaan.
// Pemeriksaan di tingkat basis data ada di tests/integration/survey.test.ts.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..", "..");
const schema = readFileSync(join(ROOT, "prisma", "schema.prisma"), "utf8");

function modelFields(name: string): { field: string; type: string; line: string }[] {
  const block = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1];
  if (!block) throw new Error(`model ${name} not found`);
  return block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"))
    .map((line) => {
      const [field = "", type = ""] = line.split(/\s+/);
      return { field, type, line };
    });
}

const ANSWER_MODELS = {
  SurveyResponse: [
    "id",
    "assessmentId",
    "unitId",
    "stratumId",
    "instrumentVersionId",
    "language",
    "submittedOn",
    "durationBucket",
    "qualityFlags",
    "excluded",
    "excludedReason",
    "excludedById",
    "assessment",
    "unit",
    "stratum",
    "instrumentVersion",
    "excludedBy",
    "characteristicAnswers",
    "climateAnswers",
  ],
  CharacteristicAnswer: ["id", "responseId", "characteristicId", "level", "response", "characteristic"],
  ClimateAnswer: ["id", "responseId", "itemId", "value", "response", "item"],
};

describe("skema jawaban survei tanpa jalur ke token atau responden", () => {
  it.each(Object.entries(ANSWER_MODELS))("%s hanya memiliki kolom yang diizinkan", (model, allowed) => {
    expect(modelFields(model).map((f) => f.field)).toEqual(allowed);
  });

  it.each(Object.keys(ANSWER_MODELS))("%s tidak merujuk token, daftar responden, pengguna responden, atau alamat", (model) => {
    for (const { field, type, line } of modelFields(model)) {
      expect(type, line).not.toMatch(/AccessToken|RosterEntry|UnitQrCode|SelfAssessment/);
      expect(field, line).not.toMatch(/token|roster|respondent|email|phone|ip|userAgent|device|session/i);
    }
  });

  it.each(Object.keys(ANSWER_MODELS))("%s tidak menyimpan cap waktu dan memakai UUID acak", (model) => {
    const fields = modelFields(model);
    expect(fields.filter((f) => f.type.startsWith("DateTime")).map((f) => f.line)).toEqual(
      model === "SurveyResponse" ? ["submittedOn         DateTime       @db.Date"] : [],
    );
    expect(fields.some((f) => /@default\(now\(\)\)|@updatedAt/.test(f.line))).toBe(false);
    expect(fields.find((f) => f.field === "id")?.line).toContain("@default(uuid(4))");
  });

  it("model lain tidak merujuk SurveyResponse kecuali jawaban dan pengguna yang mengeluarkannya", () => {
    const referrers = [...schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)]
      .filter(([, , body]) => /\bSurveyResponse\b/.test(body as string))
      .map(([, name]) => name)
      .sort();
    expect(referrers).toEqual(["Assessment", "CharacteristicAnswer", "ClimateAnswer", "InstrumentVersion", "Stratum", "Unit", "User"]);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe("rute survei tidak mencatat alamat IP atau isi permintaan", () => {
  const files = [...walk(join(ROOT, "src", "app", "s")), join(ROOT, "src", "lib", "survey", "service.ts")];

  it.each(files.map((f) => [f.slice(ROOT.length + 1), readFileSync(f, "utf8")] as const))("%s", (_path, content) => {
    expect(content).not.toMatch(/x-forwarded-for|x-real-ip|clientIp|getRequestMeta|request\.ip\b/);
    expect(content).not.toMatch(/console\.(log|info|warn|error|debug)/);
    expect(content).not.toMatch(/logAudit|@\/lib\/audit/);
  });
});
