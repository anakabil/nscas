import { describe, expect, it } from "vitest";
import seedParameters from "../../../../seed/aspek-dan-parameter.json";
import simulation from "../../../../seed/fixtures/skoring-simulasi.json";
import { runEngine, toEngineParameters } from "@/lib/scoring";
import { actionSchema, buildGapList, dueState, progressSchema, quarterOf, reminderDue } from "../rules";

const params = toEngineParameters(seedParameters);
const characteristics = simulation.input.characteristics.map((c) => ({ ...c, perception: c.p, evidence: c.e, validation: c.v }));
const result = runEngine({ characteristics, targetLevel: 4 }, params);

describe("daftar kesenjangan", () => {
  it("karakteristik di bawah sasaran, diurutkan menurut bobot aspek dikali kesenjangan", () => {
    const list = buildGapList(result, params, 4);
    expect(list).toHaveLength(18);
    // K1.3: F = 2,0; kesenjangan 2,0; bobot A1 4800/18000 -> skor 0,5333 (tertinggi).
    expect(list[0]).toMatchObject({ code: "K1.3", rank: 1, currentIndex: 2, gap: 2 });
    expect(list[0]?.priorityScore).toBeCloseTo((4800 / 18000) * 2, 12);
    for (let i = 1; i < list.length; i++) expect(list[i - 1]!.priorityScore).toBeGreaterThanOrEqual(list[i]!.priorityScore);
    // Karakteristik kontekstual tidak berbobot aspek: skor nol, di akhir daftar.
    expect(list.slice(-2).map((g) => [g.code, g.priorityScore])).toEqual([
      ["KT.2", 0],
      ["KT.1", 0],
    ]);
  });

  it("memakai nilai panel bila ada dan mengabaikan karakteristik yang mencapai sasaran", () => {
    const adjusted = runEngine({ characteristics: characteristics.map((c) => (c.code === "K1.3" ? { ...c, panelAdjusted: 3 } : c)), targetLevel: 3 }, params);
    const list = buildGapList(adjusted, params, 3);
    expect(list.find((g) => g.code === "K1.3")).toBeUndefined();
    expect(list.every((g) => g.currentIndex < 3)).toBe(true);
    expect(list.map((g) => g.code)).toContain("K5.1");
  });
});

describe("tenggat dan triwulan", () => {
  const now = new Date("2027-03-10T03:00:00Z"); // 10 Maret 2027, 10.00 WIB
  const at = (d: string) => new Date(`${d}T00:00:00.000Z`);

  it("triwulan dari tanggal tenggat", () => {
    expect(quarterOf(at("2027-03-31"))).toEqual({ year: 2027, quarter: 1, key: "2027-Q1" });
    expect(quarterOf(at("2027-10-01"))).toEqual({ year: 2027, quarter: 4, key: "2027-Q4" });
  });

  it("keadaan tenggat menurut tanggal WIB", () => {
    expect(dueState({ status: "IN_PROGRESS", dueDate: at("2027-03-09") }, now)).toBe("overdue");
    expect(dueState({ status: "IN_PROGRESS", dueDate: at("2027-03-10") }, now)).toBe("dueSoon");
    expect(dueState({ status: "PLANNED", dueDate: at("2027-03-17") }, now)).toBe("dueSoon");
    expect(dueState({ status: "PLANNED", dueDate: at("2027-03-18") }, now)).toBe("onTrack");
    expect(dueState({ status: "DONE", dueDate: at("2027-03-01") }, now)).toBe("closed");
    // 17.30 UTC tanggal 9 sudah tanggal 10 di WIB.
    expect(dueState({ status: "PLANNED", dueDate: at("2027-03-09") }, new Date("2027-03-09T17:30:00Z"))).toBe("overdue");
  });

  it("pengingat paling sering seminggu sekali untuk tindakan terbuka yang mendekati atau lewat tenggat", () => {
    const base = { status: "IN_PROGRESS", dueDate: at("2027-03-12") };
    expect(reminderDue({ ...base, lastReminderAt: null }, now)).toBe(true);
    expect(reminderDue({ ...base, lastReminderAt: new Date("2027-03-03T03:00:00Z") }, now)).toBe(true);
    expect(reminderDue({ ...base, lastReminderAt: new Date("2027-03-04T03:00:00Z") }, now)).toBe(false);
    expect(reminderDue({ ...base, dueDate: at("2027-04-30"), lastReminderAt: null }, now)).toBe(false);
    expect(reminderDue({ ...base, status: "VERIFIED", lastReminderAt: null }, now)).toBe(false);
  });
});

describe("isian tindakan", () => {
  const valid = { title: "Pelatihan pelaporan", description: "", ownerName: "Rina", ownerPosition: "Manajer K3", ownerEmail: "", unitId: "", dueDate: "2027-03-31", successIndicator: "90 persen pekerja terlatih" };
  it("surel penanggung jawab opsional dan tanggal ISO", () => {
    expect(actionSchema.parse(valid)).toMatchObject({ description: null, ownerEmail: null, unitId: null });
    expect(actionSchema.parse({ ...valid, ownerEmail: "Rina@Contoh.co.id" }).ownerEmail).toBe("rina@contoh.co.id");
    expect(actionSchema.safeParse({ ...valid, dueDate: "31-03-2027" }).success).toBe(false);
    expect(actionSchema.safeParse({ ...valid, ownerEmail: "bukan surel" }).success).toBe(false);
  });
  it("catatan kemajuan minimal 10 karakter, kemajuan 0 sampai 100", () => {
    expect(progressSchema.safeParse({ note: "Pelatihan tahap 1 selesai.", progressPercent: "40", status: "IN_PROGRESS" }).success).toBe(true);
    expect(progressSchema.safeParse({ note: "Selesai", progressPercent: "40", status: "IN_PROGRESS" }).success).toBe(false);
    expect(progressSchema.safeParse({ note: "Pelatihan tahap 1 selesai.", progressPercent: "140", status: "IN_PROGRESS" }).success).toBe(false);
    expect(progressSchema.safeParse({ note: "Pelatihan tahap 1 selesai.", progressPercent: "40", status: "VERIFIED" }).success).toBe(false);
  });
});
