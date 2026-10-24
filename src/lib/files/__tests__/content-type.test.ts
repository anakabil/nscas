import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { detectFileType } from "../content-type";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (s: string) => new TextEncoder().encode(s);

describe("jenis berkas dari isi", () => {
  it("mengenali PDF, JPEG, PNG, WebP, HEIC, WebM, dan MP4", () => {
    expect(detectFileType(text("%PDF-1.7\n..."))?.mime).toBe("application/pdf");
    expect(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))?.mime).toBe("image/jpeg");
    expect(detectFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))?.mime).toBe("image/png");
    expect(detectFileType(text("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))?.mime).toBe("image/webp");
    expect(detectFileType(text("\u0000\u0000\u0000\u0018ftypheic\u0000\u0000"))?.mime).toBe("image/heic");
    expect(detectFileType(bytes(0x1a, 0x45, 0xdf, 0xa3, 0x9f))?.kind).toBe("video");
    expect(detectFileType(text("\u0000\u0000\u0000 ftypisom\u0000\u0000"))?.mime).toBe("video/mp4");
    expect(detectFileType(text("\u0000\u0000\u0000\u0014ftypqt  "))?.mime).toBe("video/quicktime");
  });

  it("membedakan Excel dan Word berbasis ZIP, menolak ZIP lain", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("A").addRow(["x"]);
    const xlsx = new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    expect(detectFileType(xlsx.subarray(0, 64 * 1024))?.ext).toBe("xlsx");
    const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...text("....[Content_Types].xml....word/document.xml")]);
    expect(detectFileType(docx)?.ext).toBe("docx");
    expect(detectFileType(new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...text("ppt/slides/slide1.xml")]))).toBeNull();
  });

  it("dokumen Office lama memakai ekstensi yang dinyatakan", () => {
    const ole = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0);
    expect(detectFileType(ole, "Laporan.XLS")?.mime).toBe("application/vnd.ms-excel");
    expect(detectFileType(ole, "notulen.doc")?.mime).toBe("application/msword");
    expect(detectFileType(ole, "presentasi.ppt")).toBeNull();
  });

  it("mengabaikan nama berkas untuk isi yang tidak dikenal", () => {
    expect(detectFileType(text("MZ\u0090\u0000 program"), "laporan.pdf")).toBeNull();
    expect(detectFileType(text("<html><script>"), "bukti.jpg")).toBeNull();
    expect(detectFileType(bytes(1, 2))).toBeNull();
  });
});
