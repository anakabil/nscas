import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { ConfigurationNotice } from "@/components/assessment/locked-notice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldHint } from "@/components/ui/label";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { loadEffectiveParameters } from "@/lib/assessments/load";
import { aspectWeights, editablePart } from "@/lib/assessments/parameters";
import { requireConfigurationPage } from "@/lib/assessments/page-access";
import { formatNumber } from "@/lib/format";
import { ParametersForm } from "./parameters-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("parameters") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export default async function ParametersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const page = await requireConfigurationPage(id);
  const t = await getTranslations("assessment.parameters");
  const effective = await loadEffectiveParameters(page.access.assessmentId);

  return (
    <>
      <p className="text-muted-foreground">{t("intro")}</p>
      <ConfigurationNotice lockedAt={page.lockedAt} canWrite={page.canWrite} />
      <ParametersForm
        assessmentId={page.access.assessmentId}
        parameters={editablePart(effective.parameters)}
        consentTextId={effective.consentTextId}
        consentTextEn={effective.consentTextEn}
        dpaSigned={effective.dpaSigned}
        editable={page.editable}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t("aspectWeights")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FieldHint>{t("aspectWeightsHint")}</FieldHint>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t("aspect")}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t("weight")}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {aspectWeights(effective.parameters).map((a) => (
                <TableRow key={a.code}>
                  <TableCell>
                    <span className="font-mono">{a.code}</span> {a.name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(a.weight * 100, 2)}%</TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
