import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { componentName, IconSourceError, renderIconModule, svgToJsx } from "@/lib/icons/svg-to-jsx";

const DIR = "public/icons/nav";
const wrap = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${body}</svg>`;

describe("pengubah simbol SVG", () => {
  it("menurunkan nama komponen dari nama berkas", () => {
    expect(componentName("nav-phase-data-collection.svg")).toBe("NavPhaseDataCollection");
    expect(componentName("ui-x-circle.svg")).toBe("UiXCircle");
    expect(() => componentName("Nav Overview.svg")).toThrow(IconSourceError);
  });

  it("membuang atribut yang sama dengan akar dan kelompok g yang kosong", () => {
    const jsx = svgToJsx(
      wrap('<g stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="7" r="1.5" fill="currentColor" stroke="none"/></g>'),
    );
    expect(jsx).toBe('<circle cx="12" cy="12" r="9" />\n<circle cx="12" cy="7" r="1.5" fill="currentColor" stroke="none" />');
  });

  it.each([
    ["skrip", '<script>alert(1)</script>'],
    ["atribut peristiwa", '<path d="M0 0" onload="alert(1)"/>'],
    ["tautan", '<path d="M0 0" href="https://contoh.id"/>'],
    ["warna tetap", '<circle cx="1" cy="1" r="1" fill="white"/>'],
    ["teks", "<g>NSCAS</g>"],
    ["objek asing", "<foreignObject/>"],
  ])("menolak %s", (_, body) => {
    expect(() => svgToJsx(wrap(body))).toThrow(IconSourceError);
  });

  it("menolak simbol di luar kisi 24 x 24", () => {
    expect(() => svgToJsx('<svg viewBox="0 0 48 48"><path d="M0 0"/></svg>')).toThrow(/viewBox/);
  });
});

describe("set simbol NSCAS", () => {
  const files = readdirSync(DIR).filter((file) => file.endsWith(".svg"));
  const sources = files.map((file) => ({ file, svg: readFileSync(join(DIR, file), "utf8") }));

  it("berisi 41 simbol sesuai docs/11 bagian 6", () => {
    expect(files).toHaveLength(41);
  });

  it("komponen yang dibuat selalu sama dengan berkas SVG (jalankan npm run icons bila gagal)", () => {
    expect(readFileSync("src/components/icons/nscas-icons.tsx", "utf8")).toBe(renderIconModule(sources));
  });
});
