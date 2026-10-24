import { describe, expect, it } from "vitest";
import { csvCell, neutralizeFormula, toCsv } from "../csv";

describe("neutralizeFormula", () => {
  it.each(["=SUM(A1:A2)", "+62812", "-1", "@cmd", "\tx", "\rx"])("menetralkan %j", (v) => {
    expect(neutralizeFormula(v)).toBe(`'${v}`);
  });

  it("tidak mengubah teks biasa", () => {
    expect(neutralizeFormula("assessment.create")).toBe("assessment.create");
    expect(neutralizeFormula("2026-10-24T03:00:00.000Z")).toBe("2026-10-24T03:00:00.000Z");
  });
});

describe("csvCell", () => {
  it("mengutip pemisah, kutip, dan baris baru", () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('kata "kutip"')).toBe('"kata ""kutip"""');
    expect(csvCell("baris\nbaru")).toBe('"baris\nbaru"');
    expect(csvCell('{"a":1,"b":2}')).toBe('"{""a"":1,""b"":2}"');
  });

  it("menetralkan rumus sebelum mengutip", () => {
    expect(csvCell('=HYPERLINK("http://x";"klik")')).toBe('"\'=HYPERLINK(""http://x"";""klik"")"');
  });

  it("nilai kosong menjadi sel kosong", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(0)).toBe("0");
  });
});

describe("toCsv", () => {
  it("diawali BOM UTF-8, dipisah titik koma, dan diakhiri CRLF", () => {
    expect(toCsv([["a", "b"], ["1", "=2"]])).toBe("﻿a;b\r\n1;'=2\r\n");
  });
});
