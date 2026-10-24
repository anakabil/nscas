import { describe, expect, it } from "vitest";
import {
  ALL_ROLES,
  CLIENT_ROLES,
  grantableRoles,
  isValidMembership,
  OPERATOR_ROLES,
  PERMISSIONS,
  TOTP_REQUIRED_ROLES,
  type Resource,
} from "../roles";

// Salinan langsung matriks docs/04 bagian 2. Kolom: SUPER_ADMIN, LEAD_ASSESSOR, ASSESSOR,
// CLIENT_ADMIN, UNIT_COORDINATOR, EXECUTIVE_VIEWER. U = ubah (juga baca), B = baca, X = tidak ada akses.
const DOCS_MATRIX: [Resource, string][] = [
  ["organizationsAndUsers", "U B X U X X"],
  ["parametersBeforeLock", "B U B B X X"],
  ["parametersAfterLock", "B B B B X B"],
  ["roster", "X B X U U X"],
  ["tokensAndParticipation", "B B B U B B"],
  ["rawSurveyAnswers", "X B B X X X"],
  ["selfAssessments", "X B B B X X"],
  ["evidenceAndObservations", "X B B U U X"],
  ["assessorRatings", "X U U X X X"],
  ["panelAndFinalization", "X U B X X X"],
  ["resultsDashboard", "X B B B B B"],
  ["actionPlans", "X U U U U B"],
  ["reports", "X U B B X B"],
  ["auditTrail", "B B X B X X"],
];

describe("matriks hak akses sama dengan docs/04 bagian 2", () => {
  it("setiap sumber daya di PERMISSIONS ada di matriks dokumen", () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual(DOCS_MATRIX.map(([r]) => r).sort());
  });

  it.each(DOCS_MATRIX)("%s", (resource, row) => {
    const cells = row.split(" ");
    const read = ALL_ROLES.filter((_, i) => cells[i] === "B" || cells[i] === "U");
    const write = ALL_ROLES.filter((_, i) => cells[i] === "U");
    expect([...PERMISSIONS[resource].read].sort()).toEqual([...read].sort());
    expect([...PERMISSIONS[resource].write].sort()).toEqual([...write].sort());
  });

  it("SUPER_ADMIN tidak dapat membaca daftar responden maupun jawaban mentah", () => {
    expect(PERMISSIONS.roster.read).not.toContain("SUPER_ADMIN");
    expect(PERMISSIONS.rawSurveyAnswers.read).not.toContain("SUPER_ADMIN");
  });
});

describe("peran", () => {
  it("TOTP wajib untuk SUPER_ADMIN, LEAD_ASSESSOR, ASSESSOR, dan CLIENT_ADMIN (docs/04 bagian 3)", () => {
    expect([...TOTP_REQUIRED_ROLES].sort()).toEqual(["ASSESSOR", "CLIENT_ADMIN", "LEAD_ASSESSOR", "SUPER_ADMIN"]);
  });

  it("peran operator hanya sah di organisasi operator dan peran klien hanya di organisasi klien", () => {
    for (const role of OPERATOR_ROLES) {
      expect(isValidMembership(role, true)).toBe(true);
      expect(isValidMembership(role, false)).toBe(false);
    }
    for (const role of CLIENT_ROLES) {
      expect(isValidMembership(role, false)).toBe(true);
      expect(isValidMembership(role, true)).toBe(false);
    }
  });

  it("CLIENT_ADMIN hanya dapat memberikan peran klien di organisasinya", () => {
    expect(grantableRoles({ isSuperAdmin: false, isClientAdminOfTarget: true }, false)).toEqual([...CLIENT_ROLES]);
    expect(grantableRoles({ isSuperAdmin: false, isClientAdminOfTarget: true }, true)).toEqual([]);
    expect(grantableRoles({ isSuperAdmin: false, isClientAdminOfTarget: false }, false)).toEqual([]);
  });

  it("SUPER_ADMIN memberikan peran operator di organisasi operator dan peran klien di organisasi klien", () => {
    expect(grantableRoles({ isSuperAdmin: true, isClientAdminOfTarget: false }, true)).toEqual([...OPERATOR_ROLES]);
    expect(grantableRoles({ isSuperAdmin: true, isClientAdminOfTarget: false }, false)).toEqual([...CLIENT_ROLES]);
  });
});
