import { describe, expect, it } from "vitest";
import messages from "../../../../messages/id.json";
import { renderReportHtml } from "../html";
import type { ReportContent } from "../types";

const content: ReportContent = {
  schemaVersion: 1,
  version: 2,
  generatedAt: "2027-02-10T03:00:00.000Z",
  organization: { name: "PT <script>alert(1)</script>", legalName: "PT Uji & Rekan", sector: null },
  assessment: { name: "Asesmen 2026", scopeType: "CORPORATE", periodStart: "2026-11-01T00:00:00.000Z", periodEnd: "2027-01-31T00:00:00.000Z", targetLevel: 4, instrumentVersion: "NS-SCML-1.0", surveyOpensAt: null, surveyClosesAt: null, lockedAt: null },
  units: [],
  method: {
    layerWeights: { perception: 0.35, evidence: 0.4, validation: 0.25 },
    selfAssessmentWeight: 0.3,
    divergenceThreshold: 1,
    assessorDisagreementFlag: 1,
    consolidation: { maxAspectBelowLevel: 0.5, maxCharacteristicBelowLevel: 1 },
    perceptionGapAttention: 0.5,
    minCell: 5,
    aspects: [{ code: "A1", name: "Kepemimpinan", weight: 1 }],
    sclThresholds: [],
    samplePlan: null,
    counts: { responses: 10, selfAssessments: 0, evidenceRatings: 2, validationRatings: 1 },
  },
  participation: { minParticipation: 0.3, strata: [], units: [], totals: { population: 100, completed: null, rate: null } },
  reliability: { alphaMin: 0.7, rwgMin: 0.7, alpha: [], rwg: [] },
  result: {
    finalizedAt: null,
    finalizedBy: null,
    organization: { index: 3.14346, engineIndex: 3.14346, indicativeLevel: 3, consolidated: true, gapToTarget: 0.85654, priorityAspect: "A1", contextualIndex: null, minAspectIndex: 3.1, minCharacteristicIndex: 2.5 },
    aspects: [{ code: "A1", name: "Kepemimpinan", weight: 1, index: 3.14346, engineIndex: 3.14346, gapToTarget: 0.85654 }],
    characteristics: [{ code: "K1.1", name: 'Nama "berbahaya" <b>', aspectCode: "A1", isContextual: false, perception: null, perceptionHidden: true, evidence: 3, validation: 3, combined: 3, final: 3, panelAdjusted: null, divergence: null, flags: [] }],
    sclTrack: null,
  },
  perceptionGap: [],
  strataHeatmap: null,
  panel: [],
  gaps: [],
  limitations: [{ code: "SUPPRESSED_CELLS" }],
  appendices: { participants: [], evidence: [], parameters: { layerWeights: { perception: 0.35 } } },
};
const assets = { logoSrc: "/brand/logo-long-color.png", fontSrc: null };
const draft = { status: "DRAFT" as const, signerName: null, signerPosition: null, signedAt: null };

describe("penyaji HTML laporan", () => {
  it("teks dari data di-escape dan dokumen tanpa skrip", () => {
    for (const kind of ["FULL", "EXECUTIVE_SUMMARY", "STATEMENT"] as const) {
      const html = renderReportHtml(content, kind, draft, assets);
      expect(html).not.toContain("<script>");
      expect(html).toContain("PT &lt;script&gt;alert(1)&lt;/script&gt;");
      expect(html).toContain(messages.common.resultDisclaimer);
      expect(html).toContain("3,14");
    }
    expect(renderReportHtml(content, "FULL", draft, assets)).toContain("Nama &quot;berbahaya&quot; &lt;b&gt;");
  });

  it("draf bertanda air dan tanpa tanda tangan; final memuat penanda tangan tanpa tanda air", () => {
    const d = renderReportHtml(content, "STATEMENT", draft, assets);
    expect(d).toContain('class="watermark"');
    expect(d).toContain("Belum ditandatangani");
    const f = renderReportHtml(content, "STATEMENT", { status: "FINAL", signerName: "Rina", signerPosition: "Lead Assessor", signedAt: "2027-02-11T02:30:00.000Z" }, assets);
    expect(f).not.toContain('class="watermark"');
    expect(f).toContain("Rina, Lead Assessor, 11 Februari 2027, 09.30 WIB");
  });

  it("persepsi yang disembunyikan tidak menampilkan angka", () => {
    const html = renderReportHtml(content, "FULL", draft, assets);
    expect(html).toMatch(/K1\.1<\/strong>.*?<td class="num"><span class="muted">Disembunyikan<\/span><\/td>/s);
  });
});
