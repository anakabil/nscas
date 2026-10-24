import type { AssessmentStatus, Role } from "@/generated/prisma/enums";
import { rolesFor } from "@/lib/auth/roles";
import { isConfigurationEditable } from "./state-machine";

/** Peran yang boleh melihat konfigurasi: sebelum dikunci mengikuti baris "sebelum dikunci", sesudahnya "setelah dikunci". */
export function configurationReadRoles(status: AssessmentStatus): readonly Role[] {
  return isConfigurationEditable(status) ? rolesFor("parametersBeforeLock", "read") : rolesFor("parametersAfterLock", "read");
}

export const CONFIGURATION_WRITE_ROLES = rolesFor("parametersBeforeLock", "write");

export function canWriteConfiguration(roles: readonly Role[]): boolean {
  return roles.some((r) => CONFIGURATION_WRITE_ROLES.includes(r));
}
