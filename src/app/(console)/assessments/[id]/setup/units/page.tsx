import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { ConfigurationNotice } from "@/components/assessment/locked-notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireConfigurationPage } from "@/lib/assessments/page-access";
import { areUnitsEditable } from "@/lib/assessments/state-machine";
import { flattenUnitTree } from "@/lib/assessments/unit-tree";
import { getDb } from "@/lib/db";
import { formatNumber } from "@/lib/format";
import { CreateUnitForm, EditUnitForm } from "./unit-forms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("units") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export default async function UnitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const page = await requireConfigurationPage(id);
  const t = await getTranslations("assessment");
  const units = await getDb().unit.findMany({
    where: { assessmentId: page.access.assessmentId },
    select: { id: true, name: true, type: true, parentId: true, latitude: true, longitude: true, radiusMeters: true },
  });
  const tree = flattenUnitTree(units);
  const parents = tree.map((u) => ({ id: u.id, label: `${"  ".repeat(u.depth)}${u.name}` }));
  // Unit tetap dapat dilengkapi setelah dikunci (misalnya koordinat proyek), sampai asesmen diarsipkan.
  const editable = page.canWrite && areUnitsEditable(page.status);
  const projects = units.filter((u) => u.type === "PROJECT").length;

  return (
    <>
      <p className="text-muted-foreground">{t("units.intro")}</p>
      {!page.canWrite ? <ConfigurationNotice lockedAt={null} canWrite={false} /> : null}
      <p className="text-sm font-semibold" data-testid="unit-summary">
        {t("units.summary", { count: formatNumber(units.length), projects: formatNumber(projects) })}
      </p>
      {tree.length === 0 ? <p className="text-muted-foreground">{t("units.empty")}</p> : null}
      <ul className="space-y-2" data-testid="unit-tree">
        {tree.map((u) => (
          <li key={u.id} style={{ marginLeft: `${u.depth * 1.5}rem` }}>
            <details className="border-border bg-card rounded-xl border">
              <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3">
                <span className="font-semibold">{u.name}</span>
                <Badge variant="secondary">{t(`units.types.${u.type}`)}</Badge>
                {u.type === "PROJECT" && u.latitude === null ? <Badge variant="warning">{t("units.coordinatesMissing")}</Badge> : null}
                {u.type === "PROJECT" && u.latitude !== null && u.longitude !== null ? (
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {formatNumber(u.latitude, 4)}, {formatNumber(u.longitude, 4)}, {formatNumber(u.radiusMeters ?? 0)} m
                  </span>
                ) : null}
              </summary>
              {editable ? (
                <div className="border-border border-t px-4 py-4">
                  <EditUnitForm assessmentId={page.access.assessmentId} unit={u} parents={parents} />
                </div>
              ) : null}
            </details>
          </li>
        ))}
      </ul>
      {editable ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("units.addTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateUnitForm assessmentId={page.access.assessmentId} parents={parents} />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
