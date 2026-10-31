import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { formatDateTime } from "@/lib/format";
import { loadSurveyContent, resolveSurveyToken } from "@/lib/survey/service";
import en from "../../../../messages/en.json";
import id from "../../../../messages/id.json";
import { SurveyApp } from "./survey-app";
import { TokenArt } from "@/components/token-art";

// Halaman survei bertoken (docs/01 M3). Tidak memeriksa sesi: hak akses adalah token itu sendiri. Halaman ini
// tidak membaca alamat IP dan tidak mencatat apa pun saat dibuka; penandaan "pernah dibuka" dilakukan dari
// peramban melalui /s/[token]/open agar pratinjau tautan aplikasi pesan tidak ikut terhitung.

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("survey");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

const paramsSchema = z.object({ token: z.string().min(1).max(64) });

function formatDeadline(date: Date, locale: "id" | "en"): string {
  if (locale === "id") return formatDateTime(date);
  const d = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Jakarta" }).format(date);
  return `${d} WIB`;
}

export default async function SurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  const status = parsed.success ? await resolveSurveyToken(parsed.data.token) : ({ state: "INVALID" } as const);
  const t = await getTranslations("survey");

  if (status.state !== "READY") {
    return (
      <main className="survey mx-auto flex min-h-dvh max-w-xl flex-col gap-4 px-4 py-10" data-testid="survey-status" data-state={status.state}>
        {/* Tautan yang sudah dipakai berarti survei sudah diisi: ilustrasi terima kasih, bukan tautan rusak. */}
        <TokenArt name={status.state === "USED" ? "thanks" : "unavailable"} className="max-w-sm" />
        <h1 className="text-brand-navy text-2xl leading-tight font-bold">{t(`status.${status.state}.title`)}</h1>
        <p>{t(`status.${status.state}.body`)}</p>
        {status.state === "NOT_OPEN" && status.opensAt ? <p>{t("status.NOT_OPEN.opensAt", { date: formatDateTime(status.opensAt) })}</p> : null}
      </main>
    );
  }

  const token = (parsed.data as { token: string }).token;
  const content = await loadSurveyContent(status.instrumentVersionId, status.assessmentId, status.tokenHash, status.needsStratum);
  const locale = (await getLocale()) === "en" ? "en" : "id";

  return (
    <SurveyApp
      token={token}
      draftKey={status.tokenHash.slice(0, 24)}
      organizationName={status.organizationName}
      closesAt={status.closesAt ? { id: formatDeadline(status.closesAt, "id"), en: formatDeadline(status.closesAt, "en") } : null}
      consent={status.consent}
      needsStratum={status.needsStratum}
      content={content}
      messages={{ id: id.survey, en: en.survey }}
      initialLanguage={locale}
    />
  );
}
