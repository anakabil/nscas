import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { loadAuditTrail } from "@/lib/audit-trail/service";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { AUDIT_ROLES } from "@/lib/auth/roles";
import { getAppTimeZone } from "@/lib/env";
import { formatDateTime, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("audit") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

function summarize(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = JSON.stringify(value);
  return text.length > 240 ? `${text.slice(0, 240)}…` : text;
}

// Jejak audit asesmen (docs/04 bagian 6). Administrator klien melihat ringkasan tanpa isi perubahan.
export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, AUDIT_ROLES.read));
  const t = await getTranslations("auditTrail");
  const tRoles = await getTranslations("roles");
  const trail = await loadAuditTrail(access);
  const canExport = access.roles.some((r) => (AUDIT_ROLES.export as readonly string[]).includes(r));
  const tz = getAppTimeZone();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-muted-foreground max-w-3xl">{t("intro")}</p>
        {canExport ? (
          <a href={`/api/assessments/${access.assessmentId}/audit/export`} className="bg-brand-navy rounded-md px-4 py-2 text-sm font-semibold text-white" data-testid="audit-export">
            {t("export")}
          </a>
        ) : null}
      </div>
      <Card>
        <CardContent className="space-y-3 pt-6">
          {trail.entries.length === 0 ? <p className="text-muted-foreground">{t("none")}</p> : null}
          {trail.entries.length > 0 ? (
            <p className="text-muted-foreground text-sm" data-testid="audit-count">
              {t("showing", { count: formatNumber(trail.entries.length), total: formatNumber(trail.total) })}
            </p>
          ) : null}
          {trail.entries.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>{t("columns.at")}</TableHeaderCell>
                    <TableHeaderCell>{t("columns.action")}</TableHeaderCell>
                    <TableHeaderCell>{t("columns.entity")}</TableHeaderCell>
                    <TableHeaderCell>{t("columns.actor")}</TableHeaderCell>
                    <TableHeaderCell>{t("columns.role")}</TableHeaderCell>
                    {trail.full ? <TableHeaderCell>{t("columns.change")}</TableHeaderCell> : null}
                  </TableRow>
                </TableHead>
                <tbody>
                  {trail.entries.map((e) => (
                    <TableRow key={e.id} data-testid="audit-entry" data-action={e.action}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(e.at, tz)}</TableCell>
                      <TableCell>
                        <span className="block">{t.has(`actions.${e.action}`) ? t(`actions.${e.action}`) : e.action}</span>
                        {trail.full ? <span className="text-muted-foreground block font-mono text-xs">{e.action}</span> : null}
                      </TableCell>
                      <TableCell>{t.has(`entities.${e.entityType}`) ? t(`entities.${e.entityType}`) : e.entityType}</TableCell>
                      <TableCell>{e.actorName ?? t("system")}</TableCell>
                      <TableCell>{e.actorRole ? tRoles(e.actorRole) : ""}</TableCell>
                      {trail.full ? (
                        <TableCell className="max-w-md font-mono text-xs break-all" data-testid="audit-change">
                          {summarize(e.detail?.after ?? e.detail?.before)}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
