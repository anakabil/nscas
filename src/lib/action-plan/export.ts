// Ekspor daftar kesenjangan dan rencana aksi ke Excel (docs/01 M10). Surel penanggung jawab tidak diekspor.

import ExcelJS from "exceljs";
import type { ActionPlanModel } from "./service";

export interface PlanExportLabels {
  sheets: { gaps: string; actions: string; updates: string };
  columns: Record<string, string>;
  statuses: Record<string, string>;
  priorities: Record<string, string>;
  due: Record<string, string>;
  noUnit: string;
}

function header(sheet: ExcelJS.Worksheet, columns: { key: string; header: string; width: number }[]) {
  sheet.columns = columns;
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000B9D" } };
  row.alignment = { vertical: "middle", wrapText: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

const day = (d: Date) => d.toISOString().slice(0, 10);

export async function buildActionPlanWorkbook(plan: ActionPlanModel, labels: PlanExportLabels, aspectWeights: Record<string, number>): Promise<Uint8Array> {
  const c = labels.columns as Record<string, string>;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NSCAS Nusa Safety";

  const gaps = workbook.addWorksheet(labels.sheets.gaps);
  header(gaps, [
    { key: "rank", header: c.rank as string, width: 10 },
    { key: "code", header: c.code as string, width: 10 },
    { key: "characteristic", header: c.characteristic as string, width: 44 },
    { key: "aspect", header: c.aspect as string, width: 32 },
    { key: "current", header: c.current as string, width: 12 },
    { key: "target", header: c.target as string, width: 12 },
    { key: "gap", header: c.gap as string, width: 12 },
    { key: "weight", header: c.weight as string, width: 12 },
    { key: "score", header: c.score as string, width: 14 },
    { key: "priority", header: c.priority as string, width: 12 },
    { key: "rootCause", header: c.rootCause as string, width: 60 },
    { key: "actions", header: c.actions as string, width: 12 },
  ]);
  for (const g of plan.gaps) {
    gaps.addRow({
      rank: g.rank,
      code: g.characteristic.code,
      characteristic: g.characteristic.nameId,
      aspect: `${g.characteristic.aspect.code} ${g.characteristic.aspect.name}`,
      current: g.currentIndex,
      target: g.targetLevel,
      gap: g.gap,
      weight: g.isContextual ? 0 : (aspectWeights[g.characteristic.aspect.code] ?? 0),
      score: g.priorityScore,
      priority: g.priority ? labels.priorities[g.priority] : "",
      rootCause: g.rootCause ?? "",
      actions: g.actions.length,
    });
  }
  for (const key of ["current", "gap"]) gaps.getColumn(key).numFmt = "0.00";
  for (const key of ["weight", "score"]) gaps.getColumn(key).numFmt = "0.000";
  gaps.getColumn("rootCause").alignment = { wrapText: true, vertical: "top" };

  const actions = workbook.addWorksheet(labels.sheets.actions);
  header(actions, [
    { key: "code", header: c.code as string, width: 10 },
    { key: "action", header: c.action as string, width: 40 },
    { key: "description", header: c.description as string, width: 40 },
    { key: "owner", header: c.owner as string, width: 24 },
    { key: "position", header: c.position as string, width: 24 },
    { key: "unit", header: c.unit as string, width: 24 },
    { key: "dueDate", header: c.dueDate as string, width: 14 },
    { key: "indicator", header: c.indicator as string, width: 40 },
    { key: "status", header: c.status as string, width: 22 },
    { key: "progress", header: c.progress as string, width: 14 },
    { key: "dueState", header: c.dueState as string, width: 20 },
    { key: "verifiedBy", header: c.verifiedBy as string, width: 22 },
    { key: "verifiedAt", header: c.verifiedAt as string, width: 16 },
  ]);
  const updates = workbook.addWorksheet(labels.sheets.updates);
  header(updates, [
    { key: "code", header: c.code as string, width: 10 },
    { key: "action", header: c.action as string, width: 40 },
    { key: "date", header: c.date as string, width: 14 },
    { key: "by", header: c.by as string, width: 24 },
    { key: "progress", header: c.progress as string, width: 14 },
    { key: "status", header: c.status as string, width: 22 },
    { key: "note", header: c.note as string, width: 60 },
  ]);
  for (const g of plan.gaps) {
    for (const a of g.actions) {
      actions.addRow({
        code: g.characteristic.code,
        action: a.title,
        description: a.description ?? "",
        owner: a.ownerName,
        position: a.ownerPosition,
        unit: a.unit?.name ?? labels.noUnit,
        dueDate: day(a.dueDate),
        indicator: a.successIndicator,
        status: labels.statuses[a.status],
        progress: a.progress,
        dueState: labels.due[a.dueState] ?? "",
        verifiedBy: a.verifiedBy?.name ?? "",
        verifiedAt: a.verifiedAt ? day(a.verifiedAt) : "",
      });
      for (const u of [...a.updates].reverse()) {
        updates.addRow({ code: g.characteristic.code, action: a.title, date: day(u.createdAt), by: u.createdBy.name, progress: u.progressPercent, status: u.status ? labels.statuses[u.status] : "", note: u.note });
      }
    }
  }
  updates.getColumn("note").alignment = { wrapText: true, vertical: "top" };
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
