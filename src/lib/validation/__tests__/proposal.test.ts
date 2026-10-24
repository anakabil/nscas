import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allocate, isValidRating, proposeSessions, splitIntoSessions } from "../proposal";

// Strata sampel 3.000 pekerja (seed/fixtures/sampel-3000.json): wawancara minimum 33 dan 66, 4 proyek.
const fixture = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "..", "seed", "fixtures", "sampel-3000.json"), "utf8")) as {
  expected: { strata: { code: string; population: number }[] };
};
const GROUPS: Record<string, "MANAGEMENT" | "SUPERVISORY" | "FIELD"> = { S1: "MANAGEMENT", S2: "MANAGEMENT", S3: "SUPERVISORY", S4: "FIELD", S5: "FIELD" };
const strata = fixture.expected.strata.map((s) => ({ id: s.code, code: s.code, group: GROUPS[s.code] ?? "FIELD", population: s.population }));

describe("pembagian proporsional", () => {
  it("jumlah tetap sama dengan total dan sebanding populasi", () => {
    const result = allocate(10, [
      { id: "a", population: 50 },
      { id: "b", population: 30 },
      { id: "c", population: 20 },
    ]);
    expect([...result.values()]).toEqual([5, 3, 2]);
    const uneven = allocate(7, [
      { id: "a", population: 10 },
      { id: "b", population: 10 },
      { id: "c", population: 10 },
    ]);
    expect([...uneven.values()].reduce((a, b) => a + b, 0)).toBe(7);
  });

  it("strata yang sangat kecil dapat tidak mendapat jatah menurut sisa terbesar", () => {
    const result = allocate(10, [
      { id: "kecil", population: 1 },
      { id: "besar", population: 100 },
    ]);
    expect([result.get("kecil"), result.get("besar")]).toEqual([0, 10]);
  });

  it("tidak melebihi populasi strata bila kuota lebih besar dari seluruh populasi", () => {
    expect([...allocate(50, [{ id: "a", population: 3 }]).values()]).toEqual([3]);
    expect([...allocate(10, [{ id: "a", population: 2 }, { id: "b", population: 3 }]).values()]).toEqual([2, 3]);
  });
});

describe("pembagian peserta ke sesi", () => {
  it("maksimal 8 peserta per sesi dan dibagi rata", () => {
    expect(splitIntoSessions(17, 8)).toEqual([6, 6, 5]);
    expect(splitIntoSessions(16, 8)).toEqual([8, 8]);
    expect(splitIntoSessions(3, 8)).toEqual([3]);
    expect(splitIntoSessions(0, 8)).toEqual([]);
  });
});

describe("usulan sesi validasi", () => {
  const proposal = proposeSessions({ interviewsManagement: 33, interviewsOperational: 66, projectsToVisit: 4, strata, maxParticipantsPerSession: 8 });

  it("wawancara hanya untuk MANAGEMENT dan SUPERVISORY, satu orang per sesi, berjumlah 33", () => {
    expect(proposal.interviews.reduce((s, i) => s + i.count, 0)).toBe(33);
    expect(proposal.interviews.every((i) => ["S1", "S2", "S3"].includes(i.code))).toBe(true);
    const sessions = proposal.sessions.filter((s) => s.type === "INTERVIEW");
    expect(sessions).toHaveLength(33);
    expect(sessions.every((s) => s.participantCount === 1)).toBe(true);
  });

  it("diskusi kelompok hanya untuk SUPERVISORY dan FIELD, 66 peserta, maksimal 8 per sesi", () => {
    expect(proposal.focusGroups.every((g) => ["S3", "S4", "S5"].includes(g.code))).toBe(true);
    const sessions = proposal.sessions.filter((s) => s.type === "FOCUS_GROUP");
    expect(sessions.reduce((sum, s) => sum + s.participantCount, 0)).toBe(66);
    expect(sessions.every((s) => s.participantCount >= 1 && s.participantCount <= 8)).toBe(true);
    for (const g of proposal.focusGroups) expect(g.sessions).toBe(Math.ceil(g.participants / 8));
  });

  it("kunjungan virtual sebanyak proyek yang dikunjungi, dengan panduan lapisan sesuai strata", () => {
    expect(proposal.sessions.filter((s) => s.type === "VIRTUAL_SITE_VISIT")).toHaveLength(4);
    expect(proposal.sessions.filter((s) => s.stratumCode === "S1").every((s) => s.layer === "MANAGEMENT")).toBe(true);
    expect(proposal.unallocated).toEqual({ interviews: 0, focusGroupParticipants: 0 });
  });

  it("kuota yang tidak dapat dibagi dilaporkan bila strata yang sesuai tidak ada", () => {
    const fieldOnly = proposeSessions({ interviewsManagement: 14, interviewsOperational: 27, projectsToVisit: 1, strata: strata.filter((s) => s.group === "FIELD"), maxParticipantsPerSession: 8 });
    expect(fieldOnly.unallocated.interviews).toBe(14);
    expect(fieldOnly.interviews).toEqual([]);
  });
});

describe("nilai validasi", () => {
  it("1,0 sampai 5,0 kelipatan 0,5", () => {
    for (const ok of [1, 1.5, 3, 4.5, 5]) expect(isValidRating(ok)).toBe(true);
    for (const bad of [0.5, 5.5, 3.25, 2.7, Number.NaN]) expect(isValidRating(bad)).toBe(false);
  });
});
