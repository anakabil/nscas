import { expect, test } from "@playwright/test";

test("halaman /health menampilkan status basis data dan penyimpanan objek", async ({ page }) => {
  await page.goto("/health");

  await expect(page.getByRole("heading", { name: "Status sistem" })).toBeVisible();
  await expect(page.getByTestId("health-database")).toBeVisible();
  await expect(page.getByTestId("health-storage")).toBeVisible();

  // Dengan docker compose berjalan dan .env terisi, semua komponen harus baik.
  if (process.env.E2E_EXPECT_HEALTHY === "1") {
    await expect(page.getByTestId("health-overall")).toHaveAttribute("data-ok", "true");
  }
});

test("beranda memuat logo Nusa Safety, tautan masuk, dan tautan ke status sistem", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("img", { name: "Logo Nusa Safety" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Masuk" })).toBeVisible();
  await page.getByRole("link", { name: "Periksa status sistem" }).click();
  await expect(page).toHaveURL(/\/health$/);
});
