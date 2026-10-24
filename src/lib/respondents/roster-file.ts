// Pembacaan dan validasi berkas daftar responden (docs/01 M2). Murni kecuali pembacaan Excel/CSV,
// sehingga validasi per baris dapat diuji tanpa basis data.

import ExcelJS from "exceljs";
import Papa from "papaparse";

export const ROSTER_COLUMNS = ["name", "employeeNo", "email", "phone", "unit", "stratum", "contractor"] as const;
export type RosterColumn = (typeof ROSTER_COLUMNS)[number];
export const REQUIRED_COLUMNS: readonly RosterColumn[] = ["name", "unit", "stratum"];
export const MAX_ROSTER_ROWS = 20_000;
export const MAX_ROSTER_FILE_BYTES = 10 * 1024 * 1024;

/** Judul kolom templat (bahasa Indonesia) dan nama lain yang juga dikenali. */
export const TEMPLATE_HEADERS: Record<RosterColumn, string> = {
  name: "Nama",
  employeeNo: "Nomor induk",
  email: "Surel",
  phone: "Telepon",
  unit: "Unit",
  stratum: "Strata",
  contractor: "Penyedia jasa",
};

const HEADER_ALIASES: Record<RosterColumn, string[]> = {
  name: ["nama", "nama lengkap", "name", "full name"],
  employeeNo: ["nomor induk", "nomor induk pegawai", "nomor pegawai", "nip", "nik", "employee number", "employee no", "employee id"],
  email: ["surel", "alamat surel", "email", "e-mail", "e mail"],
  phone: ["telepon", "nomor telepon", "nomor ponsel", "phone", "phone number", "no hp", "hp"],
  unit: ["unit", "nama unit", "unit name"],
  stratum: ["strata", "kode strata", "stratum", "stratum code"],
  contractor: ["penyedia jasa", "status penyedia jasa", "pekerja penyedia jasa", "contractor"],
};

export function normalizeKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\(.*?\)|\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type FileReadError = "FILE_TYPE" | "FILE_EMPTY" | "FILE_UNREADABLE" | "FILE_TOO_LARGE";

function isXlsx(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isLegacyXls(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
}

/** Membaca baris dari .xlsx (lembar "Daftar responden" bila ada) atau CSV UTF-8 berpemisah koma atau titik koma. */
/** Baris kosong di tengah dipertahankan agar nomor baris sama dengan berkas; baris kosong di akhir dibuang. */
function trimTrailingEmpty(rows: string[][]): string[][] {
  let end = rows.length;
  while (end > 0 && (rows[end - 1] ?? []).every((v) => v === "")) end--;
  return rows.slice(0, end);
}

export async function readRosterFile(bytes: Uint8Array): Promise<{ rows: string[][] } | { error: FileReadError }> {
  if (bytes.length === 0) return { error: "FILE_EMPTY" };
  if (bytes.length > MAX_ROSTER_FILE_BYTES) return { error: "FILE_TOO_LARGE" };
  if (isLegacyXls(bytes)) return { error: "FILE_TYPE" };

  if (isXlsx(bytes)) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
      const sheet = workbook.getWorksheet(TEMPLATE_SHEET_NAME) ?? workbook.worksheets[0];
      if (!sheet) return { error: "FILE_EMPTY" };
      const rows: string[][] = [];
      sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const values: string[] = [];
        for (let c = 1; c <= Math.max(row.cellCount, ROSTER_COLUMNS.length); c++) values.push(row.getCell(c).text?.trim() ?? "");
        rows[rowNumber - 1] = values;
      });
      const result = trimTrailingEmpty(Array.from(rows, (r) => r ?? []));
      return result.length === 0 ? { error: "FILE_EMPTY" } : { rows: result };
    } catch {
      return { error: "FILE_UNREADABLE" };
    }
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/^﻿/, "");
  if (text.includes("\u0000")) return { error: "FILE_TYPE" };
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false, delimitersToGuess: [";", ",", "\t"] });
  const rows = trimTrailingEmpty(parsed.data.map((r) => r.map((v) => (v ?? "").trim())));
  return rows.length === 0 ? { error: "FILE_EMPTY" } : { rows };
}

export const TEMPLATE_SHEET_NAME = "Daftar responden";

export function mapHeader(header: readonly string[]): { columns: Partial<Record<RosterColumn, number>>; missing: RosterColumn[] } {
  const columns: Partial<Record<RosterColumn, number>> = {};
  header.forEach((cell, index) => {
    const key = normalizeKey(cell);
    for (const column of ROSTER_COLUMNS) {
      if (columns[column] === undefined && HEADER_ALIASES[column].includes(key)) columns[column] = index;
    }
  });
  return { columns, missing: REQUIRED_COLUMNS.filter((c) => columns[c] === undefined) };
}

export type RowErrorCode =
  | "NAME_REQUIRED"
  | "UNIT_REQUIRED"
  | "UNIT_NOT_FOUND"
  | "UNIT_OUT_OF_SCOPE"
  | "STRATUM_REQUIRED"
  | "STRATUM_NOT_FOUND"
  | "EMAIL_INVALID"
  | "PHONE_INVALID"
  | "CONTRACTOR_INVALID"
  | "DUPLICATE_IN_FILE"
  | "ALREADY_REGISTERED"
  | "TEXT_TOO_LONG";

export interface RosterRowError {
  /** Nomor baris di berkas (baris judul = 1). */
  rowNumber: number;
  column: RosterColumn | null;
  code: RowErrorCode;
}

