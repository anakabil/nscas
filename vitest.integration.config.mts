import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tes integrasi terhadap PostgreSQL dari docker compose. Basis data uji dibuat ulang dari migrasi
// pada setiap eksekusi (lihat tests/integration/global-setup.ts).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    // Semua berkas memakai satu basis data uji, sehingga dijalankan berurutan.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
