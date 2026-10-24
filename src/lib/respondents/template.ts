// Templat Excel daftar responden. Lembar pertama berisi judul kolom yang dikenali pengimpor; lembar
// "Pilihan" memuat nama unit dan kode strata asesmen ini, dipakai sebagai daftar pilihan kolom Unit dan
// Strata; lembar "Petunjuk" menjelaskan isian.

import ExcelJS from "exceljs";
import { ROSTER_COLUMNS, TEMPLATE_HEADERS, TEMPLATE_SHEET_NAME } from "./roster-file";

export interface TemplateInput {
  units: string[];
  strata: { code: string; name: string }[];
  /** Baris petunjuk yang sudah diterjemahkan. */
  instructions: { title: string; lines: string[] };
  optionsSheetName: string;
  instructionsSheetName: string;
}

const DATA_ROWS = 5000;

export async function buildRosterTemplate(input: TemplateInput): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NSCAS Nusa Safety";

  const sheet = workbook.addWorksheet(TEMPLATE_SHEET_NAME, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = ROSTER_COLUMNS.map((c) => ({ header: TEMPLATE_HEADERS[c], key: c, width: c === "name" || c === "unit" ? 32 : 20 }));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000B9D" } };
  // Nomor induk dan telepon sebagai teks agar nol di depan tidak hilang.
  for (const key of ["employeeNo", "phone"] as const) sheet.getColumn(key).numFmt = "@";

  const options = workbook.addWorksheet(input.optionsSheetName);
  options.columns = [
    { header: TEMPLATE_HEADERS.unit, key: "unit", width: 40 },
    { header: TEMPLATE_HEADERS.stratum, key: "stratum", width: 14 },
    { header: "", key: "stratumName", width: 40 },
    { header: TEMPLATE_HEADERS.contractor, key: "contractor", width: 16 },
  ];
  options.getRow(1).font = { bold: true };
  const rows = Math.max(input.units.length, input.strata.length, 2);
  for (let i = 0; i < rows; i++) {
    options.addRow({
      unit: input.units[i] ?? null,
      stratum: input.strata[i]?.code ?? null,
      stratumName: input.strata[i]?.name ?? null,
      contractor: ["Ya", "Tidak"][i] ?? null,
    });
  }

  const ref = (col: string, count: number) => `'${input.optionsSheetName}'!$${col}$2:$${col}$${Math.max(count, 1) + 1}`;
  const unitCol = ROSTER_COLUMNS.indexOf("unit") + 1;
  const stratumCol = ROSTER_COLUMNS.indexOf("stratum") + 1;
  const contractorCol = ROSTER_COLUMNS.indexOf("contractor") + 1;
  for (let r = 2; r <= DATA_ROWS + 1; r++) {
    const row = sheet.getRow(r);
    if (input.units.length > 0) row.getCell(unitCol).dataValidation = { type: "list", allowBlank: true, formulae: [ref("A", input.units.length)] };
    if (input.strata.length > 0) row.getCell(stratumCol).dataValidation = { type: "list", allowBlank: true, formulae: [ref("B", input.strata.length)] };
    row.getCell(contractorCol).dataValidation = { type: "list", allowBlank: true, formulae: [ref("D", 2)] };
  }

  const help = workbook.addWorksheet(input.instructionsSheetName);
  help.getColumn(1).width = 110;
  help.addRow([input.instructions.title]).font = { bold: true, size: 13 };
  for (const line of input.instructions.lines) help.addRow([line]).alignment = { wrapText: true, vertical: "top" };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
