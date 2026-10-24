// Penyaji HTML laporan (docs/01 M11 dan bagian 6). Murni: menerima snapshot isi dan mengembalikan dokumen HTML
// lengkap yang siap dicetak A4, tanpa skrip. Dipakai halaman pratinjau (aset melalui URL) dan worker PDF (aset
// disematkan sebagai data URI). Teks dari messages/*.json; angka dan tanggal dalam format Indonesia (docs/05).

import { createTranslator } from "use-intl/core";
import en from "../../../messages/en.json";
import id from "../../../messages/id.json";
import type { ReportContent, ReportKind } from "./types";

export interface ReportAssets {
  logoSrc: string;
  /** Plus Jakarta Sans; null memakai huruf sistem. */
  fontSrc: string | null;
}

export interface ReportSignature {
  status: "DRAFT" | "FINAL";
  signerName: string | null;
  signerPosition: string | null;
  signedAt: string | null;
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

const TZ = "Asia/Jakarta";

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);
}

const num = (v: number | null | undefined, digits = 2) => (v === null || v === undefined ? "" : new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v));
const pct = (v: number | null | undefined, digits = 1) => (v === null || v === undefined ? "" : `${num(v * 100, digits)}%`);
const date = (v: string | null) => (v ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(new Date(v)) : "");
const dateOnly = (v: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(v.length === 10 ? `${v}T00:00:00Z` : v));
function dateTime(v: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ }).format(d);
  return `${date(v)}, ${time} WIB`;
}

function table(headers: string[], rows: string[][], options: { numeric?: number[]; className?: string } = {}): string {
  const numeric = new Set(options.numeric ?? []);
  const th = headers.map((h, i) => `<th${numeric.has(i) ? ' class="num"' : ""}>${esc(h)}</th>`).join("");
  const body = rows.map((r) => `<tr>${r.map((c, i) => `<td${numeric.has(i) ? ' class="num"' : ""}>${c}</td>`).join("")}</tr>`).join("");
  return `<table class="${options.className ?? ""}"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

const HEAT: Record<string, string> = { good: "#D7F0E3", mid: "#FFF1C7", low: "#F8D7D5" };
const heat = (v: number) => (v >= 3.3 - 1e-9 ? HEAT.good : v >= 2.8 - 1e-9 ? HEAT.mid : HEAT.low);

/** Grafik batang SVG indeks per aspek terhadap sasaran (tanpa skrip). */
function aspectChart(aspects: { code: string; index: number }[], target: number, t: Translate): string {
  const w = 640;
  const h = 240;
  const left = 36;
  const bottom = 28;
  const top = 12;
  const plotH = h - top - bottom;
  const band = (w - left - 8) / Math.max(1, aspects.length);
  const y = (v: number) => top + plotH - (v / 5) * plotH;
  const grid = [0, 1, 2, 3, 4, 5].map((v) => `<line x1="${left}" x2="${w - 8}" y1="${y(v)}" y2="${y(v)}" stroke="#D3D6E8" stroke-dasharray="3 3"/><text x="${left - 6}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="#5E6075">${v}</text>`).join("");
  const bars = aspects
    .map((a, i) => {
      const x = left + i * band + band * 0.2;
      const bw = band * 0.6;
      const color = a.index < target ? "#FDC830" : "#000B9D";
      return `<rect x="${x}" y="${y(a.index)}" width="${bw}" height="${y(0) - y(a.index)}" fill="${color}" rx="3"/><text x="${x + bw / 2}" y="${y(a.index) - 4}" font-size="11" text-anchor="middle" fill="#1B1B33">${num(a.index)}</text><text x="${x + bw / 2}" y="${h - 10}" font-size="11" text-anchor="middle" fill="#1B1B33">${esc(a.code)}</text>`;
    })
    .join("");
  const targetLine = `<line x1="${left}" x2="${w - 8}" y1="${y(target)}" y2="${y(target)}" stroke="#C2410C" stroke-dasharray="6 4" stroke-width="1.5"/><text x="${w - 10}" y="${y(target) - 4}" font-size="11" text-anchor="end" fill="#C2410C">${esc(t("chart.target", { level: target }))}</text>`;
  return `<figure class="chart"><svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${esc(t("chart.title"))}">${grid}${bars}${targetLine}</svg><figcaption>${esc(t("chart.caption"))}</figcaption></figure>`;
}

