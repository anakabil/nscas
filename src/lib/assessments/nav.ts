// Susunan menu asesmen (docs/05 bagian 2). Murni: dipakai layout (kolom samping) dan Ringkasan (akses cepat),
// dan dapat diuji tanpa basis data. Hak akses tetap diperiksa di server oleh setiap halaman melalui guard;
// penyaringan di sini hanya agar menu tidak menampilkan halaman yang pasti ditolak.

import type { AssessmentStatus, Role } from "@/generated/prisma/enums";
import {
  ACTION_PLAN_ROLES,
  ASSESSMENT_TEAM_ROLES,
  AUDIT_ROLES,
  DASHBOARD_ROLES,
  REPORT_ROLES,
  rolesFor,
  SCORING_ROLES,
  VALIDATION_ROLES,
} from "@/lib/auth/roles";
import { configurationReadRoles } from "./permissions";
import { PHASES, phaseOf, phaseState, type PhaseState, type WorkflowPhase } from "./workflow";

/** Halaman asesmen; sama dengan kunci assessment.nav dan assessment.navHints di messages. */
export type NavPage =
  | "overview"
  | "details"
  | "units"
  | "strata"
  | "parameters"
  | "sampling"
  | "team"
  | "respondents"
  | "qr"
  | "participation"
  | "selfAssessments"
  | "evidence"
  | "observations"
  | "validation"
  | "scoring"
  | "panel"
  | "dashboard"
  | "gaps"
  | "report"
  | "audit";

export type NavGroupKey = "overview" | WorkflowPhase | "OTHER";

export interface NavItem {
  page: NavPage;
  href: string;
  exact: boolean;
}

export interface NavGroup {
  key: NavGroupKey;
  /** Hanya untuk kelompok tahap. */
  state?: PhaseState;
  items: NavItem[];
}

export function assessmentNavGroups(assessmentId: string, status: AssessmentStatus, roles: readonly Role[]): NavGroup[] {
  const base = `/assessments/${assessmentId}`;
  const has = (allowed: readonly Role[]) => roles.some((r) => allowed.includes(r));
  const item = (page: NavPage, path: string, exact = false): NavItem => ({ page, href: path ? `${base}/${path}` : base, exact });
  const when = (allowed: boolean, ...items: NavItem[]) => (allowed ? items : []);

  const canReadConfiguration = has(configurationReadRoles(status));
  const phaseItems: Record<WorkflowPhase, NavItem[]> = {
    PREPARATION: [
      ...when(
        canReadConfiguration,
        item("details", "setup", true),
        item("units", "setup/units"),
        item("strata", "setup/strata"),
        item("parameters", "setup/parameters"),
        item("sampling", "setup/sampling"),
      ),
      ...when(has(ASSESSMENT_TEAM_ROLES.read), item("team", "setup/team")),
    ],
    DATA_COLLECTION: [
      ...when(has(rolesFor("roster", "read")), item("respondents", "respondents", true)),
      ...when(has(["LEAD_ASSESSOR", "CLIENT_ADMIN"]), item("qr", "respondents/qr")),
      ...when(has(rolesFor("tokensAndParticipation", "read")), item("participation", "participation")),
      ...when(has(rolesFor("selfAssessments", "read")), item("selfAssessments", "self-assessments")),
      ...when(has(rolesFor("evidenceAndObservations", "read")), item("evidence", "evidence"), item("observations", "observations")),
      ...when(has(VALIDATION_ROLES.read), item("validation", "validation")),
    ],
    SCORING: [...when(has(SCORING_ROLES.read), item("scoring", "scoring")), ...when(has(SCORING_ROLES.panelRead), item("panel", "panel"))],
    RESULTS: [
      ...when(has(DASHBOARD_ROLES.read), item("dashboard", "dashboard")),
      ...when(has(ACTION_PLAN_ROLES.read), item("gaps", "gaps")),
      ...when(has(REPORT_ROLES.read), item("report", "report")),
    ],
  };

  const groups: NavGroup[] = [
    { key: "overview", items: [item("overview", "", true)] },
    ...PHASES.map((phase): NavGroup => ({ key: phase, state: phaseState(phase, status), items: phaseItems[phase] })),
    { key: "OTHER", items: when(has(AUDIT_ROLES.read), item("audit", "audit")) },
  ];
  return groups.filter((group) => group.items.length > 0);
}

/**
 * Halaman untuk akses cepat di Ringkasan: halaman tahap yang sedang berjalan. Asesmen yang sudah diarsipkan
 * menampilkan halaman hasil.
 */
export function quickAccessItems(groups: NavGroup[], status: AssessmentStatus): { phase: WorkflowPhase; items: NavItem[] } | null {
  const current = phaseOf(status);
  const phase: WorkflowPhase = current === "CLOSED" ? "RESULTS" : current;
  const items = groups.find((group) => group.key === phase)?.items ?? [];
  return items.length > 0 ? { phase, items } : null;
}
