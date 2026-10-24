import "server-only";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { ALL_ROLES } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { canWriteConfiguration, configurationReadRoles } from "./permissions";
import { isConfigurationEditable } from "./state-machine";

/**
 * Akses halaman konfigurasi: peran pembaca bergantung pada status (sebelum atau sesudah dikunci).
 * Mengembalikan apakah formulir dapat diubah.
 */
export async function requireConfigurationPage(assessmentId: string) {
  const access = await guardPage(() => requireRole(assessmentId, ALL_ROLES));
  const assessment = await getDb().assessment.findUniqueOrThrow({
    where: { id: access.assessmentId },
    select: { status: true, lockedAt: true },
  });
  const allowed = configurationReadRoles(assessment.status);
  await guardPage(() => requireRole(assessmentId, allowed));
  const canWrite = canWriteConfiguration(access.roles);
  return {
    access,
    status: assessment.status,
    lockedAt: assessment.lockedAt,
    canWrite,
    editable: canWrite && isConfigurationEditable(assessment.status),
  };
}
