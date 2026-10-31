import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { getAppTimeZone } from "@/lib/env";
import { listEvidence, loadEvidenceChecklist } from "@/lib/evidence/service";
import { formatDateTime, formatNumber } from "@/lib/format";
import { EvidenceItemActions, EvidenceUploadForm } from "./evidence-forms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("evidence") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });
const UPLOAD_STATUSES = ["LOCKED", "DATA_COLLECTION", "SCORING", "PANEL_REVIEW"];

export default async function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, rolesFor("evidenceAndObservations", "read")));
  const t = await getTranslations("evidence");
  const db = getDb();
  const assessment = await db.assessment.findUniqueOrThrow({ where: { id: access.assessmentId, organizationId: access.organizationId }, select: { status: true, instrumentVersionId: true } });
  const [units, characteristics, items, checklist] = await Promise.all([
    db.unit.findMany({
      where: { assessmentId: access.assessmentId, ...(access.unitScope ? { id: { in: access.unitScope } } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.characteristic.findMany({
      where: { instrumentVersionId: assessment.instrumentVersionId },
      orderBy: { order: "asc" },
      select: { id: true, code: true, nameId: true, evidenceRequirements: { orderBy: { order: "asc" }, select: { id: true, description: true } } },
    }),
    listEvidence(access.assessmentId, access.unitScope),
    loadEvidenceChecklist(access.assessmentId, access.unitScope),
  ]);
  const options = characteristics.map((c) => ({ id: c.id, code: c.code, name: c.nameId, requirements: c.evidenceRequirements }));
  const canWrite = UPLOAD_STATUSES.includes(assessment.status) && access.roles.some((r) => (rolesFor("evidenceAndObservations", "write") as readonly string[]).includes(r));
  const below = checklist.rows.filter((r) => r.belowMinimum).length;
  const tz = getAppTimeZone();

  return (
    <>
      <p className="text-muted-foreground">{t("intro")}</p>
      {!UPLOAD_STATUSES.includes(assessment.status) ? <Alert variant="info">{t("closed")}</Alert> : null}

      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("upload.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <EvidenceUploadForm assessmentId={access.assessmentId} units={units} allowOrganizationWide={access.unitScope === null} characteristics={options} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("checklist.title")}</CardTitle>
          <CardDescription>{t("checklist.intro", { min: checklist.minTypes })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert variant={below > 0 ? "warning" : "success"} data-testid="evidence-below-count" data-count={below}>
            {below > 0 ? t("checklist.belowSummary", { count: below, min: checklist.minTypes }) : t("checklist.ok")}
          </Alert>
          {checklist.rows.map((row) => (
            <details key={row.characteristicId} className="border-border rounded-lg border" data-testid="evidence-checklist-row" data-code={row.code} data-below={row.belowMinimum}>
              <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="font-mono font-semibold">{row.code}</span>
                <span className="flex-1">{row.name}</span>
                <span className="text-muted-foreground">{t("checklist.types", { count: row.types })}</span>
                <span className="text-muted-foreground">{t("checklist.evidenceCount", { count: row.evidenceCount })}</span>
                {row.belowMinimum ? <Badge variant="warning">{t("checklist.below", { min: checklist.minTypes })}</Badge> : <Badge variant="success">{t("checklist.ok")}</Badge>}
              </summary>
              <ul className="border-border space-y-1 border-t px-4 py-3 text-sm">
                {row.requirements.map((r) => (
                  <li key={r.id} className="flex items-start gap-2">
                    <Badge variant={r.met ? "success" : "outline"}>{r.met ? t("checklist.met") : t("checklist.notMet")}</Badge>
                    <span>{r.description}</span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("list.title")}</CardTitle>
          <CardDescription>{formatNumber(items.length)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.length === 0 ? <p className="text-muted-foreground">{t("list.empty")}</p> : null}
          {items.map((item) => (
            // Kunci memakai versi pertama agar kartu tidak dipasang ulang saat versi baru tersimpan, sehingga pesan
            // "Bukti tersimpan" tetap terlihat setelah halaman disegarkan.
            <article key={item.previousVersions.at(-1)?.id ?? item.id} className="border-border space-y-2 rounded-lg border p-4" data-testid="evidence-item" data-title={item.title}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{item.title}</h3>
                <Badge variant="secondary">{t("list.version", { version: item.version })}</Badge>
                {item.unitName ? <Badge variant="outline">{item.unitName}</Badge> : null}
              </div>
              {item.description ? <p className="text-sm">{item.description}</p> : null}
              <p className="text-muted-foreground text-sm">
                {t("list.uploadedBy", { name: item.uploadedByName, date: formatDateTime(item.createdAt, tz) })} · {t("list.size", { size: formatNumber(item.sizeBytes / 1024, 1) })} · {item.mimeType}
              </p>
              <p className="text-muted-foreground font-mono text-xs break-all">
                {t("list.hash")} {item.sha256}
              </p>
              <p className="text-sm" data-testid="evidence-codes">
                {item.characteristicCodes.length ? item.characteristicCodes.join(", ") : t("list.noMapping")}
              </p>
              {item.previousVersions.length ? (
                <details className="text-sm">
                  <summary className="cursor-pointer">{t("list.previous")}</summary>
                  <ul className="mt-1 space-y-1">
                    {item.previousVersions.map((v) => (
                      <li key={v.id}>
                        <a className="text-brand-navy underline" href={`/api/assessments/${access.assessmentId}/evidence/${v.id}`}>
                          {t("list.version", { version: v.version })}
                        </a>{" "}
                        <span className="text-muted-foreground">{formatDateTime(v.createdAt, tz)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <EvidenceItemActions
                assessmentId={access.assessmentId}
                evidence={{ id: item.id, title: item.title, links: item.links.map((l) => ({ characteristicId: l.characteristicId, requirementIds: l.requirementIds })) }}
                characteristics={options}
                units={units}
                canWrite={canWrite}
              />
            </article>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
