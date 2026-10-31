import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Simbol antarmuka memakai set NSCAS (public/icons/nav, docs/11 bagian 6) agar bentuk dan ketebalannya seragam.
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "lucide-react", message: "Pakai simbol NSCAS dari @/components/icons/nscas-icons." }] },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/generated/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
];

export default eslintConfig;
