import { describe, expect, it } from "vitest";
import { renderDestructionHtml, type DestructionMinutes } from "../html";

const minutes: DestructionMinutes = {
  recordId: "rec123",
  organization: "PT Contoh Konstruksi <Tbk>",
  assessment: "Asesmen Budaya K3 2026",
  executedAt: "2029-11-05T03:15:00.000Z",
  executedBy: "Admin Nusa Safety",
  witnessName: "Rina Saksi",
  notes: "Dilaksanakan sesuai surat klien.",
  clientConfirmationRef: "001/K3/XI/2029",
  clientConfirmedOn: "2029-11-01T00:00:00.000Z",
  clientConfirmedBy: "Direktur Operasi",
  finalReportSignedAt: "2026-10-20T03:00:00.000Z",
  retentionMonths: 36,
  retentionEnd: "2029-10-20T03:00:00.000Z",
  counts: { rosterEntries: 1200, surveyResponses: 950, storageObjects: 3 },
};
const assets = { logoSrc: "data:image/png;base64,AAAA", fontSrc: null };

describe("renderDestructionHtml", () => {
  const html = renderDestructionHtml(minutes, assets);

  it("memuat dasar hukum, konfirmasi klien, dan pelaksana", () => {
    expect(html).toContain("Berita Acara Pemusnahan Data Mentah Asesmen");
    expect(html).toContain("Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi");
    expect(html).toContain("001/K3/XI/2029");
    expect(html).toContain("1 November 2029");
    expect(html).toContain("36 bulan sejak laporan final");
    expect(html).toContain("Rina Saksi");
    expect(html).toContain("5 November 2029, 10.15 WIB");
  });

  it("menuliskan jumlah dengan format Indonesia dan label kategori", () => {
    expect(html).toContain("Daftar responden");
    expect(html).toContain("1.200");
    expect(html).toContain("Berkas di penyimpanan objek");
  });

  it("meloloskan karakter HTML dan tidak memuat skrip", () => {
    expect(html).toContain("PT Contoh Konstruksi &lt;Tbk&gt;");
    expect(html).not.toMatch(/<script/i);
  });

  it("tanpa catatan tidak menampilkan bagian catatan", () => {
    expect(renderDestructionHtml({ ...minutes, notes: null }, assets)).not.toContain("<h2>Catatan</h2>");
  });
});

describe("urutan kategori", () => {
  it("mengikuti urutan tetap, bukan urutan objek jumlah", () => {
    const html = renderDestructionHtml({ ...minutes, counts: { storageObjects: 1, selfAssessments: 2, rosterEntries: 3 } }, assets);
    const pos = (label: string) => html.indexOf(label);
    expect(pos("Daftar responden")).toBeLessThan(pos("Penilaian mandiri"));
    expect(pos("Penilaian mandiri")).toBeLessThan(pos("Berkas di penyimpanan objek"));
  });
});