function styles(assets: ReportAssets): string {
  const font = assets.fontSrc ? `@font-face{font-family:"Plus Jakarta Sans";src:url("${assets.fontSrc}") format("woff2");font-weight:200 800;font-style:normal;}` : "";
  return `${font}
@page{size:A4;margin:20mm 18mm 22mm 18mm;}
*{box-sizing:border-box;}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
body{font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#1B1B33;font-size:10.5pt;line-height:1.5;margin:0;background:#fff;}
.page{max-width:174mm;margin:0 auto;}
h1{color:#000B9D;font-size:22pt;line-height:1.2;margin:0 0 6mm;}
h2{color:#000B9D;font-size:14pt;margin:8mm 0 3mm;break-after:avoid;break-inside:avoid;}
h3{font-size:11.5pt;margin:5mm 0 2mm;break-after:avoid;}
p{margin:0 0 3mm;}
.muted{color:#5E6075;}
.section{margin-top:6mm;}
.page-start{break-before:page;}
.cover{min-height:240mm;display:flex;flex-direction:column;justify-content:space-between;}
.logo-wrap{display:inline-block;background:#000B9D;border-radius:2mm;padding:2.5mm 3.5mm;}
.logo{height:9mm;display:block;}
.badge{display:inline-block;border-radius:999px;padding:1mm 3mm;font-size:9pt;font-weight:600;background:#EBEDFA;color:#000B9D;}
.badge.final{background:#D7F0E3;color:#1E9E6A;}
.badge.draft{background:#FFF1C7;color:#B45309;}
.standing{border:1.5px solid #000B9D;border-radius:3mm;padding:4mm;background:#EBEDFA;margin:5mm 0;break-inside:avoid;}
.standing strong{display:block;color:#000B9D;margin-bottom:1mm;}
table{width:100%;border-collapse:collapse;margin:2mm 0 4mm;font-size:9pt;}
th{background:#000B9D;color:#fff;text-align:left;font-weight:600;padding:1.5mm 2mm;}
td{border-bottom:0.3mm solid #D3D6E8;padding:1.4mm 2mm;vertical-align:top;}
tr{break-inside:avoid;}
.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}
.kv td:first-child{color:#5E6075;width:38%;}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin:3mm 0 5mm;}
.card{border:0.3mm solid #D3D6E8;border-radius:3mm;padding:3mm;break-inside:avoid;}
.card .label{color:#5E6075;font-size:8.5pt;}
.card .value{font-size:20pt;font-weight:700;color:#000B9D;font-variant-numeric:tabular-nums;}
.chart{margin:2mm 0 5mm;break-inside:avoid;}
.chart figcaption{color:#5E6075;font-size:8.5pt;}
.flag{display:inline-block;background:#FFF1C7;color:#B45309;border-radius:1mm;padding:0 1.5mm;font-size:8pt;margin:0 1mm 1mm 0;}
.hidden-cell{background:repeating-linear-gradient(135deg,#E5E7EF 0 6px,#d5d8e4 6px 8px);color:#5E6075;text-align:center;font-size:8pt;}
.heat td.cell{text-align:center;font-variant-numeric:tabular-nums;}
.signature{border-top:0.4mm solid #000B9D;margin-top:8mm;padding-top:3mm;break-inside:avoid;}
.watermark{position:fixed;top:45%;left:0;right:0;text-align:center;font-size:72pt;font-weight:800;color:rgba(180,83,9,0.08);transform:rotate(-30deg);pointer-events:none;}
ul{margin:0 0 3mm 5mm;padding:0;}
li{margin-bottom:1mm;}
.toc li{list-style:decimal;margin-left:4mm;}
code{font-size:8pt;word-break:break-all;}
@media screen{body{background:#F6F7FC;}.page{background:#fff;padding:16mm 18mm;margin:8mm auto;box-shadow:0 1px 3px rgba(0,0,0,0.08);}}`;
}

function signature(sig: ReportSignature, t: Translate): string {
  if (sig.status === "FINAL") {
    return `<div class="signature" data-signature="final"><p><strong>${esc(t("signature.signed"))}</strong></p><p>${esc(t("signature.by", { name: sig.signerName ?? "", position: sig.signerPosition ?? "", time: dateTime(sig.signedAt) }))}</p><p class="muted">${esc(t("signature.locked"))}</p></div>`;
  }
  return `<div class="signature" data-signature="draft"><p><strong>${esc(t("signature.unsigned"))}</strong></p><p class="muted">${esc(t("signature.draftNote"))}</p></div>`;
}

function standing(t: Translate, statement: string): string {
  return `<div class="standing" data-testid="standing-statement"><strong>${esc(t("standingTitle"))}</strong>${esc(statement)}</div>`;
}

