"use client";

import { useActionState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createQrAction, deactivateQrAction, type QrState } from "../actions";

export function CreateQrForm({
  assessmentId,
  units,
  organizationName,
  closesAt,
}: {
  assessmentId: string;
  units: { id: string; name: string }[];
  organizationName: string;
  closesAt: string | null;
}) {
  const t = useTranslations("respondents.qr");
  const tErrors = useTranslations("assessment.errors");
  const [state, formAction] = useActionState<QrState, FormData>(createQrAction.bind(null, assessmentId), {});

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        {state.error ? <Alert variant="destructive">{tErrors(state.error)}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="qr-unit">{t("unit")}</Label>
            <Select id="qr-unit" name="unitId" required>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qr-max">{t("maxIssuance")}</Label>
            <Input id="qr-max" name="maxIssuance" inputMode="numeric" aria-describedby="qr-max-hint" />
            <p id="qr-max-hint" className="text-muted-foreground text-xs">
              {t("maxIssuanceHint")}
            </p>
          </div>
        </div>
        <SubmitButton pendingLabel={t("creating")}>{t("create")}</SubmitButton>
      </form>

      {state.qr ? (
        <div className="space-y-4">
          <Alert variant="warning">{t("printReady", { unit: state.qr.unitName })}</Alert>
          <Button type="button" onClick={() => window.print()} data-testid="qr-print">
            {t("print")}
          </Button>
          <PrintSheet qr={state.qr} organizationName={organizationName} closesAt={closesAt} />
        </div>
      ) : null}
    </div>
  );
}

type SheetProps = { qr: NonNullable<QrState["qr"]>; organizationName: string; closesAt: string | null };

/**
 * Lembar A4 untuk ditempel di lokasi proyek. Di layar tampil sebagai pratinjau; untuk dicetak, salinannya
 * dipasang langsung di bawah body (kelas print-only) sehingga hanya lembar ini yang tercetak, tepat satu halaman.
 */
function PrintSheet(props: SheetProps) {
  return (
    <>
      <section className="border-border mx-auto max-w-[180mm] rounded-xl border bg-white p-8 text-black" data-testid="qr-sheet">
        <SheetContent {...props} />
      </section>
      {typeof document === "undefined"
        ? null
        : createPortal(
            <section className="print-only bg-white text-black" data-testid="qr-print-sheet">
              <SheetContent {...props} />
            </section>,
            document.body,
          )}
    </>
  );
}

function SheetContent({ qr, organizationName, closesAt }: SheetProps) {
  const t = useTranslations("respondents.qr.sheet");
  return (
    <div className="space-y-4 text-center">
      <p className="text-sm font-semibold tracking-wide uppercase">{organizationName}</p>
      <h2 className="text-3xl leading-tight font-bold">{t("heading")}</h2>
      <p className="text-xl">
        {t("unit")}: <strong data-testid="qr-sheet-unit">{qr.unitName}</strong>
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- gambar data URL hasil server, bukan berkas statis */}
      <img src={qr.image} alt="" className="mx-auto h-auto w-[95mm] max-w-full" data-testid="qr-image" />
      <p className="text-xl font-semibold">{t("scan")}</p>
      <p>{t("anonymous")}</p>
      <p>{t("duration")}</p>
      {closesAt ? <p className="font-semibold">{t("closes", { date: closesAt })}</p> : null}
      <div className="space-y-1 text-sm">
        <p>{t("manual")}</p>
        <p className="font-mono break-all" data-testid="qr-link">
          {qr.link}
        </p>
      </div>
      <p className="text-xs">{t("footer")}</p>
    </div>
  );
}

export function DeactivateQrButton({ assessmentId, qrId }: { assessmentId: string; qrId: string }) {
  const t = useTranslations("respondents.qr");
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t("confirmDeactivate"))) return;
        startTransition(async () => {
          await deactivateQrAction(assessmentId, qrId);
        });
      }}
    >
      {t("deactivate")}
    </Button>
  );
}
