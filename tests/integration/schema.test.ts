// Membuktikan desain anonimitas (docs/02 bagian 4) dan batasan rentang nilai berlaku di basis data.

import { afterAll, describe, expect, it } from "vitest";
import { createTestClient } from "./db";

const prisma = createTestClient();

afterAll(async () => {
  await prisma.$disconnect();
});

async function columnsOf(table: string) {
  return prisma.$queryRawUnsafe<{ column_name: string; data_type: string }[]>(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    table,
  );
}

async function foreignKeyTargets(table: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ target: string }[]>(
    `SELECT DISTINCT confrelid::regclass::text AS target
       FROM pg_constraint
      WHERE contype = 'f' AND conrelid = $1::regclass`,
    `"${table}"`,
  );
  return rows.map((r) => r.target.replaceAll('"', "")).sort();
}

describe("anonimitas jawaban survei", () => {
  it.each(["SurveyResponse", "CharacteristicAnswer", "ClimateAnswer"])(
    "%s tidak memiliki kolom token, daftar responden, alamat IP, atau waktu presisi",
    async (table) => {
      const columns = await columnsOf(table);
      expect(columns.length).toBeGreaterThan(0);
      for (const { column_name, data_type } of columns) {
        expect(column_name).not.toMatch(/token|roster|ip|createdAt|updatedAt|submittedAt|At$/i);
        expect(data_type, column_name).not.toMatch(/timestamp|time/);
      }
    },
  );

  it("SurveyResponse hanya menyimpan tanggal kirim, tanpa jam", async () => {
    const submittedOn = (await columnsOf("SurveyResponse")).find((c) => c.column_name === "submittedOn");
    expect(submittedOn?.data_type).toBe("date");
  });

  it("SurveyResponse tidak berelasi ke AccessToken maupun RosterEntry", async () => {
    expect(await foreignKeyTargets("SurveyResponse")).toEqual([
      "Assessment",
      "InstrumentVersion",
      "Stratum",
      "Unit",
      "User", // asesor yang mengeluarkan respons dari analisis
    ]);
    expect(await foreignKeyTargets("CharacteristicAnswer")).toEqual(["Characteristic", "SurveyResponse"]);
    expect(await foreignKeyTargets("ClimateAnswer")).toEqual(["ClimateItem", "SurveyResponse"]);
  });

  it("AccessToken tidak memiliki updatedAt yang dapat merekam waktu selesai presisi", async () => {
    const names = (await columnsOf("AccessToken")).map((c) => c.column_name);
    expect(names).toContain("completedAt");
    expect(names).not.toContain("updatedAt");
  });

  it("AuditLog tidak memiliki foreign key", async () => {
    expect(await foreignKeyTargets("AuditLog")).toEqual([]);
  });
});

describe("batasan rentang nilai", () => {
  it("pernyataan berjenjang di luar tingkat 1 sampai 5 ditolak", async () => {
    const characteristic = await prisma.characteristic.findFirst();
    expect(characteristic).not.toBeNull();
    await expect(
      prisma.levelStatement.create({
        data: { characteristicId: characteristic!.id, level: 6, textId: "tidak sah" },
      }),
    ).rejects.toThrow(/LevelStatement_level_range|check constraint/i);
  });

  it("indeks parsial ScoreRun final tersedia", async () => {
    const rows = await prisma.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'ScoreRun_one_final_per_assessment'`,
    );
    expect(rows[0]?.indexdef).toMatch(/UNIQUE INDEX .* WHERE "isFinal"/);
  });
});