function levelName(level: number, t: Translate): string {
  return t(`levels.${level}`);
}

function headerBlock(c: ReportContent, title: string, sig: ReportSignature, assets: ReportAssets, t: Translate): string {
  return `<header><span class="logo-wrap"><img class="logo" src="${esc(assets.logoSrc)}" alt="${esc(t("logoAlt"))}"></span><h1>${esc(title)}</h1><p><strong>${esc(c.organization.name)}</strong><br>${esc(c.assessment.name)}<br>${esc(t("period", { start: dateOnly(c.assessment.periodStart), end: dateOnly(c.assessment.periodEnd) }))}</p><p><span class="badge ${sig.status === "FINAL" ? "final" : "draft"}">${esc(t(sig.status === "FINAL" ? "finalBadge" : "draftBadge", { version: c.version }))}</span></p></header>`;
}

function fullReport(c: ReportContent, sig: ReportSignature, assets: ReportAssets, t: Translate, statement: string): string {
  const r = c.result;
  const sections: string[] = [];
  const head = (n: number) => `<h2>${n}. ${esc(t(`sections.${n}`))}</h2>`;

  sections.push(`<section class="section page-start" id="s1">${head(1)}${table(
    [t("columns.item"), t("columns.value")],
    [
      [t("scope.organization"), esc(c.organization.legalName)],
      [t("scope.sector"), esc(c.organization.sector ?? "")],
      [t("scope.scopeType"), esc(t(`scopes.${c.assessment.scopeType}`))],
      [t("scope.period"), esc(t("period", { start: dateOnly(c.assessment.periodStart), end: dateOnly(c.assessment.periodEnd) }))],
      [t("scope.survey"), esc(c.assessment.surveyOpensAt ? t("period", { start: date(c.assessment.surveyOpensAt), end: date(c.assessment.surveyClosesAt) }) : "")],
      [t("scope.target"), esc(levelName(c.assessment.targetLevel, t))],
    ],
    { className: "kv" },
  )}<h3>${esc(t("scope.units"))}</h3>${table([t("columns.unit"), t("columns.unitType"), t("columns.parent")], c.units.map((u) => [esc(u.name), esc(t(`unitTypes.${u.type}`)), esc(u.parentName ?? "")]))}</section>`);

  const m = c.method;
  sections.push(`<section class="section" id="s2">${head(2)}<p>${esc(t("method.intro"))}</p>${table(
    [t("columns.item"), t("columns.value")],
    [
      [t("method.instrument"), esc(c.assessment.instrumentVersion)],
      [t("method.layerWeights"), esc(t("method.layerWeightsValue", { p: num(m.layerWeights.perception), e: num(m.layerWeights.evidence), v: num(m.layerWeights.validation) }))],
      [t("method.selfAssessment"), esc(num(m.selfAssessmentWeight))],
      [t("method.divergence"), esc(num(m.divergenceThreshold))],
      [t("method.disagreement"), esc(num(m.assessorDisagreementFlag))],
      [t("method.consolidation"), esc(t("method.consolidationValue", { aspect: num(m.consolidation.maxAspectBelowLevel), characteristic: num(m.consolidation.maxCharacteristicBelowLevel) }))],
      [t("method.gapAttention"), esc(num(m.perceptionGapAttention))],
      [t("method.minCell"), esc(m.minCell)],
      [t("method.counts"), esc(t("method.countsValue", { responses: m.counts.responses, selfAssessments: m.counts.selfAssessments, evidence: m.counts.evidenceRatings, validation: m.counts.validationRatings }))],
    ],
    { className: "kv" },
  )}<h3>${esc(t("method.aspectWeights"))}</h3>${table([t("columns.aspect"), t("columns.weight")], m.aspects.map((a) => [`${esc(a.code)} ${esc(a.name)}`, esc(pct(a.weight, 2))]), { numeric: [1] })}${
    m.samplePlan
      ? `<h3>${esc(t("method.sample"))}</h3><p>${esc(t("method.sampleSummary", { workers: m.samplePlan.workers, recommended: m.samplePlan.surveyRecommended, total: m.samplePlan.surveyTargetTotal, interviewsM: m.samplePlan.interviewsManagement, interviewsO: m.samplePlan.interviewsOperational, projects: m.samplePlan.projectsToVisit }))}</p>${table(
          [t("columns.stratum"), t("columns.population"), t("columns.target")],
          m.samplePlan.strata.map((s) => [`${esc(s.code)} ${esc(s.name)}`, esc(num(s.population, 0)), esc(num(s.target, 0))]),
          { numeric: [1, 2] },
        )}`
      : ""
  }</section>`);

  const p = c.participation;
  const below = p.strata.filter((s) => s.belowMinimum);
  sections.push(`<section class="section" id="s3">${head(3)}${table(
    [t("columns.stratum"), t("columns.population"), t("columns.completed"), t("columns.rate"), t("columns.note")],
    p.strata.map((s) => [`${esc(s.code)} ${esc(s.name)}`, esc(num(s.population, 0)), s.completed === null ? `<span class="muted">${esc(t("hidden"))}</span>` : esc(num(s.completed, 0)), esc(pct(s.rate)), s.belowMinimum ? esc(t("participation.belowMinimum")) : ""]),
    { numeric: [1, 2, 3] },
  )}<h3>${esc(t("participation.units"))}</h3>${table([t("columns.unit"), t("columns.completed"), t("columns.rate")], p.units.map((u) => [esc(u.name), u.completed === null ? `<span class="muted">${esc(t("hidden"))}</span>` : esc(num(u.completed, 0)), esc(pct(u.rate))]), { numeric: [1, 2] })}<p>${esc(
    below.length ? t("participation.representativeLow", { count: below.length, min: pct(p.minParticipation, 0), strata: below.map((s) => s.code).join(", ") }) : t("participation.representativeOk", { min: pct(p.minParticipation, 0) }),
  )}</p></section>`);

  const rel = c.reliability;
  sections.push(`<section class="section" id="s4">${head(4)}<p>${esc(t("reliability.intro", { alpha: num(rel.alphaMin), rwg: num(rel.rwgMin) }))}</p><h3>${esc(t("reliability.alpha"))}</h3>${table(
    [t("columns.dimension"), t("columns.value"), t("columns.respondents"), t("columns.note")],
    rel.alpha.map((a) => [`${esc(a.code)} ${esc(a.name)}`, a.value === null ? `<span class="muted">${esc(t("hidden"))}</span>` : esc(num(a.value)), esc(a.n ?? ""), a.below ? esc(t("reliability.below")) : ""]),
    { numeric: [1, 2] },
  )}<h3>${esc(t("reliability.rwg"))}</h3>${table(
    [t("columns.unit"), t("columns.value"), t("columns.respondents"), t("columns.note")],
    rel.rwg.map((u) => [esc(u.name), u.value === null ? `<span class="muted">${esc(t("hidden"))}</span>` : esc(num(u.value)), esc(u.n ?? ""), u.below ? esc(t("reliability.below")) : ""]),
    { numeric: [1, 2] },
  )}</section>`);

  const levelAspects = r.aspects.filter((a) => m.aspects.some((x) => x.code === a.code));
  sections.push(`<section class="section" id="s5">${head(5)}<div class="cards"><div class="card"><div class="label">${esc(t("result.index"))}</div><div class="value" data-testid="report-index">${esc(num(r.organization.index))}</div><div>${esc(levelName(r.organization.indicativeLevel, t))}</div></div><div class="card"><div class="label">${esc(t("result.gap"))}</div><div class="value">${esc(num(r.organization.gapToTarget))}</div><div>${esc(t("result.target", { level: c.assessment.targetLevel }))}</div></div><div class="card"><div class="label">${esc(t("result.priority"))}</div><div class="value">${esc(r.organization.priorityAspect)}</div><div>${esc(m.aspects.find((a) => a.code === r.organization.priorityAspect)?.name ?? "")}</div></div></div>${aspectChart(levelAspects, c.assessment.targetLevel, t)}${table(
    [t("columns.aspect"), t("columns.weight"), t("columns.engine"), t("columns.final"), t("columns.gap")],
    levelAspects.map((a) => [`${esc(a.code)} ${esc(a.name)}`, esc(pct(a.weight, 2)), esc(num(a.engineIndex)), esc(num(a.index)), esc(num(a.gapToTarget))]),
    { numeric: [1, 2, 3, 4] },
  )}<h3>${esc(t("result.matrix"))}</h3><p class="muted">${esc(t("result.matrixNote"))}</p>${table(
    [t("columns.characteristic"), t("columns.perception"), t("columns.evidence"), t("columns.validation"), t("columns.combined"), t("columns.final"), t("columns.panel"), t("columns.flags")],
    r.characteristics
      .filter((x) => !x.isContextual)
      .map((x) => [
        `<strong>${esc(x.code)}</strong> ${esc(x.name)}`,
        x.perceptionHidden ? `<span class="muted">${esc(t("hidden"))}</span>` : esc(num(x.perception)),
        esc(num(x.evidence)),
        esc(num(x.validation)),
        esc(num(x.combined)),
        esc(num(x.final)),
        esc(num(x.panelAdjusted)),
        x.flags.map((f) => `<span class="flag">${esc(t(`flags.${f}`))}</span>`).join(""),
      ]),
    { numeric: [1, 2, 3, 4, 5, 6] },
  )}</section>`);

  const divergent = r.characteristics.filter((x) => x.flags.includes("SELISIH_PERSEPSI_BUKTI"));
  sections.push(`<section class="section" id="s6">${head(6)}<p>${esc(t("divergence.intro", { threshold: num(m.divergenceThreshold) }))}</p>${
    divergent.length
      ? `<ul>${divergent
          .map(
            (x) =>
              `<li><strong>${esc(x.code)} ${esc(x.name)}</strong>: ${esc(
                x.perceptionHidden
                  ? t("divergence.itemHidden", { evidence: num(x.evidence), final: num(x.final) })
                  : (x.perception ?? 0) > (x.evidence ?? 0)
                    ? t("divergence.itemLower", { perception: num(x.perception), evidence: num(x.evidence), gap: num(x.divergence), final: num(x.final) })
                    : t("divergence.itemHigher", { perception: num(x.perception), evidence: num(x.evidence), gap: num(x.divergence), final: num(x.final) }),
              )}</li>`,
          )
          .join("")}</ul>`
      : `<p>${esc(t("divergence.none"))}</p>`
  }</section>`);

  const heatmap = c.strataHeatmap;
  sections.push(`<section class="section" id="s7">${head(7)}<p>${esc(t("gap.intro", { attention: num(m.perceptionGapAttention), min: m.minCell }))}</p>${table(
    [t("columns.aspect"), t("columns.management"), t("columns.field"), t("columns.difference"), t("columns.note")],
    c.perceptionGap.map((g) => [
      `${esc(g.code)} ${esc(g.name)}`,
      g.suppressed ? "" : esc(num(g.management)),
      g.suppressed ? "" : esc(num(g.field)),
      g.suppressed ? "" : esc(num(g.gap)),
      g.suppressed ? esc(t("hiddenLong")) : g.attention ? esc(t("gap.attention")) : "",
    ]),
    { numeric: [1, 2, 3] },
  )}${
    heatmap && heatmap.columns.length
      ? `<h3>${esc(t("gap.heatmap"))}</h3><table class="heat"><thead><tr><th>${esc(t("columns.aspect"))}</th>${heatmap.columns.map((col) => `<th>${esc(col.label)}</th>`).join("")}</tr></thead><tbody>${heatmap.rows
          .map(
            (row) =>
              `<tr><td>${esc(row.aspectCode)} ${esc(row.aspectName)}</td>${row.cells
                .map((cell) =>
                  cell.state === "visible" && cell.value !== null
                    ? `<td class="cell" style="background:${heat(cell.value)}">${esc(num(cell.value))}<br><span class="muted">${esc(t("respondents", { n: cell.n ?? 0 }))}</span></td>`
                    : cell.state === "empty"
                      ? `<td class="cell muted">${esc(t("empty"))}</td>`
                      : `<td class="hidden-cell">${esc(t("hidden"))}</td>`,
                )
                .join("")}</tr>`,
          )
          .join("")}</tbody></table><p class="muted">${esc(t("gap.heatmapNote"))}</p>`
      : ""
  }</section>`);

  sections.push(`<section class="section" id="s8">${head(8)}${table(
    [t("columns.item"), t("columns.value")],
    [
      [t("result.level"), `<strong>${esc(levelName(r.organization.indicativeLevel, t))}</strong>`],
      [t("result.consolidated"), esc(r.organization.consolidated ? t("result.consolidatedYes") : t("result.consolidatedNo"))],
      [t("result.consolidationBasis"), esc(t("result.consolidationValue", { aspect: num(r.organization.minAspectIndex), characteristic: num(r.organization.minCharacteristicIndex) }))],
      [t("result.engineIndex"), esc(num(r.organization.engineIndex))],
      [t("result.finalIndex"), esc(num(r.organization.index))],
      [t("result.finalizedBy"), esc(r.finalizedBy ? t("result.finalizedValue", { name: r.finalizedBy, time: dateTime(r.finalizedAt) }) : "")],
    ],
    { className: "kv" },
  )}<h3>${esc(t("panel.title"))}</h3>${
    c.panel.length
      ? table(
          [t("columns.characteristic"), t("columns.engine"), t("columns.panel"), t("columns.rationale")],
          c.panel.map((a) => [`<strong>${esc(a.code)}</strong> ${esc(a.name)}`, esc(num(a.engineValue)), esc(num(a.adjustedValue)), `${esc(a.rationale)}<br><span class="muted">${esc(t("panel.decided", { name: a.decidedBy, time: dateTime(a.decidedAt) }))}</span>`]),
          { numeric: [1, 2] },
        )
      : `<p>${esc(t("panel.none"))}</p>`
  }<h3>${esc(t("scl.title"))}</h3>${
    r.sclTrack
      ? `<p>${esc(t("scl.level", { level: levelName(r.sclTrack.indicativeLevel, t) }))}</p>${table(
          [t("columns.step"), t("columns.weightedAverage"), t("columns.minimum"), t("columns.threshold"), t("columns.result")],
          r.sclTrack.steps.map((s) => {
            const th = m.sclThresholds.find((x) => x.step === s.step);
            return [esc(s.step), esc(pct(s.weightedAverage)), esc(pct(s.minimum)), esc(th ? t("scl.thresholdValue", { average: pct(th.minWeightedAverage, 0), minimum: pct(th.minPerAspect, 0) }) : ""), esc(s.passed ? t("scl.passed") : t("scl.failed"))];
          }),
          { numeric: [1, 2] },
        )}`
      : `<p>${esc(t("scl.missing"))}</p>`
  }</section>`);

  const contextual = r.characteristics.filter((x) => x.isContextual);
  sections.push(`<section class="section" id="s9">${head(9)}<p>${esc(t("contextual.intro"))}</p>${table(
    [t("columns.characteristic"), t("columns.perception"), t("columns.evidence"), t("columns.validation"), t("columns.final"), t("columns.panel")],
    contextual.map((x) => [`<strong>${esc(x.code)}</strong> ${esc(x.name)}`, x.perceptionHidden ? `<span class="muted">${esc(t("hidden"))}</span>` : esc(num(x.perception)), esc(num(x.evidence)), esc(num(x.validation)), esc(num(x.final)), esc(num(x.panelAdjusted))]),
    { numeric: [1, 2, 3, 4, 5] },
  )}<p>${esc(t("contextual.index", { value: num(r.organization.contextualIndex) }))}</p></section>`);

  sections.push(`<section class="section" id="s10">${head(10)}<p>${esc(t("gaps.intro"))}</p>${
    c.gaps.length
      ? c.gaps
          .map(
            (g) =>
              `<div style="break-inside:avoid"><h3>${esc(t("gaps.item", { rank: g.rank, code: g.code, name: g.name }))}</h3><p class="muted">${esc(t("gaps.metrics", { current: num(g.currentIndex), gap: num(g.gap), score: num(g.priorityScore, 3), priority: g.priority ? t(`priorities.${g.priority}`) : t("gaps.noPriority") }))}</p>${
                g.rootCause ? `<p><strong>${esc(t("gaps.rootCause"))}</strong> ${esc(g.rootCause)}</p>` : ""
              }${
                g.actions.length
                  ? table(
                      [t("columns.action"), t("columns.owner"), t("columns.dueDate"), t("columns.indicator"), t("columns.status")],
                      g.actions.map((a) => [esc(a.title), esc(`${a.owner}, ${a.position}${a.unit ? ` (${a.unit})` : ""}`), esc(dateOnly(a.dueDate)), esc(a.indicator), esc(t(`statuses.${a.status}`))]),
                    )
                  : `<p class="muted">${esc(t("gaps.noActions"))}</p>`
              }</div>`,
          )
          .join("")
      : `<p>${esc(t("gaps.none"))}</p>`
  }</section>`);

  sections.push(`<section class="section" id="s11">${head(11)}<ul>${c.limitations.map((l) => `<li>${esc(t(`limitations.${l.code}`))}${l.items?.length ? ` ${esc(l.items.join(", "))}.` : ""}</li>`).join("")}</ul>${standing(t, statement)}${signature(sig, t)}</section>`);

  const a = c.appendices;
  const paramRows = flattenParameters(a.parameters);
  sections.push(`<section class="section page-start" id="s12">${head(12)}<h3>${esc(t("appendix.participants"))}</h3><p class="muted">${esc(t("appendix.participantsNote"))}</p>${
    a.participants.length
      ? table([t("columns.session"), t("columns.date"), t("columns.people")], a.participants.map((s) => [`${esc(s.session)}<br><span class="muted">${esc(t(`sessionTypes.${s.type}`))}</span>`, esc(date(s.scheduledAt)), s.people.map((p_) => `${esc(p_.fullName)}, ${esc(p_.position)}`).join("<br>")]))
      : `<p>${esc(t("appendix.none"))}</p>`
  }<h3>${esc(t("appendix.evidence"))}</h3>${
    a.evidence.length
      ? table(
          [t("columns.evidenceTitle"), t("columns.unit"), t("columns.version"), t("columns.characteristics"), t("columns.hash"), t("columns.uploaded")],
          a.evidence.map((e) => [esc(e.title), esc(e.unit ?? t("appendix.organizationLevel")), esc(e.version), esc(e.codes.join(", ")), `<code>${esc(e.sha256.slice(0, 16))}</code>`, esc(date(e.uploadedAt))]),
        )
      : `<p>${esc(t("appendix.none"))}</p>`
  }<h3>${esc(t("appendix.parameters"))}</h3><p class="muted">${esc(t("appendix.parametersNote", { locked: dateTime(c.assessment.lockedAt) }))}</p>${table([t("columns.parameter"), t("columns.value")], paramRows.map(([k, v]) => [`<code>${esc(k)}</code>`, esc(v)]), { className: "kv" })}</section>`);

  const cover = `<section class="cover"><div><span class="logo-wrap"><img class="logo" src="${esc(assets.logoSrc)}" alt="${esc(t("logoAlt"))}"></span><p class="muted" style="margin-top:20mm">${esc(t("full.kicker"))}</p><h1>${esc(t("full.title"))}</h1><p style="font-size:13pt"><strong>${esc(c.organization.name)}</strong><br>${esc(c.assessment.name)}</p><p>${esc(t("period", { start: dateOnly(c.assessment.periodStart), end: dateOnly(c.assessment.periodEnd) }))}</p><p><span class="badge ${sig.status === "FINAL" ? "final" : "draft"}">${esc(t(sig.status === "FINAL" ? "finalBadge" : "draftBadge", { version: c.version }))}</span></p></div><div>${standing(t, statement)}<p class="muted">${esc(t("generated", { time: dateTime(c.generatedAt) }))}</p><p class="muted">${esc(t("owner"))}</p></div></section><section class="section page-start"><h2>${esc(t("toc"))}</h2><ol class="toc">${Array.from({ length: 12 }, (_, i) => `<li>${esc(t(`sections.${i + 1}`))}</li>`).join("")}</ol></section>`;
  return cover + sections.join("");
}

