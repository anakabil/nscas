import { beforeEach, describe, expect, it, vi } from "vitest";
import { cachedByKey, clearInstrumentCache } from "../instrument-cache";

describe("cache instrumen survei", () => {
  beforeEach(() => clearInstrumentCache());

  it("memuat sekali untuk kunci yang sama selama belum kedaluwarsa", async () => {
    const load = vi.fn(async () => ({ items: 21 }));
    const now = 1_000_000;
    await Promise.all([cachedByKey("v1", load, now), cachedByKey("v1", load, now + 1000)]);
    expect(load).toHaveBeenCalledTimes(1);
    await cachedByKey("v2", load, now);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("memuat ulang setelah lima menit", async () => {
    const load = vi.fn(async () => 1);
    await cachedByKey("v1", load, 0);
    await cachedByKey("v1", load, 5 * 60_000 + 1);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("pemuatan yang gagal tidak disimpan", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("koneksi putus")).mockResolvedValueOnce("ok");
    await expect(cachedByKey("v1", load, 0)).rejects.toThrow("koneksi putus");
    await expect(cachedByKey("v1", load, 1)).resolves.toBe("ok");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
