import { describe, expect, it } from "vitest";
import { checkHealth, errorCodeOf, ProbeTimeoutError, runProbe } from "@/lib/health";

const ok = async () => {};

describe("runProbe", () => {
  it("melaporkan komponen baik beserta waktu tanggap", async () => {
    let tick = 100;
    const result = await runProbe("database", ok, 1000, () => (tick += 5));
    expect(result).toEqual({ component: "database", ok: true, latencyMs: 5 });
  });

  it("melaporkan kode galat tanpa pesan mentah", async () => {
    const failing = async () => {
      throw Object.assign(new Error("connect ECONNREFUSED postgresql://user:secret@host"), {
        code: "ECONNREFUSED",
      });
    };
    const result = await runProbe("database", failing);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("ECONNREFUSED");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("menganggap gagal bila melewati batas waktu", async () => {
    const hanging = () => new Promise<void>(() => {});
    const result = await runProbe("storage", hanging, 10);
    expect(result).toMatchObject({ component: "storage", ok: false, errorCode: "ProbeTimeoutError" });
  });
});

describe("errorCodeOf", () => {
  it("mengutamakan code, lalu Code (AWS SDK), lalu nama kelas galat", () => {
    expect(errorCodeOf({ code: "P1001" })).toBe("P1001");
    expect(errorCodeOf({ Code: "NoSuchBucket", name: "NoSuchBucket" })).toBe("NoSuchBucket");
    expect(errorCodeOf(new ProbeTimeoutError())).toBe("ProbeTimeoutError");
    expect(errorCodeOf(new Error("x"))).toBe("UNKNOWN");
    expect(errorCodeOf("string")).toBe("UNKNOWN");
  });
});

describe("checkHealth", () => {
  it("baik hanya bila semua komponen baik", async () => {
    const healthy = await checkHealth({ database: ok, storage: ok });
    expect(healthy.ok).toBe(true);
    expect(healthy.components.map((c) => c.component)).toEqual(["database", "storage"]);

    const degraded = await checkHealth({
      database: ok,
      storage: async () => {
        throw Object.assign(new Error("bucket"), { name: "NotFound" });
      },
    });
    expect(degraded.ok).toBe(false);
    expect(degraded.components[1]).toMatchObject({ ok: false, errorCode: "NotFound" });
  });
});