export interface ValidRosterRow {
  rowNumber: number;
  fullName: string;
  employeeNo: string | null;
  email: string | null;
  phone: string | null;
  unitId: string;
  stratumId: string;
  isContractor: boolean;
}

export interface RosterLookups {
  /** Kunci: normalizeKey(nama unit). */
  units: Map<string, { id: string }>;
  /** Kunci: normalizeKey(kode) dan normalizeKey(nama) strata. */
  strata: Map<string, { id: string; isContractor: boolean }>;
  /** null untuk semua unit; selain itu id unit yang boleh diimpor (koordinator unit). */
  unitScope: ReadonlySet<string> | null;
  existingEmployeeNos: ReadonlySet<string>;
  existingEmails: ReadonlySet<string>;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Nomor telepon dinormalkan ke format internasional Indonesia (+62...). Null bila tidak sah. */
export function normalizePhone(raw: string): string | null {
  const compact = raw.replace(/[\s().-]/g, "");
  if (!/^\+?\d{8,15}$/.test(compact)) return null;
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("62")) return `+${compact}`;
  if (compact.startsWith("0")) return `+62${compact.slice(1)}`;
  return `+${compact}`;
}

export function parseContractor(raw: string): boolean | null | "INVALID" {
  const v = normalizeKey(raw);
  if (v === "") return null;
  if (["ya", "y", "yes", "true", "1", "penyedia jasa"].includes(v)) return true;
  if (["tidak", "t", "no", "n", "false", "0", "bukan"].includes(v)) return false;
  return "INVALID";
}

export interface RosterValidation {
  missingColumns: RosterColumn[];
  totalRows: number;
  valid: ValidRosterRow[];
  errors: RosterRowError[];
  tooManyRows: boolean;
}

export function validateRoster(rows: readonly (readonly string[])[], lookups: RosterLookups): RosterValidation {
  const [header = [], ...body] = rows;
  const { columns, missing } = mapHeader(header);
  if (missing.length > 0) return { missingColumns: missing, totalRows: 0, valid: [], errors: [], tooManyRows: false };

  const dataRows = body.map((r, i) => ({ cells: r, rowNumber: i + 2 })).filter(({ cells }) => cells.some((c) => c.trim() !== ""));
  if (dataRows.length > MAX_ROSTER_ROWS) return { missingColumns: [], totalRows: dataRows.length, valid: [], errors: [], tooManyRows: true };

  const cell = (cells: readonly string[], column: RosterColumn) => {
    const index = columns[column];
    return index === undefined ? "" : (cells[index] ?? "").trim();
  };

  const valid: ValidRosterRow[] = [];
  const errors: RosterRowError[] = [];
  const seenEmployeeNos = new Set<string>();
  const seenEmails = new Set<string>();

  for (const { cells, rowNumber } of dataRows) {
    const rowErrors: RosterRowError[] = [];
    const add = (column: RosterColumn | null, code: RowErrorCode) => rowErrors.push({ rowNumber, column, code });

    const fullName = cell(cells, "name");
    if (!fullName) add("name", "NAME_REQUIRED");
    else if (fullName.length > 200) add("name", "TEXT_TOO_LONG");

    const unitName = cell(cells, "unit");
    const unit = unitName ? lookups.units.get(normalizeKey(unitName)) : undefined;
    if (!unitName) add("unit", "UNIT_REQUIRED");
    else if (!unit) add("unit", "UNIT_NOT_FOUND");
    else if (lookups.unitScope && !lookups.unitScope.has(unit.id)) add("unit", "UNIT_OUT_OF_SCOPE");

    const stratumKey = cell(cells, "stratum");
    const stratum = stratumKey ? lookups.strata.get(normalizeKey(stratumKey)) : undefined;
    if (!stratumKey) add("stratum", "STRATUM_REQUIRED");
    else if (!stratum) add("stratum", "STRATUM_NOT_FOUND");

    const employeeNo = cell(cells, "employeeNo") || null;
    if (employeeNo && employeeNo.length > 64) add("employeeNo", "TEXT_TOO_LONG");
    const employeeKey = employeeNo?.toLowerCase();
    if (employeeKey) {
      if (seenEmployeeNos.has(employeeKey)) add("employeeNo", "DUPLICATE_IN_FILE");
      else if (lookups.existingEmployeeNos.has(employeeKey)) add("employeeNo", "ALREADY_REGISTERED");
      seenEmployeeNos.add(employeeKey);
    }

    const emailRaw = cell(cells, "email");
    const email = emailRaw ? emailRaw.toLowerCase() : null;
    if (email) {
      if (!EMAIL.test(email) || email.length > 254) add("email", "EMAIL_INVALID");
      else if (seenEmails.has(email)) add("email", "DUPLICATE_IN_FILE");
      else if (lookups.existingEmails.has(email)) add("email", "ALREADY_REGISTERED");
      seenEmails.add(email);
    }

    const phoneRaw = cell(cells, "phone");
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    if (phoneRaw && !phone) add("phone", "PHONE_INVALID");

    const contractor = parseContractor(cell(cells, "contractor"));
    if (contractor === "INVALID") add("contractor", "CONTRACTOR_INVALID");

    if (rowErrors.length > 0 || !unit || !stratum) {
      errors.push(...rowErrors);
      continue;
    }
    valid.push({
      rowNumber,
      fullName,
      employeeNo,
      email,
      phone,
      unitId: unit.id,
      stratumId: stratum.id,
      isContractor: contractor === null ? stratum.isContractor : (contractor as boolean),
    });
  }

  return { missingColumns: [], totalRows: dataRows.length, valid, errors, tooManyRows: false };
}
