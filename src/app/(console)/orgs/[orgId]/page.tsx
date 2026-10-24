import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { guardPage, requireOrganizationRole } from "@/lib/auth/guard";
import { grantableRoles, rolesFor } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { AddUserForm } from "../forms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orgs");
  return { title: t("title") };
}

const paramsSchema = z.object({ orgId: z.string().min(1).max(64) });

export default async function OrganizationUsersPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireOrganizationRole(orgId, rolesFor("organizationsAndUsers", "read")));
  const t = await getTranslations();
  const db = getDb();

  const organization = await db.organization.findUniqueOrThrow({ where: { id: access.organizationId }, select: { name: true } });
  const members = await db.user.findMany({
    where: { memberships: { some: { organizationId: access.organizationId } } },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      totpEnabled: true,
      lockedUntil: true,
      memberships: { where: { organizationId: access.organizationId }, select: { role: true } },
    },
    orderBy: { name: "asc" },
  });

  const canWrite = access.roles.some((r) => rolesFor("organizationsAndUsers", "write").includes(r));
  const grantable = canWrite
    ? grantableRoles(
        { isSuperAdmin: access.session.principal.isSuperAdmin, isClientAdminOfTarget: access.roles.includes("CLIENT_ADMIN") },
        access.isOperator,
      )
    : [];
  const units = grantable.includes("UNIT_COORDINATOR")
    ? await db.unit.findMany({
        where: { assessment: { organizationId: access.organizationId } },
        select: { id: true, name: true, assessment: { select: { name: true } } },
        orderBy: [{ assessment: { name: "asc" } }, { name: "asc" }],
      })
    : [];
  const now = new Date();

  return (
    <>
      <Link href="/orgs" className="text-brand-navy text-sm font-semibold hover:underline">
        {t("users.back")}
      </Link>
      <h1 className="text-brand-navy text-2xl font-bold">{t("users.title", { organization: organization.name })}</h1>
      {members.length === 0 ? (
        <p className="text-muted-foreground">{t("users.empty")}</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{t("users.name")}</TableHeaderCell>
              <TableHeaderCell>{t("users.email")}</TableHeaderCell>
              <TableHeaderCell>{t("users.roles")}</TableHeaderCell>
              <TableHeaderCell>{t("users.status")}</TableHeaderCell>
              <TableHeaderCell>{t("users.twoStep")}</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHead>
          <tbody>
            {members.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-semibold">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.memberships.map((m) => t(`roles.${m.role}`)).join(", ")}</TableCell>
                <TableCell className="space-x-1">
                  <Badge variant={u.isActive ? "success" : "outline"}>{u.isActive ? t("users.active") : t("users.inactive")}</Badge>
                  {u.lockedUntil && u.lockedUntil > now ? <Badge variant="warning">{t("users.locked")}</Badge> : null}
                </TableCell>
                <TableCell>{u.totpEnabled ? t("users.twoStepOn") : t("users.twoStepOff")}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/orgs/${access.organizationId}/users/${u.id}`} className="text-brand-navy font-semibold hover:underline">
                    {t("users.manage")}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      )}
      {grantable.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("users.addTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AddUserForm
              organizationId={access.organizationId}
              roles={grantable.map((r) => ({ value: r, label: t(`roles.${r}`) }))}
              units={units.map((u) => ({ id: u.id, label: `${u.name}, ${u.assessment.name}` }))}
            />
          </CardContent>
        </Card>
      ) : (
        <p className="text-muted-foreground text-sm">{t("users.readOnly")}</p>
      )}
    </>
  );
}
