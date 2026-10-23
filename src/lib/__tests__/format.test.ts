import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatNumber, formatTime } from "@/lib/format";

describe("format Indonesia (docs/05 bagian 4)", () => {
  it("memakai koma desimal dan titik ribuan", () => {
    expect(formatNumber(3.143463, 2)).toBe("3,14");
    expect(formatNumber(3000)).toBe("3.000");
  });

  it("menulis tanggal dan waktu WIB", () => {
    const date = new Date("2026-10-23T01:00:00Z"); // 08.00 WIB
    expect(formatDate(date)).toBe("23 Oktober 2026");
    expect(formatTime(date)).toBe("08.00 WIB");
    expect(formatDateTime(date)).toBe("23 Oktober 2026, 08.00 WIB");
  });

  it("memberi label WITA dan WIT untuk zona lain", () => {
    const date = new Date("2026-10-23T01:00:00Z");
    expect(formatTime(date, "Asia/Makassar")).toBe("09.00 WITA");
    expect(formatTime(date, "Asia/Jayapura")).toBe("10.00 WIT");
  });
});