function flattenParameters(value: unknown, prefix = ""): [string, string][] {
  if (value === null || value === undefined) return [[prefix, ""]];
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v !== "object" || v === null)) return [[prefix, value.join(", ")]];
    return value.flatMap((v, i) => {
      const label = v && typeof v === "object" && "code" in v ? String((v as { code: unknown }).code) : String(i + 1);
      return flattenParameters(v, `${prefix}[${label}]`);
    });
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([k]) => !k.startsWith("_"))
      .flatMap(([k, v]) => flattenParameters(v, prefix ? `${prefix}.${k}` : k));
  }
  return [[prefix, typeof value === "number" ? String(value).replace(".", ",") : String(value)]];
}

function executiveSummary(c: ReportContent, sig: ReportSignature, assets: ReportAssets, t: Translate, statement: string): string {
  const r = c.result;
  const levelAspects = r.aspects.filter((a) => c.method.aspects.some((x) => x.code === a.code));
  const divergent = r.characteristics.filter((x) => x.flags.includes("SELISIH_PERSEPSI_BUKTI"));
  const attention = c.perceptionGap.filter((g) => g.attention && !g.suppressed);
  const top = c.gaps.slice(0, 5);
  return `${headerBlock(c, t("executive.title"), sig, assets, t)}<div class="cards"><div class="card"><div class="label">${esc(t("result.index"))}</div><div class="value" data-testid="report-index">${esc(num(r.organization.index))}</div><div>${esc(levelName(r.organization.indicativeLevel, t))}</div></div><div class="card"><div class="label">${esc(t("result.consolidated"))}</div><div class="value" style="font-size:14pt">${esc(r.organization.consolidated ? t("result.consolidatedYes") : t("result.consolidatedNo"))}</div></div><div class="card"><div class="label">${esc(t("result.gap"))}</div><div class="value">${esc(num(r.organization.gapToTarget))}</div><div>${esc(t("result.target", { level: c.assessment.targetLevel }))}</div></div></div>${aspectChart(levelAspects, c.assessment.targetLevel, t)}<h2>${esc(t("executive.findings"))}</h2><ul><li>${esc(t("executive.priority", { code: r.organization.priorityAspect, name: c.method.aspects.find((a) => a.code === r.organization.priorityAspect)?.name ?? "" }))}</li>${
    divergent.length ? `<li>${esc(t("executive.divergence", { count: divergent.length, codes: divergent.map((x) => x.code).join(", ") }))}</li>` : ""
  }${attention.length ? `<li>${esc(t("executive.perceptionGap", { codes: attention.map((g) => g.code).join(", ") }))}</li>` : ""}${
    r.sclTrack ? `<li>${esc(t("scl.level", { level: levelName(r.sclTrack.indicativeLevel, t) }))}</li>` : ""
  }<li>${esc(t("executive.participation", { completed: c.participation.totals.completed === null ? t("hidden") : num(c.participation.totals.completed, 0), rate: pct(c.participation.totals.rate) }))}</li></ul><h2>${esc(t("executive.priorities"))}</h2>${
    top.length
      ? table(
          [t("columns.rank"), t("columns.characteristic"), t("columns.final"), t("columns.gap"), t("columns.rootCause")],
          top.map((g) => [esc(g.rank), `<strong>${esc(g.code)}</strong> ${esc(g.name)}`, esc(num(g.currentIndex)), esc(num(g.gap)), esc(g.rootCause ?? "")]),
          { numeric: [0, 2, 3] },
        )
      : `<p>${esc(t("gaps.none"))}</p>`
  }${standing(t, statement)}${signature(sig, t)}`;
}

