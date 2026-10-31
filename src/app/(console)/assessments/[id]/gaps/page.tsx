import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLAN_STATUSES, loadActionPlan } from "@/lib/action-plan/service";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { ACTION_PLAN_ROLES } from "@/lib/auth/roles";
import { getAppTimeZone } from "@/lib/env";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { ActionForm, EMPTY_ACTION, GapAnalysisForm, GenerateButton, ProgressForm, PublishButton, VerifyForm } from "./plan-forms";
import { EmptyState } from "@/components/illustration";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("gaps") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });
const STATUS_VARIANT = { PLANNED: "secondary", IN_PROGRESS: "default", DONE: "warning", VERIFIED: "success", CANCELLED: "outline" } as const;

export default async function GapsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, ACTION_PLAN_ROLES.read));
  const t = await getTranslations("gaps");
  const plan = await loadActionPlan(access.assessmentId, access.unitScope);
  const tz = getAppTimeZone();
  const has = (roles: readonly string[]) => access.roles.some((r) => roles.includes(r));
  const open = PLAN_STATUSES.includes(plan.status);
  const can = {
    generate: open && has(ACTION_PLAN_ROLES.generate),
    analyse: open && has(ACTION_PLAN_ROLES.analyse),
    act: open && has(ACTION_PLAN_ROLES.act),
    verify: open && has(ACTION_PLAN_ROLES.verify),
    publish: has(ACTION_PLAN_ROLES.publish) && (plan.status === "ACTION_PLANNING" || plan.status === "REPORTED") && !plan.publishedAt,
  };
  const isUnitScoped = access.unitScope !== null;

  if (!plan.hasFinalResult) return <Alert variant="info">{t("noFinal")}</Alert>;

  return (
    <>
      <p className="text-muted-foreground">{t("intro")}</p>
      <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
        <Link href={`/assessments/${access.assessmentId}/gaps/monitoring`} className="text-brand-navy underline">
          {t("monitoringLink")}
        </Link>
        {plan.gaps.length ? (
          <a href={`/api/assessments/${access.assessmentId}/gaps/export`} className="text-brand-navy underline" data-testid="gaps-export">
            {t("export")}
          </a>
        ) : null}
      </div>
      {plan.publishedAt ? (
        <Alert variant="success" data-testid="plan-published-note">
          {t("published", { time: formatDateTime(plan.publishedAt, tz) })}
        </Alert>
      ) : null}
      {!open ? <Alert variant="info">{t("closed")}</Alert> : null}
      {can.generate ? <GenerateButton assessmentId={access.assessmentId} regenerate={plan.gaps.length > 0} /> : null}
      {plan.gaps.length === 0 ? (
        <EmptyState illustration="empty-action-plan">
          <p>{t("empty")}</p>
        </EmptyState>
      ) : null}

      {plan.gaps.map((g) => (
        <Card key={g.id} data-testid="gap-item" data-code={g.characteristic.code}>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">{t("item.rank", { rank: g.rank })}</Badge>
              {g.isContextual ? <Badge variant="outline">{t("item.contextual")}</Badge> : null}
              {g.priority ? <Badge variant="warning">{t(`priorities.${g.priority}`)}</Badge> : null}
            </div>
            <CardTitle>
              <span className="font-mono">{g.characteristic.code}</span> {g.characteristic.nameId}
            </CardTitle>
            <CardDescription>{t("item.aspect", { code: g.characteristic.aspect.code, name: g.characteristic.aspect.name })}</CardDescription>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">{t("item.current")}</dt>
                <dd className="font-semibold tabular-nums">{formatNumber(g.currentIndex, 2)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("item.target")}</dt>
                <dd className="font-semibold tabular-nums">{formatNumber(g.targetLevel, 0)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("item.gap")}</dt>
                <dd className="font-semibold tabular-nums" data-testid="gap-value">
                  {formatNumber(g.gap, 2)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("item.score")}</dt>
                <dd className="font-semibold tabular-nums">{formatNumber(g.priorityScore, 3)}</dd>
              </div>
            </dl>
          </CardHeader>
          <CardContent className="space-y-4">
            <section className="space-y-2">
              <h3 className="font-semibold">{t("analysis.title")}</h3>
              {can.analyse ? (
                <GapAnalysisForm assessmentId={access.assessmentId} gapId={g.id} initial={{ rootCause: g.rootCause ?? "", priority: g.priority ?? "" }} />
              ) : (
                <p className="text-sm whitespace-pre-line">{g.rootCause || t("analysis.none")}</p>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold">{t("actions.title")}</h3>
              {g.actions.length === 0 ? <p className="text-muted-foreground text-sm">{t("actions.none")}</p> : null}
              {g.actions.map((a) => (
                <div key={a.id} className="border-border space-y-2 rounded-lg border p-3 text-sm" data-testid="action-item" data-status={a.status}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{a.title}</span>
                    <Badge variant={STATUS_VARIANT[a.status]} data-testid="action-status">
                      {t(`statuses.${a.status}`)}
                    </Badge>
                    {a.dueState === "overdue" || a.dueState === "dueSoon" ? <Badge variant={a.dueState === "overdue" ? "destructive" : "warning"}>{t(`due.${a.dueState}`)}</Badge> : null}
                  </div>
                  {a.description ? <p className="whitespace-pre-line">{a.description}</p> : null}
                  <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground inline">{t("fields.ownerName")}: </dt>
                      <dd className="inline">{t("actions.owner", { name: a.ownerName, position: a.ownerPosition })}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground inline">{t("fields.unit")}: </dt>
                      <dd className="inline">{a.unit?.name ?? t("fields.noUnit")}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground inline">{t("fields.dueDate")}: </dt>
                      <dd className="inline">{formatDate(a.dueDate, "UTC")}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground inline">{t("fields.successIndicator")}: </dt>
                      <dd className="inline">{a.successIndicator}</dd>
                    </div>
                  </dl>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{t("fields.progress")}</span>
                    <div className="bg-tint h-2 w-40 overflow-hidden rounded-full" role="progressbar" aria-valuenow={a.progress} aria-valuemin={0} aria-valuemax={100} aria-label={t("fields.progress")}>
                      <div className="bg-brand-navy h-full" style={{ width: `${a.progress}%` }} />
                    </div>
                    <span className="tabular-nums" data-testid="action-progress">
                      {a.progress}%
                    </span>
                  </div>
                  {a.verifiedAt && a.verifiedBy ? <p className="text-success">{t("actions.verifiedBy", { name: a.verifiedBy.name, time: formatDateTime(a.verifiedAt, tz) })}</p> : null}

                  <details className="group">
                    <summary className="text-brand-navy cursor-pointer font-semibold">{t("progress.history")}</summary>
                    <ul className="mt-2 space-y-1" data-testid="action-history">
                      {a.updates.length === 0 ? <li className="text-muted-foreground">{t("progress.noHistory")}</li> : null}
                      {a.updates.map((u) => (
                        <li key={u.id}>
                          <span className="text-muted-foreground">
                            {t("progress.entry", { time: formatDateTime(u.createdAt, tz), name: u.createdBy.name, percent: u.progressPercent, status: u.status ? t(`statuses.${u.status}`) : "" })}
                          </span>
                          <p className="whitespace-pre-line">{u.note}</p>
                        </li>
                      ))}
                    </ul>
                  </details>
                  {can.act && a.status !== "VERIFIED" ? (
                    <details>
                      <summary className="text-brand-navy cursor-pointer font-semibold">{t("progress.title")}</summary>
                      <div className="mt-2">
                        <ProgressForm assessmentId={access.assessmentId} actionId={a.id} current={{ progress: a.progress, status: a.status }} />
                      </div>
                    </details>
                  ) : null}
                  {can.verify && a.status === "DONE" ? (
                    <div className="bg-tint rounded-lg p-3">
                      <h4 className="mb-2 font-semibold">{t("verify.title")}</h4>
                      <VerifyForm assessmentId={access.assessmentId} actionId={a.id} />
                    </div>
                  ) : null}
                  {can.act && a.status !== "VERIFIED" ? (
                    <details>
                      <summary className="text-brand-navy cursor-pointer font-semibold">{t("actions.edit")}</summary>
                      <div className="mt-2">
                        <ActionForm
                          assessmentId={access.assessmentId}
                          target={{ actionId: a.id }}
                          units={plan.units}
                          allowOrganizationLevel={!isUnitScoped}
                          initial={{
                            title: a.title,
                            description: a.description ?? "",
                            ownerName: a.ownerName,
                            ownerPosition: a.ownerPosition,
                            ownerEmail: a.ownerEmail ?? "",
                            unitId: a.unitId ?? "",
                            dueDate: a.dueDate.toISOString().slice(0, 10),
                            successIndicator: a.successIndicator,
                          }}
                        />
                      </div>
                    </details>
                  ) : null}
                </div>
              ))}
              {can.act ? (
                <details data-testid="add-action">
                  <summary className="text-brand-navy cursor-pointer text-sm font-semibold">{t("actions.add")}</summary>
                  <div className="mt-2">
                    <ActionForm assessmentId={access.assessmentId} target={{ gapId: g.id }} units={plan.units} allowOrganizationLevel={!isUnitScoped} initial={EMPTY_ACTION} />
                  </div>
                </details>
              ) : null}
            </section>
          </CardContent>
        </Card>
      ))}

      {can.publish && plan.gaps.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("publish")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PublishButton assessmentId={access.assessmentId} />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
