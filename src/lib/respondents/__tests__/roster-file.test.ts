import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  mapHeader,
  MAX_ROSTER_ROWS,
  normalizePhone,
  parseContractor,
  readRosterFile,
  validateRoster,
  type RosterLookups,
} from "../roster-file";
import { buildRosterTemplate } from "../template";

const encoder = new TextEncoder();

function lookups(overrides: Partial<RosterLookups> = {}): RosterLookups {
  return {
    units: new Map([
      ["kantor pusat", { id: "u-hq" }],
      ["proyek tol cisumdawu", { id: "u-p1" }],
    ]),
    strata: new Map([
      ["m", { id: "s-m", isContractor: false }],
      ["manajemen", { id: "s-m", isContractor: false }],
      ["pj", { id: "s-pj", isContractor: true }],
    ]),
    unitScope: null,
    existingEmployeeNos: new Set(),
    existingEmails: new Set(),
    ...overrides,
  };
}

const HEADER = ["Nama", "Nomor induk", "Surel", "Telepon", "Unit", "Strata", "Penyedia jasa"];

describe("pembacaan berkas daftar responden", () => {
  it("membaca CSV berpemisah titik koma dengan BOM", async () => {
    const csv = "﻿Nama;Unit;Strata\nBudi Santoso;Kantor Pusat;M\n";
    const result = await readRosterFile(encoder.encode(csv));
    expect(result).toEqual({ rows: [["Nama", "Unit", "Strata"], ["Budi Santoso", "Kantor Pusat", "M"]] });
  });

  it("membaca CSV berpemisah koma dengan nilai berkutip", async () => {
    const csv = 'Nama,Unit,Strata\n"Santoso, Budi",Kantor Pusat,M\n';
    const result = await readRosterFile(encoder.encode(csv));
    expect("rows" in result && result.rows[1]).toEqual(["Santoso, Budi", "Kantor Pusat", "M"]);
  });

  it("membaca .xlsx, termasuk nomor telepon dan nomor induk berawalan nol", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Daftar responden");
    ws.addRow(HEADER);
    ws.addRow(["Siti Aminah", "00123", "siti@contoh.co.id", "081234567890", "Kantor Pusat", "M", "Tidak"]);
    ws.addRow(["Agus", 4567, null, null, "Kantor Pusat", "PJ", "Ya"]);
    const bytes = new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    const result = await readRosterFile(bytes);
    expect("rows" in result).toBe(true);
    if (!("rows" in result)) return;
    expect(result.rows[0]).toEqual(HEADER);
    expect(result.rows[1]).toEqual(["Siti Aminah", "00123", "siti@contoh.co.id", "081234567890", "Kantor Pusat", "M", "Tidak"]);
    expect(result.rows[2]?.[1]).toBe("4567");
  });

  it("menolak berkas kosong, terlalu besar, dan .xls lama", async () => {
    expect(await readRosterFile(new Uint8Array())).toEqual({ error: "FILE_EMPTY" });
    expect(await readRosterFile(new Uint8Array(10 * 1024 * 1024 + 1))).toEqual({ error: "FILE_TOO_LARGE" });
    expect(await readRosterFile(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1]))).toEqual({ error: "FILE_TYPE" });
  });

  it("menolak arsip zip yang bukan lembar kerja", async () => {
    expect(await readRosterFile(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]))).toEqual({ error: "FILE_UNREADABLE" });
  });

  it("templat yang diunduh dapat dibaca kembali oleh pengimpor", async () => {
    const bytes = await buildRosterTemplate({
      units: ["Kantor Pusat", "Proyek Tol Cisumdawu"],
      strata: [{ code: "M", name: "Manajemen" }],
      instructions: { title: "Petunjuk", lines: ["Baris satu"] },
      optionsSheetName: "Pilihan",
      instructionsSheetName: "Petunjuk",
    });
    const result = await readRosterFile(bytes);
    expect("rows" in result && result.rows[0]).toEqual(HEADER);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Daftar responden", "Pilihan", "Petunjuk"]);
    expect(wb.getWorksheet("Daftar responden")?.getCell("E2").dataValidation?.type).toBe("list");
  });
});

describe("judul kolom", () => {
  it("mengenali nama lain dan tanda wajib", () => {
    const { columns, missing } = mapHeader(["Nama Lengkap*", "NIK", "Email", "No HP", "Unit (wajib)", "Kode strata", "Contractor"]);
    expect(missing).toEqual([]);
    expect(columns).toEqual({ name: 0, employeeNo: 1, email: 2, phone: 3, unit: 4, stratum: 5, contractor: 6 });
  });

  it("melaporkan kolom wajib yang tidak ada", () => {
    expect(mapHeader(["Nama", "Surel"]).missing).toEqual(["unit", "stratum"]);
  });
});