function statementDocument(c: ReportContent, sig: ReportSignature, assets: ReportAssets, t: Translate, statement: string): string {
  const r = c.result;
  return `${headerBlock(c, t("statement.title"), sig, assets, t)}<p>${esc(t("statement.opening", { organization: c.organization.legalName, assessment: c.assessment.name, scope: t(`scopes.${c.assessment.scopeType}`), start: dateOnly(c.assessment.periodStart), end: dateOnly(c.assessment.periodEnd) }))}</p>${table(
    [t("columns.item"), t("columns.value")],
    [
      [t("result.index"), `<strong data-testid="report-index">${esc(num(r.organization.index))}</strong>`],
      [t("result.level"), esc(levelName(r.organization.indicativeLevel, t))],
      [t("result.consolidated"), esc(r.organization.consolidated ? t("result.consolidatedYes") : t("result.consolidatedNo"))],
      [t("scope.target"), esc(levelName(c.assessment.targetLevel, t))],
      [t("result.gap"), esc(num(r.organization.gapToTarget))],
      [t("result.priority"), esc(`${r.organization.priorityAspect} ${c.method.aspects.find((a) => a.code === r.organization.priorityAspect)?.name ?? ""}`)],
      ...(r.sclTrack ? [[t("scl.title"), esc(levelName(r.sclTrack.indicativeLevel, t))]] : []),
      [t("method.instrument"), esc(c.assessment.instrumentVersion)],
    ],
    { className: "kv" },
  )}<p>${esc(t("statement.basis"))}</p>${standing(t, statement)}${signature(sig, t)}`;
}

