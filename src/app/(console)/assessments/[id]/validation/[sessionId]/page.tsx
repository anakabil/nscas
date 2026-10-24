import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { VALIDATION_ROLES } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { getAppTimeZone } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { loadSession } from "@/lib/validation/service";
import { AssessorForm, ParticipantForm, RemoveParticipantButton, SessionForm } from "../validation-forms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("validation") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64), sessionId: z.string().min(1).max(64) });

/** Nilai datetime-local dalam WIB untuk isian formulir. */
const wibInput = (date: Date | null) => (date ? new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(0, 16) : "");

export default async function ValidationSessionPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { id, sessionId } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, VALIDATION_ROLES.read));
  const session = await loadSession(access.assessmentId, sessionId, access.userId);
  if (!session) notFound();
  const t = await getTranslations("validation");
  const db = getDb();
  const [units, strata] = await Promise.all([
    db.unit.findMany({ where: { assessmentId: access.assessmentId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.stratum.findMany({ where: { assessmentId: access.assessmentId }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);
  const has = (roles: readonly string[]) => access.roles.some((r) => roles.includes(r));
  const status = session.assessment.status;
  const canSchedule = ["LOCKED", "DATA_COLLECTION", "SCORING"].includes(status) && has(VALIDATION_ROLES.schedule);
  const canRate = ["DATA_COLLECTION", "SCORING"].includes(status) && has(VALIDATION_ROLES.rate);
  const canParticipants = ["LOCKED", "DATA_COLLECTION", "SCORING"].includes(status) && has(VALIDATION_ROLES.rate);
  const tz = getAppTimeZone();
  const names = Object.fromEntries(session.characteristics.map((c) => [c.code, c.nameId]));

  return (
    <>
      <Link href={`/assessments/${access.assessmentId}/validation`} className="text-brand-navy text-sm font-semibold underline">
        {t("session.back")}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold" data-testid="session-label">
          {session.label}
        </h2>
        <Badge variant="outline">{t(`types.${session.type}`)}</Badge>
        <Badge variant="secondary">{t(`statuses.${session.status}`)}</Badge>
      </div>
      <p className="text-sm">
        {session.scheduledAt ? formatDateTime(session.scheduledAt, tz) : t("list.notScheduled")}
        {session.meetingUrl ? (
          <>
            {" · "}
            <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-brand-navy underline">
              {t("list.join")}
            </a>
          </>
        ) : null}
      </p>

      {canSchedule ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("session.schedule")}</CardTitle>
          </CardHeader>
          <CardContent>
            <SessionForm
              assessmentId={access.assessmentId}
              sessionId={session.id}
              units={units}
              strata={strata}
              values={{
                type: session.type,
                label: session.label,
                unitId: session.unitId ?? "",
                stratumId: session.stratumId ?? "",
                scheduledAt: wibInput(session.scheduledAt),
                meetingUrl: session.meetingUrl ?? "",
                participantCount: session.participantCount === null ? "" : String(session.participantCount),
                guideLayer: session.guideTemplate?.layer ?? "FIELD",
                status: session.status,
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{session.guideTemplate ? t("session.guide", { layer: t(`layers.${session.guideTemplate.layer}`) }) : t("session.noGuide")}</CardTitle>
          {session.guideTemplate ? <CardDescription className="whitespace-pre-line">{session.guideTemplate.intro}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm" data-testid="session-guide">
            {session.guideQuestions.map((q) => (
              <li key={q.characteristicCode}>
                <span className="font-mono font-semibold">{q.characteristicCode}</span> <span className="text-muted-foreground">{names[q.characteristicCode]}</span>
                <p>{q.question}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("session.form")}</CardTitle>
          <CardDescription>{t("session.formIntro")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground text-sm">{t("session.ratedBy", { count: session._count.ratings })}</p>
          <AssessorForm
            assessmentId={access.assessmentId}
            sessionId={session.id}
            characteristics={session.characteristics.map((c) => ({ id: c.id, code: c.code, name: c.nameId }))}
            initial={{
              recordingConsent: session.recordingConsent,
              notes: session.notes ?? "",
              ratings: Object.fromEntries(session.ratings.map((r) => [r.characteristicId, { level: r.level, note: r.note ?? "" }])),
            }}
            open={canRate}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("session.participants")}</CardTitle>
          <CardDescription>{t("session.participantsIntro")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {session.participants.length === 0 ? <p className="text-muted-foreground text-sm">{t("session.noParticipants")}</p> : null}
          <ul className="space-y-2" data-testid="participant-list">
            {session.participants.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold">{p.fullName}</span>
                <span className="text-muted-foreground">{p.position}</span>
                {canParticipants ? <RemoveParticipantButton assessmentId={access.assessmentId} participantId={p.id} /> : null}
              </li>
            ))}
          </ul>
          {canParticipants ? <ParticipantForm assessmentId={access.assessmentId} sessionId={session.id} /> : null}
        </CardContent>
      </Card>
    </>
  );
}
