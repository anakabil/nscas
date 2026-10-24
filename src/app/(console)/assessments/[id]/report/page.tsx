import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableCell, TableRow } from "@/components/ui/table";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { REPORT_ROLES } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { getAppTimeZone } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { REPORT_STATUSES, listReports } from "@/lib/report/service";
import { CreateVersionButton, FinalizeForm } from "./report-forms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("report") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, REPORT_ROLES.read));
  const t = await getTranslations("report");
  const tCommon = await getTranslations("common");
  const has = (roles: readonly string[]) => access.roles.some((r) => roles.includes(r));
  const drafts = has(REPORT_ROLES.drafts);
  const [assessment, finalRun, versions] = await Promise.all([
    getDb().assessment.findUniqueOrThrow({ where: { id: access.assessmentId, organizationId: access.organizationId }, select: { status: true } }),
    getDb().scoreRun.count({ where: { assessmentId: access.assessmentId, isFinal: true } }),
    listReports(access.assessmentId, drafts),
  ]);
  const canWrite = has(REPORT_ROLES.write) && REPORT_STATUSES.includes(assessment.status) && finalRun > 0;
  const tz = getAppTimeZone();
  const base = `/api/assessments/${access.assessmentId}/reports`;

  return (
    <>
      <p className="text-muted-foreground">{t("intro")}</p>
      <div className="border-brand-navy bg-tint rounded-xl border px-4 py-3 text-sm" data-testid="standing-statement">
        {tCommon("resultDisclaimer")}
      </div>
      {finalRun === 0 ? <Alert variant="info">{t("noFinal")}</Alert> : null}
      {canWrite ? <CreateVersionButton assessmentId={access.assessmentId} /> : null}
      {!drafts ? <p className="text-muted-foreground text-sm">{t("draftsHidden")}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("versions")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {versions.length === 0 ? <p className="text-muted-foreground">{t("none")}</p> : null}
          {versions.map((v) => (
            <section key={v.version} className="border-border space-y-3 rounded-lg border p-4" data-testid="report-version" data-version={v.version} data-status={v.status}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{t("version", { version: v.version })}</h3>
                <Badge variant={v.status === "FINAL" ? "success" : "warning"}>{t(`statuses.${v.status}`)}</Badge>
                <span className="text-muted-foreground text-sm">{t("createdBy", { time: formatDateTime(v.createdAt, tz), name: v.createdByName })}</span>
              </div>
              {v.status === "FINAL" && v.signedAt ? (
                <p className="text-success text-sm font-semibold" data-testid="report-signed">
                  {t("signed", { name: v.signerName ?? "", position: v.signerPosition ?? "", time: formatDateTime(v.signedAt, tz) })}
                </p>
              ) : null}
              <Table>
                <tbody>
                  {v.documents.map((d) => (
                    <TableRow key={d.id} data-testid="report-document" data-kind={d.kind} data-pdf={d.pdfStatus}>
                      <TableCell className="font-semibold">{t(`kinds.${d.kind}`)}</TableCell>
                      <TableCell>
                        <a href={`${base}/${d.id}/html`} target="_blank" rel="noopener" className="text-brand-navy underline" data-testid="report-preview">
                          {t("preview")}
                        </a>
                      </TableCell>
                      <TableCell>
                        {d.pdfStatus === "READY" ? (
                          <a href={`${base}/${d.id}/pdf`} className="text-brand-navy underline" data-testid="report-pdf">
                            {t("pdf")}
                          </a>
                        ) : (
                          <span className={d.pdfStatus === "FAILED" ? "text-danger" : "text-muted-foreground"}>{d.pdfStatus === "FAILED" ? t("pdfFailed") : t("pdfPending")}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
              {canWrite && v.status === "DRAFT" ? (
                <div className="bg-tint rounded-lg p-3">
                  <h4 className="mb-2 font-semibold">{t("finalize.title")}</h4>
                  <FinalizeForm assessmentId={access.assessmentId} version={v.version} />
                </div>
              ) : null}
            </section>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
