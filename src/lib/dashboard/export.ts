// Ekspor dasbor ke Excel. Dibangun dari model dasbor yang sama dengan halaman, sehingga sel di bawah 5 responden
// sudah disembunyikan sebelum ditulis (CLAUDE.md aturan 3). Peta warna ditulis dalam format panjang: satu baris
// per sel, dengan jumlah responden dan keterangan sel yang disembunyikan.

import ExcelJS from "exceljs";
import type { SafeCell } from "@/lib/privacy/suppression";
import type { Heatmap } from "./analytics";
import type { DashboardModel } from "./service";

export interface ExportLabels {
  sheets: { summary: string; aspects: string; characteristics: string; strata: string; units: string; gap: string; divergence: string };
  note: string;
  draft: string;
  final: string;
  hidden: string;
  secondary: string;
  empty: string;
  columns: Record<string, string>;
  summary: Record<string, string>;
}

type Available = Extract<DashboardModel, { available: true }>;

function header(sheet: ExcelJS.Worksheet, columns: { key: string; header: string; width: number }[]) {
  sheet.columns = columns;
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000B9D" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function cellNote(cell: SafeCell, labels: ExportLabels): string {
  if (cell.state === "suppressed") return labels.hidden;
  if (cell.state === "secondary") return labels.secondary;
  if (cell.state === "empty") return labels.empty;
  return "";
}

function heatmapSheet(workbook: ExcelJS.Workbook, name: string, heatmap: Heatmap, columnLabel: string, labels: ExportLabels) {
  const sheet = workbook.addWorksheet(name);
  header(sheet, [
    { key: "aspect", header: labels.columns.aspect as string, width: 36 },
    { key: "group", header: columnLabel, width: 40 },
    { key: "value", header: labels.columns.value as string, width: 12 },
    { key: "n", header: labels.columns.n as string, width: 18 },
    { key: "note", header: labels.columns.note as string, width: 48 },
  ]);
  for (const row of heatmap.rows) {
    row.cells.forEach((cell, i) => {
      sheet.addRow({ aspect: `${row.aspectCode} ${row.aspectName}`, group: heatmap.columns[i]?.label ?? "", value: cell.value, n: cell.n, note: cellNote(cell, labels) });
    });
  }
  sheet.getColumn("value").numFmt = "0.00";
}

export async function buildDashboardWorkbook(model: Available, labels: ExportLabels, meta: { assessmentName: string; organizationName: string }): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NSCAS Nusa Safety";

  const summary = workbook.addWorksheet(labels.sheets.summary);
  header(summary, [
    { key: "label", header: labels.columns.item as string, width: 40 },
    { key: "value", header: labels.columns.value as string, width: 40 },
  ]);
  const s = model.summary;
  for (const [label, value] of [
    [labels.summary.organization, meta.organizationName],
    [labels.summary.assessment, meta.assessmentName],
    [labels.summary.state, model.run.isFinal ? labels.final : labels.draft],
    [labels.summary.index, s.index],
    [labels.summary.level, s.level],
    [labels.summary.consolidated, s.consolidated ? labels.summary.yes : labels.summary.no],
    [labels.summary.target, model.targetLevel],
    [labels.summary.gap, s.gapToTarget],
    [labels.summary.priority, `${s.priorityAspect} ${s.priorityAspectName}`],
    [labels.summary.contextual, s.contextualIndex],
    [labels.summary.note, labels.note],
  ] as [string, string | number | null][]) {
    const row = summary.addRow({ label, value });
    if (typeof value === "number" && !Number.isInteger(value)) row.getCell("value").numFmt = "0.00";
  }

  const aspects = workbook.addWorksheet(labels.sheets.aspects);
  header(aspects, [
    { key: "code", header: labels.columns.code as string, width: 10 },
    { key: "name", header: labels.columns.aspect as string, width: 40 },
    { key: "index", header: labels.columns.value as string, width: 12 },
    { key: "gap", header: labels.columns.gap as string, width: 24 },
  ]);
  for (const a of model.aspects) aspects.addRow({ code: a.code, name: a.name, index: a.index, gap: a.gapToTarget });
  for (const key of ["index", "gap"]) aspects.getColumn(key).numFmt = "0.00";

  const characteristics = workbook.addWorksheet(labels.sheets.characteristics);
  header(characteristics, [
    { key: "code", header: labels.columns.code as string, width: 10 },
    { key: "name", header: labels.columns.characteristic as string, width: 52 },
    { key: "aspect", header: labels.columns.aspect as string, width: 10 },
    { key: "value", header: labels.columns.value as string, width: 12 },
    { key: "adjusted", header: labels.columns.adjusted as string, width: 22 },
  ]);
  for (const c of model.characteristics) characteristics.addRow({ code: c.code, name: c.name, aspect: c.aspectCode, value: c.value, adjusted: c.adjusted ? labels.summary.yes : "" });
  characteristics.getColumn("value").numFmt = "0.00";

  if (model.heatmaps?.strata) heatmapSheet(workbook, labels.sheets.strata, model.heatmaps.strata, labels.columns.stratum as string, labels);
  if (model.heatmaps?.units) heatmapSheet(workbook, labels.sheets.units, model.heatmaps.units, labels.columns.unit as string, labels);

  if (model.perceptionGap) {
    const gap = workbook.addWorksheet(labels.sheets.gap);
    header(gap, [
      { key: "aspect", header: labels.columns.aspect as string, width: 40 },
      { key: "management", header: labels.columns.management as string, width: 16 },
      { key: "field", header: labels.columns.field as string, width: 16 },
      { key: "gap", header: labels.columns.difference as string, width: 14 },
      { key: "note", header: labels.columns.note as string, width: 48 },
    ]);
    for (const g of model.perceptionGap) gap.addRow({ aspect: `${g.code} ${g.name}`, management: g.management, field: g.field, gap: g.gap, note: g.suppressed ? labels.hidden : "" });
    for (const key of ["management", "field", "gap"]) gap.getColumn(key).numFmt = "0.00";
  }

  if (model.divergence) {
    const divergence = workbook.addWorksheet(labels.sheets.divergence);
    header(divergence, [
      { key: "code", header: labels.columns.code as string, width: 10 },
      { key: "name", header: labels.columns.characteristic as string, width: 52 },
      { key: "perception", header: labels.columns.perception as string, width: 14 },
      { key: "evidence", header: labels.columns.evidence as string, width: 14 },
      { key: "final", header: labels.columns.value as string, width: 12 },
      { key: "note", header: labels.columns.note as string, width: 48 },
    ]);
    for (const d of model.divergence) divergence.addRow({ code: d.code, name: d.name, perception: d.perception, evidence: d.evidence, final: d.final, note: d.perceptionHidden ? labels.hidden : "" });
    for (const key of ["perception", "evidence", "final"]) divergence.getColumn(key).numFmt = "0.00";
  }

  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
