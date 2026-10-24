import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import { getAppTimeZone } from "@/lib/env";
import { formatDateTime } from "@/lib/format";

/** Pemberitahuan baca saja: konfigurasi sudah dikunci, atau pengguna hanya berhak melihat. */
export async function ConfigurationNotice({ lockedAt, canWrite }: { lockedAt: Date | null; canWrite: boolean }) {
  const t = await getTranslations("assessment");
  if (lockedAt) {
    return (
      <Alert variant="info" data-testid="configuration-locked">
        {t("locked", { time: formatDateTime(lockedAt, getAppTimeZone()) })}
      </Alert>
    );
  }
  if (!canWrite) return <Alert variant="info">{t("readOnly")}</Alert>;
  return null;
}
