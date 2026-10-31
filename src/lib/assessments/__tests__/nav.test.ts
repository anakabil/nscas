import { describe, expect, it } from "vitest";
import { assessmentNavGroups, quickAccessItems } from "@/lib/assessments/nav";

const pages = (groups: ReturnType<typeof assessmentNavGroups>) => groups.flatMap((g) => g.items.map((i) => i.page));

describe("menu asesmen", () => {
  it("asesor utama melihat seluruh tahap dengan urutan alur kerja", () => {
    const groups = assessmentNavGroups("a1", "DATA_COLLECTION", ["LEAD_ASSESSOR"]);
    expect(groups.map((g) => g.key)).toEqual(["overview", "PREPARATION", "DATA_COLLECTION", "SCORING", "RESULTS", "OTHER"]);
    expect(groups.find((g) => g.key === "DATA_COLLECTION")?.state).toBe("current");
    expect(groups.find((g) => g.key === "PREPARATION")?.state).toBe("done");
    expect(pages(groups)).toContain("qr");
    expect(groups[0].items[0]).toEqual({ page: "overview", href: "/assessments/a1", exact: true });
  });

  it("menyembunyikan halaman yang tidak boleh diakses peran tersebut dan kelompok yang menjadi kosong", () => {
    const groups = assessmentNavGroups("a1", "DATA_COLLECTION", ["EXECUTIVE_VIEWER"]);
    expect(pages(groups)).not.toContain("qr");
    expect(pages(groups)).not.toContain("scoring");
    for (const group of groups) expect(group.items.length).toBeGreaterThan(0);
  });

  it("akses cepat menampilkan halaman tahap yang sedang berjalan, dan halaman hasil setelah diarsipkan", () => {
    const lead = (status: Parameters<typeof assessmentNavGroups>[1]) => quickAccessItems(assessmentNavGroups("a1", status, ["LEAD_ASSESSOR"]), status);
    expect(lead("DRAFT")?.phase).toBe("PREPARATION");
    expect(lead("PANEL_REVIEW")?.items.map((i) => i.page)).toEqual(["scoring", "panel"]);
    expect(lead("ARCHIVED")?.phase).toBe("RESULTS");
  });
});