describe("normalisasi isian", () => {
  it.each([
    ["0812-3456-7890", "+6281234567890"],
    ["62 812 3456 7890", "+6281234567890"],
    ["+62 (812) 3456.7890", "+6281234567890"],
    ["812345678", "+812345678"],
  ])("telepon %s menjadi %s", (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it("menolak telepon yang bukan angka atau terlalu pendek", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("08xx")).toBeNull();
  });

  it("membaca status penyedia jasa", () => {
    expect(parseContractor("Ya")).toBe(true);
    expect(parseContractor("TIDAK")).toBe(false);
    expect(parseContractor("")).toBeNull();
    expect(parseContractor("mungkin")).toBe("INVALID");
  });
});

describe("validasi baris", () => {
  it("menerima baris sah dan memetakan unit serta strata tanpa membedakan huruf besar", () => {
    const result = validateRoster(
      [HEADER, ["Siti Aminah", "A-1", "SITI@Contoh.co.id", "081234567890", "kantor PUSAT", "manajemen", ""]],
      lookups(),
    );
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual([
      {
        rowNumber: 2,
        fullName: "Siti Aminah",
        employeeNo: "A-1",
        email: "siti@contoh.co.id",
        phone: "+6281234567890",
        unitId: "u-hq",
        stratumId: "s-m",
        isContractor: false,
      },
    ]);
  });

  it("status penyedia jasa kosong mengikuti strata", () => {
    const result = validateRoster([HEADER, ["Agus", "", "", "", "Kantor Pusat", "PJ", ""]], lookups());
    expect(result.valid[0]?.isContractor).toBe(true);
  });

  it("melaporkan galat per baris dengan nomor baris berkas", () => {
    const rows = [
      HEADER,
      ["", "", "", "", "", "", ""], // baris kosong dilewati
      ["", "", "bukan-surel", "123", "Gudang", "X", "kadang"],
      ["Budi", "B-1", "", "", "", "", ""],
    ];
    const result = validateRoster(rows, lookups());
    expect(result.totalRows).toBe(2);
    expect(result.valid).toEqual([]);
    expect(result.errors.map((e) => `${e.rowNumber}:${e.column}:${e.code}`)).toEqual([
      "3:name:NAME_REQUIRED",
      "3:unit:UNIT_NOT_FOUND",
      "3:stratum:STRATUM_NOT_FOUND",
      "3:email:EMAIL_INVALID",
      "3:phone:PHONE_INVALID",
      "3:contractor:CONTRACTOR_INVALID",
      "4:unit:UNIT_REQUIRED",
      "4:stratum:STRATUM_REQUIRED",
    ]);
  });

  it("menolak duplikat di berkas dan data yang sudah terdaftar", () => {
    const rows = [
      HEADER,
      ["A", "N-1", "a@contoh.co.id", "", "Kantor Pusat", "M", ""],
      ["B", "n-1", "A@contoh.co.id", "", "Kantor Pusat", "M", ""],
      ["C", "N-9", "lama@contoh.co.id", "", "Kantor Pusat", "M", ""],
    ];
    const result = validateRoster(rows, lookups({ existingEmployeeNos: new Set(["n-9"]), existingEmails: new Set(["lama@contoh.co.id"]) }));
    expect(result.valid.map((r) => r.fullName)).toEqual(["A"]);
    expect(result.errors.map((e) => `${e.rowNumber}:${e.column}:${e.code}`)).toEqual([
      "3:employeeNo:DUPLICATE_IN_FILE",
      "3:email:DUPLICATE_IN_FILE",
      "4:employeeNo:ALREADY_REGISTERED",
      "4:email:ALREADY_REGISTERED",
    ]);
  });

  it("koordinator unit hanya dapat mengimpor unitnya", () => {
    const result = validateRoster([HEADER, ["A", "", "", "", "Proyek Tol Cisumdawu", "M", ""]], lookups({ unitScope: new Set(["u-hq"]) }));
    expect(result.errors).toEqual([{ rowNumber: 2, column: "unit", code: "UNIT_OUT_OF_SCOPE" }]);
  });

  it("menolak isian terlalu panjang", () => {
    const result = validateRoster([HEADER, ["x".repeat(201), "y".repeat(65), "", "", "Kantor Pusat", "M", ""]], lookups());
    expect(result.errors.map((e) => e.code)).toEqual(["TEXT_TOO_LONG", "TEXT_TOO_LONG"]);
  });

  it("menghentikan validasi bila kolom wajib tidak ada atau baris melebihi batas", () => {
    expect(validateRoster([["Nama"], ["A"]], lookups()).missingColumns).toEqual(["unit", "stratum"]);
    const many = [HEADER, ...Array.from({ length: MAX_ROSTER_ROWS + 1 }, (_, i) => [`R${i}`, "", "", "", "Kantor Pusat", "M", ""])];
    const result = validateRoster(many, lookups());
    expect(result.tooManyRows).toBe(true);
    expect(result.valid).toEqual([]);
  });
});
