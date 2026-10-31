import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { OBSERVATION_WINDOW_WRITE_ROLES, rolesFor } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { getAppTimeZone } from "@/lib/env";
import { formatDateTime, formatNumber } from "@/lib/format";
import { listObservationWindows } from "@/lib/observations/service";
import { CopyLink, CreateWindowForm } from "./window-form";
import { EmptyState } from "@/components/illustration";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("observations") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export default async function ObservationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, rolesFor("evidenceAndObservations", "read")));
  const t = await getTranslations("observations");
  const db = getDb();
  const [assessment, units, windows] = await Promise.all([
    db.assessment.findUniqueOrThrow({ where: { id: access.assessmentId, organizationId: access.organizationId }, select: { status: true } }),
    db.unit.findMany({ where: { assessmentId: access.assessmentId }, select: { id: true, name: true, latitude: true, longitude: true, radiusMeters: true }, orderBy: { name: "asc" } }),
    listObservationWindows(access.assessmentId, access.unitScope),
  ]);
  const canCreate =
    (assessment.status === "LOCKED" || assessment.status === "DATA_COLLECTION") && access.roles.some((r) => (OBSERVATION_WINDOW_WRITE_ROLES as readonly string[]).includes(r));
  const tz = getAppTimeZone();
  const now = new Date();
  const statusOf = (w: { opensAt: Date; closesAt: Date }) => (w.opensAt > now ? "UPCOMING" : w.closesAt <= now ? "CLOSED" : "OPEN");

  return (
    <>
      <p className="text-muted-foreground">{t("intro")}</p>
      {canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("create.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateWindowForm assessmentId={access.assessmentId} units={units} />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{t("windows.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {windows.length === 0 ? (
            <EmptyState illustration="empty-observations">
              <p>{t("windows.empty")}</p>
            </EmptyState>
          ) : null}
          {windows.map((w) => (
            <article key={w.id} className="border-border space-y-3 rounded-lg border p-4" data-testid="observation-window" data-status={statusOf(w)}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{w.title}</h3>
                <Badge variant="outline">{w.unit.name}</Badge>
                <Badge variant={statusOf(w) === "OPEN" ? "success" : "secondary"}>{t(`windows.status.${statusOf(w)}`)}</Badge>
              </div>
              <p className="text-sm">{t("windows.period", { opens: formatDateTime(w.opensAt, tz), closes: formatDateTime(w.closesAt, tz) })}</p>
              <p className="text-muted-foreground text-sm">
                {t("windows.site", { lat: formatNumber(w.latitude, 5), lng: formatNumber(w.longitude, 5), radius: formatNumber(w.radiusMeters) })}
              </p>
              <ol className="list-inside list-decimal text-sm">
                {w.checklist.map((c) => (
                  <li key={c.code}>
                    <span className="font-mono">{c.code}</span> {c.label}
                  </li>
                ))}
              </ol>
              <div className="space-y-1">
                <p className="text-sm font-semibold">{t("windows.link")}</p>
                <CopyLink path={`/o/${w.id}`} />
              </div>
              <CardDescription>{w.captures.length ? t("windows.captures", { count: w.captures.length }) : t("windows.noCaptures")}</CardDescription>
              <div className="grid gap-3 sm:grid-cols-3">
                {w.captures.map((c) => {
                  const src = `/api/assessments/${access.assessmentId}/observations/${c.id}`;
                  return (
                    <figure key={c.id} className="border-border space-y-1 rounded-lg border p-2 text-xs" data-testid="observation-capture" data-outside={c.outsideRadius}>
                      {c.mimeType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element -- dialihkan ke URL bertanda tangan setelah pemeriksaan hak akses
                        <img src={`${src}?inline=1`} alt={`${c.checklistItemCode} ${formatDateTime(c.serverCapturedAt, tz)}`} className="aspect-video w-full rounded object-cover" loading="lazy" />
                      ) : (
                        <a href={src} className="bg-tint flex aspect-video items-center justify-center rounded font-semibold">
                          {t("windows.video")}
                        </a>
                      )}
                      <figcaption className="space-y-0.5">
                        <p className="font-mono font-semibold">{c.checklistItemCode}</p>
                        <p>{t("windows.capturedAt", { time: formatDateTime(c.serverCapturedAt, tz) })}</p>
                        <p>{c.uploadedBy.name}</p>
                        {c.latitude === null ? (
                          <p className="text-warning">{t("windows.noLocation")}</p>
                        ) : (
                          <p>
                            {t("windows.distance", { meters: formatNumber(c.distanceFromSiteMeters ?? 0) })} · {t("windows.accuracy", { meters: formatNumber(c.accuracyMeters ?? 0) })}
                          </p>
                        )}
                        {c.outsideRadius ? <Badge variant="warning">{t("windows.outside")}</Badge> : null}
                        {c.note ? <p className="text-muted-foreground">{c.note}</p> : null}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </article>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