/** Dokumen HTML lengkap untuk satu jenis laporan. */
export function renderReportHtml(content: ReportContent, kind: ReportKind, sig: ReportSignature, assets: ReportAssets, locale: "id" | "en" = "id"): string {
  const messages = locale === "id" ? id : en;
  const t = createTranslator({ locale, messages, namespace: "reportDoc" }) as unknown as Translate;
  const statement = createTranslator({ locale, messages, namespace: "common" })("resultDisclaimer");
  const title = t(kind === "FULL" ? "full.title" : kind === "EXECUTIVE_SUMMARY" ? "executive.title" : "statement.title");
  const body = kind === "FULL" ? fullReport(content, sig, assets, t, statement) : kind === "EXECUTIVE_SUMMARY" ? executiveSummary(content, sig, assets, t, statement) : statementDocument(content, sig, assets, t, statement);
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(`${title} ${content.organization.name} v${content.version}`)}</title><style>${styles(assets)}</style></head><body data-kind="${kind}" data-status="${sig.status}">${sig.status === "DRAFT" ? `<div class="watermark" aria-hidden="true">${esc(t("draftWatermark"))}</div>` : ""}<main class="page">${body}</main></body></html>`;
}

export const REPORT_FILE_NAMES: Record<ReportKind, string> = { FULL: "laporan-asesmen", EXECUTIVE_SUMMARY: "ringkasan-eksekutif", STATEMENT: "pernyataan-hasil" };
