import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { areUnitsEditable } from "@/lib/assessments/state-machine";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { ASSESSMENT_TEAM_ROLES } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { AddAssignmentForm, RemoveAssignmentButton } from "./team-forms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("team") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, ASSESSMENT_TEAM_ROLES.read));
  const t = await getTranslations();
  const db = getDb();

  const [assessment, assignments] = await Promise.all([
    db.assessment.findUniqueOrThrow({ where: { id: access.assessmentId }, select: { status: true } }),
    db.assessmentAssignment.findMany({
      where: { assessmentId: access.assessmentId },
      select: { id: true, role: true, user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
    }),
  ]);
  const canWrite = access.roles.some((r) => (ASSESSMENT_TEAM_ROLES.write as readonly string[]).includes(r)) && areUnitsEditable(assessment.status);
  const staff = canWrite
    ? await db.user.findMany({
        where: {
          isActive: true,
          id: { notIn: assignments.map((a) => a.user.id) },
          memberships: { some: { role: { in: ["LEAD_ASSESSOR", "ASSESSOR"] }, organization: { isOperator: true } } },
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <>
      <p className="text-muted-foreground">{t("assessment.team.intro")}</p>
      {assignments.length === 0 ? (
        <p className="text-muted-foreground">{t("assessment.team.empty")}</p>
      ) : (
        <Table data-testid="team-table">
          <TableHead>
            <TableRow>
              <TableHeaderCell>{t("assessment.team.name")}</TableHeaderCell>
              <TableHeaderCell>{t("assessment.team.email")}</TableHeaderCell>
              <TableHeaderCell>{t("assessment.team.role")}</TableHeaderCell>
              {canWrite ? <TableHeaderCell /> : null}
            </TableRow>
          </TableHead>
          <tbody>
            {assignments.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-semibold">{a.user.name}</TableCell>
                <TableCell>{a.user.email}</TableCell>
                <TableCell>{t(`roles.${a.role}`)}</TableCell>
                {canWrite ? (
                  <TableCell className="text-right">
                    <RemoveAssignmentButton assessmentId={access.assessmentId} assignmentId={a.id} />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </tbody>
        </Table>
      )}
      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("assessment.team.addTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AddAssignmentForm assessmentId={access.assessmentId} staff={staff.map((s) => ({ id: s.id, label: `${s.name} (${s.email})` }))} />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
