import { describe, expect, it } from "vitest";
import {
  areUnitsEditable,
  evaluateTransition,
  findTransition,
  isConfigurationEditable,
  nextTransitions,
  STATUS_ORDER,
  TRANSITIONS,
  type TransitionFacts,
} from "../state-machine";

const ready: TransitionFacts = {
  unitCount: 3,
  strataCount: 5,
  strataWithoutPopulation: 0,
  instrumentPublished: true,
  leadAssessorCount: 1,
  consentTextFilled: true,
  dpaSigned: true,
  samplePlanSaved: true,
  rosterCount: 3000,
  surveyTokenCount: 3000,
  surveyClosed: true,
  characteristicCount: 18,
  characteristicsWithTwoAssessors: 18,
  scoreRunCount: 1,
  finalScoreRun: true,
  unjustifiedAdjustmentCount: 0,
  finalReportSigned: true,
  actionPlanPublished: true,
  retentionExpired: true,
  destructionRecorded: true,
};

const unmet = (from: (typeof STATUS_ORDER)[number], to: (typeof STATUS_ORDER)[number], facts: Partial<TransitionFacts>) =>
  evaluateTransition(findTransition(from, to)!, { ...ready, ...facts })
    .conditions.filter((c) => !c.met)
    .map((c) => c.code);

describe("tabel transisi docs/01 bagian 3", () => {
  it("berurutan dari DRAFT sampai PURGED tanpa melompat", () => {
    for (const t of TRANSITIONS) {
      expect(STATUS_ORDER.indexOf(t.to) - STATUS_ORDER.indexOf(t.from), `${t.from} ke ${t.to}`).toBe(1);
    }
    expect(TRANSITIONS).toHaveLength(STATUS_ORDER.length - 1);
  });

  it("dilakukan LEAD_ASSESSOR, kecuali ARCHIVED ke PURGED oleh SUPER_ADMIN", () => {
    for (const t of TRANSITIONS) expect(t.actorRoles).toEqual(t.to === "PURGED" ? ["SUPER_ADMIN"] : ["LEAD_ASSESSOR"]);
  });

  it("semua transisi lolos bila seluruh fakta terpenuhi", () => {
    for (const t of TRANSITIONS) expect(evaluateTransition(t, ready).allowed, `${t.from} ke ${t.to}`).toBe(true);
  });

  it("tidak ada transisi mundur atau melompat", () => {
    expect(findTransition("LOCKED", "CONFIGURED")).toBeUndefined();
    expect(findTransition("DRAFT", "LOCKED")).toBeUndefined();
    expect(nextTransitions("PURGED")).toEqual([]);
  });
});

describe("syarat setiap transisi", () => {
  it("DRAFT ke CONFIGURED: unit, strata, populasi strata, dan instrumen", () => {
    expect(unmet("DRAFT", "CONFIGURED", { unitCount: 0 })).toEqual(["HAS_UNITS"]);
    expect(unmet("DRAFT", "CONFIGURED", { strataWithoutPopulation: 2 })).toEqual(["STRATA_POPULATED"]);
    expect(unmet("DRAFT", "CONFIGURED", { strataCount: 0 })).toEqual(["HAS_STRATA", "STRATA_POPULATED"]);
    expect(unmet("DRAFT", "CONFIGURED", { instrumentPublished: false })).toEqual(["INSTRUMENT_PUBLISHED"]);
  });

  it("CONFIGURED ke LOCKED: teks persetujuan, perjanjian pemrosesan data, kalkulator sampel, dan konfigurasi diperiksa ulang", () => {
    expect(unmet("CONFIGURED", "LOCKED", { consentTextFilled: false, dpaSigned: false, samplePlanSaved: false })).toEqual([
      "CONSENT_TEXT_FILLED",
      "DPA_SIGNED",
      "SAMPLE_PLAN_SAVED",
    ]);
    expect(unmet("CONFIGURED", "LOCKED", { strataWithoutPopulation: 1 })).toEqual(["STRATA_POPULATED"]);
  });

  it("LOCKED ke DATA_COLLECTION: daftar responden dan token", () => {
    expect(unmet("LOCKED", "DATA_COLLECTION", { rosterCount: 0, surveyTokenCount: 0 })).toEqual(["ROSTER_IMPORTED", "TOKENS_ISSUED"]);
  });

  it("DATA_COLLECTION ke SCORING: survei ditutup dan setiap karakteristik dinilai dua asesor", () => {
    expect(unmet("DATA_COLLECTION", "SCORING", { surveyClosed: false })).toEqual(["SURVEY_CLOSED"]);
    expect(unmet("DATA_COLLECTION", "SCORING", { characteristicsWithTwoAssessors: 17 })).toEqual(["TWO_ASSESSOR_RATINGS"]);
    expect(unmet("DATA_COLLECTION", "SCORING", { characteristicCount: 0, characteristicsWithTwoAssessors: 0 })).toEqual(["TWO_ASSESSOR_RATINGS"]);
  });

  it("transisi sesudahnya", () => {
    expect(unmet("SCORING", "PANEL_REVIEW", { scoreRunCount: 0 })).toEqual(["SCORE_RUN_SAVED"]);
    expect(unmet("PANEL_REVIEW", "ACTION_PLANNING", { unjustifiedAdjustmentCount: 1, finalScoreRun: false })).toEqual(["ADJUSTMENTS_JUSTIFIED", "RESULT_FINAL"]);
    expect(unmet("ACTION_PLANNING", "REPORTED", { finalReportSigned: false })).toEqual(["FINAL_REPORT_SIGNED"]);
    expect(unmet("REPORTED", "MONITORING", { actionPlanPublished: false })).toEqual(["ACTION_PLAN_PUBLISHED"]);
    expect(unmet("MONITORING", "ARCHIVED", {})).toEqual([]);
    expect(unmet("ARCHIVED", "PURGED", { retentionExpired: false, destructionRecorded: false })).toEqual(["RETENTION_EXPIRED", "DESTRUCTION_RECORDED"]);
  });
});

describe("penguncian konfigurasi", () => {
  it("parameter, strata, dan versi instrumen hanya dapat diubah pada DRAFT dan CONFIGURED", () => {
    expect(STATUS_ORDER.filter(isConfigurationEditable)).toEqual(["DRAFT", "CONFIGURED"]);
  });

  it("unit dapat dilengkapi sampai sebelum diarsipkan", () => {
    expect(areUnitsEditable("DATA_COLLECTION")).toBe(true);
    expect(areUnitsEditable("ARCHIVED")).toBe(false);
    expect(areUnitsEditable("PURGED")).toBe(false);
  });
});
