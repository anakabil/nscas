import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import id from "../../../messages/id.json";

type Messages = { [key: string]: string | Messages };

function flatten(messages: Messages, prefix = ""): Record<string, string> {
  return Object.entries(messages).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") acc[path] = value;
    else Object.assign(acc, flatten(value, path));
    return acc;
  }, {});
}

const flatId = flatten(id);
const flatEn = flatten(en);

describe("berkas pesan antarmuka", () => {
  it("bahasa Indonesia dan Inggris memiliki kunci yang sama", () => {
    expect(Object.keys(flatEn).sort()).toEqual(Object.keys(flatId).sort());
  });

  it("tidak ada teks kosong", () => {
    for (const [key, value] of Object.entries({ ...flatId, ...flatEn })) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("tidak memakai tanda pisah panjang (docs/05 bagian 4)", () => {
    for (const [key, value] of Object.entries({ ...flatId, ...flatEn })) {
      expect(value, key).not.toMatch(/[–—]/);
    }
  });

  it("memuat pernyataan bahwa hasil bukan sertifikat Safety Culture Ladder", () => {
    expect(flatId["common.resultDisclaimer"]).toContain("bukan sertifikat");
  });
});
