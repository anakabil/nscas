import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { formatDateTime } from "@/lib/format";
import { JUSTIFICATION_MIN_LENGTH } from "@/lib/self-assessment/rules";
import { loadSelfAssessmentForm, resolveSelfAssessmentToken } from "@/lib/self-assessment/service";
import en from "../../../../messages/en.json";
import id from "../../../../messages/id.json";
import { SelfAssessmentForm } from "./self-assessment-form";

// Penilaian mandiri manajemen (docs/01 M4). Hak akses adalah token di tautan; pengisi tidak memiliki akun.

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("selfAssessmentForm");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

const paramsSchema = z.object({ token: z.string().min(1).max(64) });

export default async function SelfAssessmentPage({ params }: { params: Promise<{ token: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  const access = parsed.success ? await resolveSelfAssessmentToken(parsed.data.token) : ({ state: "INVALID" } as const);
  const t = await getTranslations("selfAssessmentForm");
  const locale = (await getLocale()) === "en" ? "en" : "id";

  if (access.state === "INVALID" || access.state === "CLOSED") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-4 py-10" data-testid="sa-status" data-state={access.state}>
        <h1 className="text-brand-navy text-2xl font-bold">{t(`status.${access.state}.title`)}</h1>
        <p>{t(`status.${access.state}.body`)}</p>
      </main>
    );
  }

  const form = await loadSelfAssessmentForm(access);
  const pick = (text: { id: string; en: string | null }) => (locale === "en" && text.en ? text.en : text.id);

  if (form.status === "SUBMITTED") {
    return (
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-10" data-testid="sa-submitted">
        <p className="text-muted-foreground text-sm font-semibold">{form.organizationName}</p>
        <h1 className="text-brand-navy text-2xl font-bold">{t("submitted.title")}</h1>
        <p>{t("submitted.body", { date: form.submittedAt ? formatDateTime(form.submittedAt) : "" })}</p>
        <h2 className="text-lg font-semibold">{t("submitted.answers")}</h2>
        <ol className="space-y-4">
          {form.characteristics.map((c) => (
            <li key={c.id} className="border-border bg-card space-y-2 rounded-xl border p-4">
              <p className="font-semibold">
                {c.code} {pick(c.name)}
              </p>
              <p>{pick(c.statements.find((s) => s.id === c.answer.statementId)?.text ?? { id: "", en: null })}</p>
              <p className="text-muted-foreground text-sm whitespace-pre-line">{c.answer.justification}</p>
            </li>
          ))}
        </ol>
      </main>
    );
  }

  const messages = locale === "en" ? en.selfAssessmentForm : id.selfAssessmentForm;
  return (
    <SelfAssessmentForm
      token={(parsed.data as { token: string }).token}
      locale={locale}
      messages={messages}
      minLength={JUSTIFICATION_MIN_LENGTH}
      organizationName={form.organizationName}
      profile={form.profile}
      evidence={form.evidence}
      characteristics={form.characteristics.map((c) => ({
        id: c.id,
        code: c.code,
        name: pick(c.name),
        statements: c.statements.map((s) => ({ id: s.id, text: pick(s.text) })),
        answer: c.answer,
      }))}
    />
  );
}
