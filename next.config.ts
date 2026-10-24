import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Asal tambahan yang boleh memanggil Server Actions, dipisah koma. Hanya diperlukan di balik proksi yang
// mengganti header Host, misalnya penerus port GitHub Codespaces (docs/09). Kosong di produksi.
const serverActionOrigins = (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(serverActionOrigins.length > 0 ? { experimental: { serverActions: { allowedOrigins: serverActionOrigins } } } : {}),
};

export default withNextIntl(nextConfig);
