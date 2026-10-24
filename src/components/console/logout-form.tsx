import { getTranslations } from "next-intl/server";
import { logoutAction } from "@/app/(account)/account/actions";
import { SubmitButton } from "@/components/forms/submit-button";

export async function LogoutForm() {
  const t = await getTranslations("nav");
  return (
    <form action={logoutAction}>
      <SubmitButton variant="outline" pendingLabel={t("logout")}>
        {t("logout")}
      </SubmitButton>
    </form>
  );
}
