import { NavLogout } from "@/components/icons/nscas-icons";
import { getTranslations } from "next-intl/server";
import { logoutAction } from "@/app/(account)/account/actions";
import { SubmitButton } from "@/components/forms/submit-button";

/** Tombol keluar; tone "dark" untuk kepala halaman berlatar biru batu gelap. */
export async function LogoutForm({ tone = "light" }: { tone?: "light" | "dark" }) {
  const t = await getTranslations("nav");
  return (
    <form action={logoutAction}>
      <SubmitButton
        variant="outline"
        pendingLabel={t("logout")}
        className={tone === "dark" ? "h-9 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" : "w-full"}
      >
        <NavLogout aria-hidden strokeWidth={1.75} />
        {t("logout")}
      </SubmitButton>
    </form>
  );
}
