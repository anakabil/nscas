import { describe, expect, it } from "vitest";
import { buildSurveyEmail } from "../email-templates";

const input = {
  to: "siti@contoh.co.id",
  name: "Siti <Aminah>",
  organization: "PT Adhi Karya (Persero) Tbk.",
  link: "https://nscas.nusasafety.co.id/s/abc",
  closesAt: new Date("2026-11-20T10:00:00Z"),
};

describe("surel undangan dan pengingat", () => {
  it("dua bahasa, dengan tautan, tenggat dalam WIB, dan pernyataan anonimitas", () => {
    const mail = buildSurveyEmail({ kind: "invitation", ...input });
    expect(mail.to).toBe("siti@contoh.co.id");
    expect(mail.subject).toBe("Undangan survei budaya keselamatan dan kesehatan kerja PT Adhi Karya (Persero) Tbk.");
    expect(mail.text).toContain("Yth. Siti <Aminah>,");
    expect(mail.text).toContain("Dear Siti <Aminah>,");
    expect(mail.text).toContain(input.link);
    expect(mail.text).toContain("Survei dibuka sampai 20 November 2026 pukul 17.00 WIB.");
    expect(mail.text).toContain("paling sedikit lima orang");
    expect(mail.html).toContain(`href="${input.link}"`);
  });

  it("kepala surel berupa gambar inline (cid), tidak dimuat dari server", () => {
    const mail = buildSurveyEmail({ kind: "invitation", ...input });
    expect(mail.html).toContain('<img src="cid:header@nscas" alt=""');
    expect(mail.html).not.toMatch(/<img src="https?:/);
  });

  it("meloloskan HTML dari nama dan organisasi", () => {
    const mail = buildSurveyEmail({ kind: "invitation", ...input });
    expect(mail.html).toContain("Siti &lt;Aminah&gt;");
    expect(mail.html).not.toContain("<Aminah>");
  });

  it("pengingat memuat tautan baru, sedangkan surel lanjutkan tidak memuat tautan", () => {
    expect(buildSurveyEmail({ kind: "reminder", ...input }).text).toContain(input.link);
    const cont = buildSurveyEmail({ kind: "continue", ...input, link: null });
    expect(cont.subject).toMatch(/^Lanjutkan survei/);
    expect(cont.text).not.toContain("https://");
    expect(cont.html).not.toContain("href=");
  });

  it("tidak memakai tanda pisah panjang", () => {
    for (const kind of ["invitation", "reminder", "continue"] as const) {
      const mail = buildSurveyEmail({ kind, ...input });
      expect(mail.text).not.toMatch(/[–—]/);
    }
  });
});
