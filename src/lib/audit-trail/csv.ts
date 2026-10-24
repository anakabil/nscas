// Penulisan CSV untuk ekspor jejak audit. Murni, tanpa I/O.
// Pemisah titik koma dan tanda urutan bita UTF-8 agar berkas terbuka benar di Excel berlokal Indonesia
// (koma dipakai sebagai pemisah desimal).

export const CSV_DELIMITER = ";";

/**
 * Menetralkan injeksi rumus spreadsheet (CWE-1236): sel yang diawali =, +, -, @, tab, atau carriage return
 * diberi awalan tanda kutip tunggal sehingga dibaca sebagai teks, bukan rumus.
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = neutralizeFormula(String(value));
  return /[";\r\n,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  return "﻿" + rows.map((row) => row.map(csvCell).join(CSV_DELIMITER)).join("\r\n") + "\r\n";
}
