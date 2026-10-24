import { describe, expect, it } from "vitest";
import { allVisibleMeetMinimum, primaryState, suppressCells, suppressValue } from "../suppression";

describe("penyembunyian sel di bawah 5 responden", () => {
  it("menyembunyikan nilai dan jumlah sel dengan 1 sampai 4 responden", () => {
    expect(primaryState(3.2, 4, 5)).toBe("suppressed");
    expect(primaryState(3.2, 5, 5)).toBe("visible");
    expect(primaryState(null, 0, 5)).toBe("empty");
    expect(primaryState(null, 8, 5)).toBe("empty");
    // Nilai tidak terhitung (misalnya varians nol) tetap disembunyikan bila respondennya kurang dari 5.
    expect(suppressValue(null, 2, 5)).toEqual({ key: "", value: null, n: null, state: "suppressed" });
    expect(suppressValue(0.81, 4, 5)).toEqual({ key: "", value: null, n: null, state: "suppressed" });
    expect(suppressValue(0.81, 12, 5)).toEqual({ key: "", value: 0.81, n: 12, state: "visible" });
  });

  it("penyembunyian pelengkap: satu sel tersembunyi dalam kelompok berarti sel terkecil lain ikut disembunyikan", () => {
    const cells = [
      { key: "S1", value: 3.0, n: 3 },
      { key: "S2", value: 3.6, n: 40 },
      { key: "S3", value: 3.1, n: 60 },
      { key: "S4", value: 2.9, n: 300 },
      { key: "S5", value: 3.3, n: 120 },
    ];
    const out = suppressCells(cells, 5, [["S1", "S2"], ["S4", "S5"]]);
    expect(out.map((c) => c.state)).toEqual(["suppressed", "secondary", "visible", "visible", "visible"]);
    expect(out[1]).toEqual({ key: "S2", value: null, n: null, state: "secondary" });
    expect(allVisibleMeetMinimum(out, 5)).toBe(true);
  });

  it("kelompok dengan dua sel tersembunyi atau tanpa sel tersembunyi tidak berubah", () => {
    const cells = [
      { key: "a", value: 3, n: 2 },
      { key: "b", value: 3, n: 3 },
      { key: "c", value: 3, n: 9 },
      { key: "d", value: 4, n: 0 },
    ];
    expect(suppressCells(cells, 5, [["a", "b", "c"]]).map((c) => c.state)).toEqual(["suppressed", "suppressed", "visible", "empty"]);
    expect(suppressCells(cells.slice(2), 5, [["c", "d"]]).map((c) => c.state)).toEqual(["visible", "empty"]);
  });

  it("penyembunyian pelengkap berantai antarkelompok yang beririsan", () => {
    const cells = [
      { key: "a", value: 3, n: 2 },
      { key: "b", value: 3, n: 6 },
      { key: "c", value: 3, n: 7 },
      { key: "d", value: 3, n: 8 },
    ];
    // a tersembunyi; kelompok [a, b] menyembunyikan b; kelompok [b, c, d] lalu memiliki satu sel tersembunyi.
    const out = suppressCells(cells, 5, [["a", "b"], ["b", "c", "d"]]);
    expect(out.map((c) => c.state)).toEqual(["suppressed", "secondary", "secondary", "visible"]);
  });
});
