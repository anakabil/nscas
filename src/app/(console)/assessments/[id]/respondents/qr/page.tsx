import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { getAppTimeZone } from "@/lib/env";
import { formatDateTime, formatNumber } from "@/lib/format";
import { CreateQrForm, DeactivateQrButton } from "./qr-forms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("qr") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

/** Kode QR unit: dibaca asesor utama dan administrator klien, dibuat dan dinonaktifkan administrator klien. */
const QR_READ_ROLES = ["LEAD_ASSESSOR", "CLIENT_ADMIN"] as const;

export default async function QrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, QR_READ_ROLES));
  const t = await getTranslations("respondents.qr");
  const db = getDb();
  const assessment = await db.assessment.findUniqueOrThrow({
    where: { id: access.assessmentId, organizationId: access.organizationId },
    select: { status: true, surveyClosesAt: true, organization: { select: { name: true } } },
  });
  const [units, codes] = await Promise.all([
    db.unit.findMany({ where: { assessmentId: access.assessmentId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.unitQrCode.findMany({
      where: { assessmentId: access.assessmentId, isActive: true },
      select: { id: true, createdAt: true, maxIssuance: true, unit: { select: { name: true } }, _count: { select: { accessTokens: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const open = assessment.status === "LOCKED" || assessment.status === "DATA_COLLECTION";
  const canWrite = open && access.roles.some((r) => (rolesFor("tokensAndParticipation", "write") as readonly string[]).includes(r));
  const tz = getAppTimeZone();

  return (
    <>
      <p className="text-muted-foreground">{t("intro")}</p>
      <Alert variant="info">{t("openNote")}</Alert>
      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("create")}</CardTitle>
            <CardDescription>{t("rotateNote")}</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateQrForm
              assessmentId={access.assessmentId}
              units={units}
              organizationName={assessment.organization.name}
              closesAt={assessment.surveyClosesAt ? formatDateTime(assessment.surveyClosesAt, tz) : null}
            />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{t("activeTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <p className="text-muted-foreground">{t("none")}</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t("unit")}</TableHeaderCell>
                  <TableHeaderCell>{t("created")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("issued")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("limit")}</TableHeaderCell>
                  {canWrite ? <TableHeaderCell /> : null}
                </TableRow>
              </TableHead>
              <tbody>
                {codes.map((c) => (
                  <TableRow key={c.id} data-testid="qr-row">
                    <TableCell>{c.unit.name}</TableCell>
                    <TableCell>{formatDateTime(c.createdAt, tz)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(c._count.accessTokens)}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.maxIssuance === null ? t("noLimit") : formatNumber(c.maxIssuance)}</TableCell>
                    {canWrite ? (
                      <TableCell className="text-right">
                        <DeactivateQrButton assessmentId={access.assessmentId} qrId={c.id} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
