import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { guardPage, requireUser } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { CreateOrganizationForm } from "./forms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orgs");
  return { title: t("title") };
}

export default async function OrganizationsPage() {
  const session = await guardPage(() => requireUser());
  const t = await getTranslations("orgs");
  const { principal } = session;

  // docs/04 bagian 2: SUPER_ADMIN (ubah) dan LEAD_ASSESSOR (baca) melihat semua organisasi;
  // CLIENT_ADMIN hanya organisasinya.
  const global = principal.isSuperAdmin || principal.memberships.some((m) => m.organizationIsOperator && m.role === "LEAD_ASSESSOR");
  const clientAdminOrgs = principal.memberships.filter((m) => m.role === "CLIENT_ADMIN").map((m) => m.organizationId);
  if (!global && clientAdminOrgs.length === 0) redirect("/forbidden");

  const organizations = await getDb().organization.findMany({
    where: global ? {} : { id: { in: clientAdminOrgs } },
    select: { id: true, name: true, legalName: true, isOperator: true, _count: { select: { memberships: true } } },
    orderBy: [{ isOperator: "desc" }, { name: "asc" }],
  });

  return (
    <>
      <h1 className="text-brand-navy text-2xl font-bold">{t("title")}</h1>
      {!principal.isSuperAdmin && !clientAdminOrgs.length ? <p className="text-muted-foreground">{t("readOnly")}</p> : null}
      {organizations.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{t("name")}</TableHeaderCell>
              <TableHeaderCell>{t("legalName")}</TableHeaderCell>
              <TableHeaderCell>{t("kind")}</TableHeaderCell>
              <TableHeaderCell className="text-right">{t("members")}</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHead>
          <tbody>
            {organizations.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-semibold">{o.name}</TableCell>
                <TableCell>{o.legalName}</TableCell>
                <TableCell>
                  <Badge variant={o.isOperator ? "default" : "secondary"}>{o.isOperator ? t("operator") : t("client")}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{o._count.memberships}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/orgs/${o.id}`} className="text-brand-navy font-semibold hover:underline">
                    {t("open")}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      )}
      {principal.isSuperAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("createTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateOrganizationForm />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
