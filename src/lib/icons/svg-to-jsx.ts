// Pengubah simbol antarmuka NSCAS (public/icons/nav/*.svg) menjadi komponen React (docs/05 bagian 2,
// docs/11 bagian 6). Murni dan tanpa I/O: dipakai scripts/generate-icons.ts dan diuji di Vitest.
//
// Pengubah ini juga penjaga: SVG berasal dari luar (generator gambar atau desainer), jadi hanya elemen
// gambar dasar dan atribut geometri yang diterima. Warna wajib currentColor agar simbol mengikuti warna
// teks di latar terang maupun gelap.

export interface IconSource {
  /** Nama berkas, misalnya "nav-overview.svg". */
  file: string;
  svg: string;
}

const ELEMENTS = new Set(["g", "path", "circle", "rect", "polygon", "polyline", "line", "ellipse"]);

const ATTRIBUTES: Record<string, string> = {
  d: "d",
  cx: "cx",
  cy: "cy",
  r: "r",
  rx: "rx",
  ry: "ry",
  x: "x",
  y: "y",
  x1: "x1",
  y1: "y1",
  x2: "x2",
  y2: "y2",
  width: "width",
  height: "height",
  points: "points",
  fill: "fill",
  stroke: "stroke",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
};

/** Nilai yang sama dengan atribut akar komponen, sehingga tidak perlu diulang di setiap elemen. */
const INHERITED: Record<string, string> = {
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
};

const COLORS = new Set(["none", "currentColor"]);

export class IconSourceError extends Error {}

/** "nav-phase-data-collection.svg" menjadi "NavPhaseDataCollection". */
export function componentName(file: string): string {
  const base = file.replace(/\.svg$/, "");
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(base)) throw new IconSourceError(`Nama berkas simbol tidak sah: ${file}`);
  return base
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function parseAttributes(raw: string, context: string): [string, string][] {
  const attributes: [string, string][] = [];
  const rest = raw.replace(/([a-zA-Z:-]+)="([^"]*)"/g, (_, name: string, value: string) => {
    attributes.push([name, value]);
    return "";
  });
  if (rest.trim() !== "") throw new IconSourceError(`${context}: atribut tidak dapat dibaca (${rest.trim()})`);
  return attributes;
}

/** Isi elemen svg sebagai JSX. Melempar IconSourceError bila ada isi yang tidak diizinkan. */
export function svgToJsx(svg: string, context = "simbol"): string {
  const root = svg.trim().match(/^<svg\b([^>]*)>([\s\S]*)<\/svg>$/);
  if (!root) throw new IconSourceError(`${context}: bukan satu elemen svg`);
  const rootAttributes = Object.fromEntries(parseAttributes(root[1], context));
  if (rootAttributes.viewBox !== "0 0 24 24") throw new IconSourceError(`${context}: viewBox wajib "0 0 24 24"`);

  const out: string[] = [];
  // Kelompok g tanpa atribut tersisa dibuang beserta penutupnya; tumpukan mencatat mana yang dicetak.
  const groups: boolean[] = [];
  let depth = 0;
  const tag = /<(\/?)([a-zA-Z]+)\b([^>]*?)(\/?)>/g;
  let last = 0;
  for (let match = tag.exec(root[2]); match; match = tag.exec(root[2])) {
    if (root[2].slice(last, match.index).trim() !== "") throw new IconSourceError(`${context}: teks di dalam simbol tidak diizinkan`);
    last = tag.lastIndex;
    const [, closing, name, rawAttributes, selfClosing] = match;
    if (!ELEMENTS.has(name)) throw new IconSourceError(`${context}: elemen <${name}> tidak diizinkan`);
    if (closing) {
      if (name !== "g" || groups.length === 0) throw new IconSourceError(`${context}: penutup </${name}> tidak sah`);
      if (groups.pop()) out.push(`${"  ".repeat(--depth)}</g>`);
      continue;
    }
    const props: string[] = [];
    for (const [attribute, value] of parseAttributes(rawAttributes, context)) {
      const prop = ATTRIBUTES[attribute];
      if (!prop) throw new IconSourceError(`${context}: atribut ${attribute} tidak diizinkan`);
      if ((attribute === "fill" || attribute === "stroke") && !COLORS.has(value)) {
        throw new IconSourceError(`${context}: ${attribute}="${value}" tidak diizinkan; pakai currentColor atau none`);
      }
      if (!/^[0-9a-zA-Z .,\-]*$/.test(value)) throw new IconSourceError(`${context}: nilai ${attribute} tidak sah`);
      if (INHERITED[attribute] === value) continue;
      props.push(`${prop}="${value}"`);
    }
    const open = props.length > 0 ? `<${name} ${props.join(" ")}` : `<${name}`;
    if (name === "g" && !selfClosing) {
      const printed = props.length > 0;
      groups.push(printed);
      if (printed) out.push(`${"  ".repeat(depth++)}${open}>`);
      continue;
    }
    out.push(`${"  ".repeat(depth)}${open} />`);
  }
  if (root[2].slice(last).trim() !== "") throw new IconSourceError(`${context}: teks di dalam simbol tidak diizinkan`);
  if (groups.length > 0) throw new IconSourceError(`${context}: elemen g tidak ditutup`);
  if (out.length === 0) throw new IconSourceError(`${context}: simbol kosong`);
  return out.join("\n");
}

/** Isi berkas src/components/icons/nscas-icons.tsx. */
export function renderIconModule(sources: readonly IconSource[]): string {
  const sorted = [...sources].sort((a, b) => a.file.localeCompare(b.file));
  const icons = sorted.map(({ file, svg }) => {
    const body = svgToJsx(svg, file)
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n");
    return `export const ${componentName(file)} = createIcon(\n  "${file.replace(/\.svg$/, "")}",\n  <>\n${body}\n  </>,\n);\n`;
  });
  return [
    "// Dibuat oleh scripts/generate-icons.ts dari public/icons/nav/*.svg. Jangan disunting langsung:",
    "// ubah berkas SVG-nya, lalu jalankan `npm run icons`. Tes svg-to-jsx memastikan berkas ini selalu sesuai.",
    "",
    'import { createIcon } from "./create-icon";',
    "",
    icons.join("\n"),
  ].join("\n");
}
