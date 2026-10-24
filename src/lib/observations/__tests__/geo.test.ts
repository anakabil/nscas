import { describe, expect, it } from "vitest";
import { checkRadius, haversineMeters, parseChecklist } from "../geo";

describe("jarak titik observasi", () => {
  it("haversine sesuai jarak yang diketahui", () => {
    // Monas ke Bundaran HI, sekitar 2,2 km.
    const d = haversineMeters({ latitude: -6.1754, longitude: 106.8272 }, { latitude: -6.1951, longitude: 106.8231 });
    expect(d).toBeGreaterThan(2_150);
    expect(d).toBeLessThan(2_300);
    expect(haversineMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 })).toBe(0);
  });

  it("menandai titik di luar radius, tetapi tidak menandai lokasi yang tidak tersedia", () => {
    const site = { latitude: -6.2088, longitude: 106.8456, radiusMeters: 500 };
    expect(checkRadius(site, { latitude: -6.2088, longitude: 106.8486 })).toMatchObject({ outsideRadius: false });
    const far = checkRadius(site, { latitude: -6.2188, longitude: 106.8456 });
    expect(far.outsideRadius).toBe(true);
    expect(far.distanceMeters).toBeGreaterThan(1_000);
    expect(checkRadius(site, null)).toEqual({ distanceMeters: null, outsideRadius: false });
  });
});

describe("daftar periksa observasi", () => {
  it("satu butir per baris dengan kode berurutan, baris kosong dilewati", () => {
    expect(parseChecklist("Pemakaian alat pelindung diri\n\n  Rambu dan pembatas area  \r\nKebersihan area kerja")).toEqual([
      { code: "O1", label: "Pemakaian alat pelindung diri" },
      { code: "O2", label: "Rambu dan pembatas area" },
      { code: "O3", label: "Kebersihan area kerja" },
    ]);
  });
});
