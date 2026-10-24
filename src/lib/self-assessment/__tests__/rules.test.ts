import { describe, expect, it } from "vitest";
import { answerDraftSchema, JUSTIFICATION_MIN_LENGTH, justificationLength, missingForSubmit, profileSchema } from "../rules";

const reason = "Rapat keselamatan bulanan dipimpin direktur operasi dan notulennya ditindaklanjuti.";

describe("syarat kirim penilaian mandiri", () => {
  it("alasan minimal 50 karakter setelah spasi berlebih dibuang", () => {
    expect(JUSTIFICATION_MIN_LENGTH).toBe(50);
    expect(justificationLength("  a   b  ")).toBe(3);
    expect(justificationLength(null)).toBe(0);
    expect(justificationLength(`${"x".repeat(49)}     `)).toBe(49);
  });

  it("melaporkan karakteristik tanpa pernyataan atau dengan alasan pendek", () => {
    const missing = missingForSubmit(
      ["c1", "c2", "c3", "c4"],
      [
        { characteristicId: "c1", level: 4, justification: reason },
        { characteristicId: "c2", level: null, justification: reason },
        { characteristicId: "c3", level: 2, justification: "Terlalu singkat." },
      ],
    );
    expect(missing).toEqual([
      { characteristicId: "c2", reasons: ["LEVEL"] },
      { characteristicId: "c3", reasons: ["JUSTIFICATION"] },
      { characteristicId: "c4", reasons: ["LEVEL", "JUSTIFICATION"] },
    ]);
  });

  it("lengkap bila setiap karakteristik memiliki pernyataan dan alasan", () => {
    expect(missingForSubmit(["c1"], [{ characteristicId: "c1", level: 3, justification: reason }])).toEqual([]);
  });
});

describe("validasi isian", () => {
  it("draf boleh belum lengkap, bukti dibuang duplikatnya", () => {
    const parsed = answerDraftSchema.parse({ characteristicId: "c1", statementId: null, justification: "", evidenceIds: ["e1", "e1", "e2"] });
    expect(parsed.evidenceIds).toEqual(["e1", "e2"]);
  });

  it("identitas wajib nama dan jabatan", () => {
    expect(profileSchema.safeParse({ name: " ", position: "Manajer K3" }).success).toBe(false);
    expect(profileSchema.parse({ name: "  Budi Santoso ", position: "Manajer proyek" })).toEqual({ name: "Budi Santoso", position: "Manajer proyek" });
  });
});
