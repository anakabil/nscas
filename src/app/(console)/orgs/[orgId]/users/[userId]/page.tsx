import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldHint } from "@/components/ui/label";
import { guardPage, requireOrganizationRole } from "@/lib/auth/guard";
import { grantableRoles, rolesFor } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { getAppTimeZone } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { ManageUserButton } from "../../../forms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("users.detail");
  return { title: t("title") };
}

const paramsSchema = z.object({ orgId: z.string().min(1).max(64), userId: z.string().min(1).max(64) });

export default async function UserDetailPage({ params }: { params: Promise<{ orgId: string; userId: string }> }) {
  const { orgId, userId } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireOrganizationRole(orgId, rolesFor("organizationsAndUsers", "read")));
  const t = await getTranslations();
  const tz = getAppTimeZone();

  const user = await getDb().user.findFirst({
    where: { id: userId, memberships: { some: { organizationId: access.organizationId } } },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      totpEnabled: true,
      lockedUntil: true,
      mustChangePassword: true,
      lastLoginAt: true,
      memberships: { select: { id: true, role: true, organizationId: true, organization: { select: { name: true } } } },
    },
  });
  if (!user) notFound();

  const isSelf = user.id === access.session.user.id;
  const canWrite = access.roles.some((r) => rolesFor("organizationsAndUsers", "write").includes(r));
  // CLIENT_ADMIN tidak mengelola akun yang juga terdaftar di organisasi lain (ditegakkan juga di server).
  const manageable =
    canWrite && !isSelf && (access.session.principal.isSuperAdmin || user.memberships.every((m) => m.organizationId === access.organizationId));
  const grantable = grantableRoles(
    { isSuperAdmin: access.session.principal.isSuperAdmin, isClientAdminOfTarget: access.roles.includes("CLIENT_ADMIN") },
    access.isOperator,
  );
  const locked = user.lockedUntil !== null && user.lockedUntil > new Date();
  const base = { organizationId: access.organizationId, userId: user.id };

  return (
    <>
      <Link href={`/orgs/${access.organizationId}`} className="text-brand-navy text-sm font-semibold hover:underline">
        {t("users.back")}
      </Link>
      <header className="space-y-1">
        <h1 className="text-brand-navy text-2xl font-bold">{user.name}</h1>
        <p className="text-muted-foreground">{user.email}</p>
      </header>

      <Card>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-[14rem_1fr]">
            <dt className="text-muted-foreground text-sm">{t("users.status")}</dt>
            <dd className="flex flex-wrap gap-2">
              <Badge variant={user.isActive ? "success" : "outline"}>{user.isActive ? t("users.active") : t("users.inactive")}</Badge>
              {locked && user.lockedUntil ? (
                <Badge variant="warning">{t("users.detail.lockedUntil", { time: formatDateTime(user.lockedUntil, tz) })}</Badge>
              ) : null}
              {user.mustChangePassword ? <Badge variant="outline">{t("users.detail.mustChangePassword")}</Badge> : null}
            </dd>
            <dt className="text-muted-foreground text-sm">{t("users.twoStep")}</dt>
            <dd>{user.totpEnabled ? t("users.twoStepOn") : t("users.twoStepOff")}</dd>
            <dt className="text-muted-foreground text-sm">{t("users.detail.lastLogin")}</dt>
            <dd>{user.lastLoginAt ? formatDateTime(user.lastLoginAt, tz) : t("users.detail.never")}</dd>
            <dt className="text-muted-foreground text-sm">{t("users.roles")}</dt>
            <dd className="space-y-3">
              {user.memberships.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-3">
                  <Badge variant="secondary">
                    {t(`roles.${m.role}`)}, {m.organization.name}
                  </Badge>
                  {manageable && m.organizationId === access.organizationId && grantable.includes(m.role) && user.memberships.length > 1 ? (
                    <ManageUserButton {...base} intent="revokeRole" membershipId={m.id} label={t("users.detail.revokeRole")} />
                  ) : null}
                </div>
              ))}
            </dd>
          </dl>
        </CardContent>
      </Card>

      {manageable ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("users.detail.actions")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            {locked ? <ManageUserButton {...base} intent="unlock" label={t("users.detail.unlock")} /> : null}
            <ManageUserButton {...base} intent="resetPassword" label={t("users.detail.resetPassword")} />
            {user.totpEnabled ? (
              <div className="space-y-2">
                <ManageUserButton {...base} intent="resetTotp" label={t("users.detail.resetTotp")} />
                <FieldHint>{t("users.detail.resetTotpHint")}</FieldHint>
              </div>
            ) : null}
            {user.isActive ? (
              <ManageUserButton {...base} intent="deactivate" variant="destructive" label={t("users.detail.deactivate")} />
            ) : (
              <ManageUserButton {...base} intent="activate" label={t("users.detail.activate")} />
            )}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
