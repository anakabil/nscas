// Membuat src/components/icons/nscas-icons.tsx dari public/icons/nav/*.svg (docs/11 bagian 6).
// Jalankan setelah menambah atau mengubah simbol: npm run icons

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderIconModule } from "../src/lib/icons/svg-to-jsx";

export const ICON_SOURCE_DIR = "public/icons/nav";
export const ICON_MODULE = "src/components/icons/nscas-icons.tsx";

const sources = readdirSync(ICON_SOURCE_DIR)
  .filter((file) => file.endsWith(".svg"))
  .map((file) => ({ file, svg: readFileSync(join(ICON_SOURCE_DIR, file), "utf8") }));

writeFileSync(ICON_MODULE, renderIconModule(sources));
console.log(`${sources.length} simbol ditulis ke ${ICON_MODULE}`);
