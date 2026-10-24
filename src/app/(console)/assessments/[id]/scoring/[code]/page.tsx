import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RATIONALE_MIN_LENGTH } from "@/lib/assessor-scoring/rules";
import { RATING_STATUSES, loadRatingWorkspace } from "@/lib/assessor-scoring/service";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { SCORING_ROLES } from "@/lib/auth/roles";
import { getAppTimeZone } from "@/lib/env";
import { formatDateTime, formatNumber } from "@/lib/format";
import { EvidenceRatingForm } from "../scoring-forms";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().min(1).max(64), code: z.string().regex(/^K[0-9T]+\.\d+$/) });

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: `${t("scoring")} ${decodeURIComponent((await params).code)}` };
}

export default async function RatingWorkspacePage({ params }: { params: Promise<{ id: string; code: string }> }) {
  const raw = await params;
  const parsed = paramsSchema.safeParse({ id: raw.id, code: decodeURIComponent(raw.code) });
  if (!parsed.success) notFound();
  const access = await guardPage(() => requireRole(parsed.data.id, SCORING_ROLES.read));
  const t = await getTranslations("scoring");
  const ws = await loadRatingWorkspace(access.assessmentId, parsed.data.code, access.session.user.id);
  if (!ws) notFound();
  const tz = getAppTimeZone();
  const canRate = RATING_STATUSES.includes(ws.status) && access.roles.some((r) => (SCORING_ROLES.rate as readonly string[]).includes(r));
  const base = `/api/assessments/${access.assessmentId}`;

  return (
    <>
      <Link href={`/assessments/${access.assessmentId}/scoring`} className="text-brand-navy text-sm font-semibold underline">
        {t("workspace.back")}
      </Link>
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">{t("workspace.aspect", { code: ws.characteristic.aspectCode, name: ws.characteristic.aspectName })}</p>
        <h2 className="text-xl font-bold" data-testid="workspace-title">
          <span className="font-mono">{ws.characteristic.code}</span> {ws.characteristic.name}
          {ws.characteristic.isContextual ? (
            <Badge variant="outline" className="ml-2 align-middle">
              {t("contextual")}
            </Badge>
          ) : null}
        </h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("workspace.statements")}</CardTitle>
          <CardDescription>{t("workspace.statementsIntro")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm" data-testid="workspace-statements">
            {ws.statements.map((s) => (
              <li key={s.level} className="flex gap-3">
                <span className="bg-tint text-brand-navy flex size-7 shrink-0 items-center justify-center rounded-full font-semibold tabular-nums">{s.level}</span>
                <span>{s.textId}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <EvidenceRatingForm
            assessmentId={access.assessmentId}
            code={ws.characteristic.code}
            open={canRate}
            rationaleMin={RATIONALE_MIN_LENGTH}
            initial={{ level: ws.own?.level ?? null, rationale: ws.own?.rationale ?? "", evidenceIds: ws.own?.evidenceIds ?? [], observationIds: ws.own?.observationIds ?? [] }}
            evidence={ws.evidence.map((e) => ({ id: e.id, title: e.title, mimeType: e.mimeType, version: e.version, unitName: e.unitName, requirements: e.requirements, href: `${base}/evidence/${e.id}` }))}
            observations={ws.observations.map((o) => ({
              id: o.id,
              itemLabel: o.itemLabel,
              windowTitle: o.windowTitle,
              unitName: o.unitName,
              capturedAt: formatDateTime(o.capturedAt, tz),
              outsideRadius: o.outsideRadius,
              href: `${base}/observations/${o.id}`,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("workspace.others")}</CardTitle>
        </CardHeader>
        <CardContent data-testid="workspace-others">
          {ws.hiddenCount > 0 ? (
            <Alert variant="info" data-testid="others-hidden">
              {t("workspace.hidden", { count: ws.hiddenCount })}
            </Alert>
          ) : ws.others.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("workspace.noOthers")}</p>
          ) : (
            <ul className="space-y-3">
              {ws.others.map((o, i) => (
                <li key={i} className="border-border rounded-lg border p-3 text-sm" data-testid="other-rating">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{o.assessorName}</span>
                    <Badge variant="secondary" className="tabular-nums">
                      {formatNumber(o.level, 1)}
                    </Badge>
                    <span className="text-muted-foreground text-xs">{t("workspace.savedAt", { time: formatDateTime(o.updatedAt, tz) })}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line">{o.rationale}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
