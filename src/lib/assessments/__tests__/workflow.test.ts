import { describe, expect, it } from "vitest";
import { STATUS_ORDER, TRANSITIONS } from "@/lib/assessments/state-machine";
import { CONDITION_PAGE, conditionHref, PHASES, phaseOf, phaseState } from "@/lib/assessments/workflow";

describe("tahap alur kerja", () => {
  it("setiap status masuk satu tahap, dan urutan tahap mengikuti urutan status", () => {
    const seen = STATUS_ORDER.map(phaseOf).filter((p) => p !== "CLOSED");
    expect([...new Set(seen)]).toEqual([...PHASES]);
    expect(phaseOf("ARCHIVED")).toBe("CLOSED");
    expect(phaseOf("PURGED")).toBe("CLOSED");
  });

  it("menandai tahap selesai, berjalan, dan berikutnya", () => {
    expect(PHASES.map((p) => phaseState(p, "DRAFT"))).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
    expect(PHASES.map((p) => phaseState(p, "LOCKED"))).toEqual(["done", "current", "upcoming", "upcoming"]);
    expect(PHASES.map((p) => phaseState(p, "PANEL_REVIEW"))).toEqual(["done", "done", "current", "upcoming"]);
    expect(PHASES.map((p) => phaseState(p, "MONITORING"))).toEqual(["done", "done", "done", "current"]);
    expect(PHASES.map((p) => phaseState(p, "ARCHIVED"))).toEqual(["done", "done", "done", "done"]);
  });

  it("setiap syarat transisi memiliki halaman tujuan", () => {
    const codes = new Set(TRANSITIONS.flatMap((t) => t.conditions));
    for (const code of codes) expect(CONDITION_PAGE[code]).toBeDefined();
    expect(conditionHref("abc", "HAS_UNITS")).toBe("/assessments/abc/setup/units");
    expect(conditionHref("abc", "INSTRUMENT_PUBLISHED")).toBe("/assessments/abc/setup");
    expect(conditionHref("abc", "DESTRUCTION_RECORDED")).toBe("/retention");
  });
});
