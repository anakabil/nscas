import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { loadEffectiveParameters } from "@/lib/assessments/load";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { VALIDATION_ROLES } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { getAppTimeZone } from "@/lib/env";
import { formatDateTime, formatNumber } from "@/lib/format";
import { listSessions, loadProposal } from "@/lib/validation/service";
import { CreateFromProposalButton, SessionForm } from "./validation-forms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("validation") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });
const SCHEDULE_STATUSES = ["LOCKED", "DATA_COLLECTION", "SCORING"];

export default async function ValidationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, VALIDATION_ROLES.read));
  const t = await getTranslations("validation");
  const db = getDb();
  const [assessment, units, strata, sessions, proposal, effective] = await Promise.all([
    db.assessment.findUniqueOrThrow({ where: { id: access.assessmentId, organizationId: access.organizationId }, select: { status: true } }),
    db.unit.findMany({ where: { assessmentId: access.assessmentId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.stratum.findMany({ where: { assessmentId: access.assessmentId }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    listSessions(access.assessmentId),
    loadProposal(access.assessmentId),
    loadEffectiveParameters(access.assessmentId),
  ]);
  const canSchedule = SCHEDULE_STATUSES.includes(assessment.status) && access.roles.some((r) => (VALIDATION_ROLES.schedule as readonly string[]).includes(r));
  const maxPerSession = effective.parameters.sampling?.fgdMaxParticipantsPerSession ?? 8;
  const tz = getAppTimeZone();

  return (
    <>
      <p className="text-muted-foreground">{t("intro")}</p>
      <Link href={`/assessments/${access.assessmentId}/validation/guides`} className="text-brand-navy text-sm font-semibold underline">
        {t("guides.link")}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{t("proposal.title")}</CardTitle>
          <CardDescription>{t("proposal.intro", { max: maxPerSession })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!proposal.available ? (
            <Alert variant="info">{t("proposal.missing")}</Alert>
          ) : (
            <>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>{t("proposal.stratum")}</TableHeaderCell>
                    <TableHeaderCell className="text-right">{t("proposal.interviews")}</TableHeaderCell>
                    <TableHeaderCell className="text-right">{t("proposal.fgParticipants")}</TableHeaderCell>
                    <TableHeaderCell className="text-right">{t("proposal.fgSessions")}</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <tbody>
                  {strata.map((s) => {
                    const interviews = proposal.interviews.find((i) => i.stratumId === s.id)?.count ?? 0;
                    const fg = proposal.focusGroups.find((g) => g.stratumId === s.id);
                    return (
                      <TableRow key={s.id} data-testid="proposal-row" data-code={s.code}>
                        <TableCell>
                          <span className="font-mono">{s.code}</span> {s.name}
                        </TableCell>
                        <TableCell className="text-right tabular-nums" data-testid="proposal-interviews">
                          {formatNumber(interviews)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(fg?.participants ?? 0)}</TableCell>
                        <TableCell className="text-right tabular-nums" data-testid="proposal-fg-sessions">
                          {formatNumber(fg?.sessions ?? 0)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </tbody>
              </Table>
              <p className="text-sm">{t("proposal.virtual", { count: proposal.virtualVisits })}</p>
              <p className="text-sm font-semibold" data-testid="proposal-total" data-count={proposal.sessions.length}>
                {t("proposal.total", { count: proposal.sessions.length })}
              </p>
              {proposal.unallocated.interviews + proposal.unallocated.focusGroupParticipants > 0 ? (
                <Alert variant="warning">{t("proposal.unallocated", { interviews: proposal.unallocated.interviews, participants: proposal.unallocated.focusGroupParticipants })}</Alert>
              ) : null}
              {canSchedule ? <CreateFromProposalButton assessmentId={access.assessmentId} exists={sessions.length > 0} /> : sessions.length > 0 ? <p className="text-muted-foreground text-sm">{t("proposal.exists")}</p> : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("list.title")}</CardTitle>
          <CardDescription>{formatNumber(sessions.length)}</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground">{t("list.empty")}</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t("fields.label")}</TableHeaderCell>
                  <TableHeaderCell>{t("fields.type")}</TableHeaderCell>
                  <TableHeaderCell>{t("fields.scheduledAt")}</TableHeaderCell>
                  <TableHeaderCell>{t("fields.status")}</TableHeaderCell>
                  <TableHeaderCell />
                </TableRow>
              </TableHead>
              <tbody>
                {sessions.map((s) => (
                  <TableRow key={s.id} data-testid="session-row" data-type={s.type}>
                    <TableCell>
                      <Link href={`/assessments/${access.assessmentId}/validation/${s.id}`} className="text-brand-navy font-semibold underline">
                        {s.label}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {[s.stratum ? `${s.stratum.code} ${s.stratum.name}` : null, s.unit?.name, s.participantCount ? `${t("fields.participantCount")} ${s.participantCount}` : null].filter(Boolean).join(" · ")}
                      </p>
                    </TableCell>
                    <TableCell>{t(`types.${s.type}`)}</TableCell>
                    <TableCell>{s.scheduledAt ? formatDateTime(s.scheduledAt, tz) : <span className="text-muted-foreground">{t("list.notScheduled")}</span>}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "COMPLETED" ? "success" : s.status === "CANCELLED" ? "destructive" : "secondary"}>{t(`statuses.${s.status}`)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.meetingUrl ? (
                        <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-brand-navy underline">
                          {t("list.join")}
                        </a>
                      ) : null}
                      <p>{t("list.participants", { count: s._count.participants })}</p>
                      <p>{t("list.ratings", { count: s._count.ratings })}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canSchedule ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("create.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <SessionForm
              assessmentId={access.assessmentId}
              units={units}
              strata={strata}
              values={{ type: "INTERVIEW", label: "", unitId: "", stratumId: "", scheduledAt: "", meetingUrl: "", participantCount: "", guideLayer: "MANAGEMENT", status: "SCHEDULED" }}
            />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
