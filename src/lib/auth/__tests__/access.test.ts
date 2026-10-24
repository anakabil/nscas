import { describe, expect, it } from "vitest";
import { buildPrincipal, resolveAssessmentAccess, resolveOrganizationAccess, unitWhere, type MembershipInfo } from "../access";
import { ALL_ROLES, rolesFor } from "../roles";

const OPERATOR = "org-nusa";
const ORG_A = "org-a";
const ORG_B = "org-b";

function principal(memberships: Partial<MembershipInfo>[]) {
  return buildPrincipal(
    "user-1",
    memberships.map((m) => ({
      organizationId: m.organizationId ?? ORG_A,
      organizationIsOperator: m.organizationIsOperator ?? false,
      role: m.role ?? "CLIENT_ADMIN",
      unitScope: m.unitScope ?? [],
    })),
  );
}

const superAdmin = principal([{ organizationId: OPERATOR, organizationIsOperator: true, role: "SUPER_ADMIN" }]);
const assessor = principal([{ organizationId: OPERATOR, organizationIsOperator: true, role: "ASSESSOR" }]);
const clientAdminA = principal([{ organizationId: ORG_A, role: "CLIENT_ADMIN" }]);
const coordinatorA = principal([{ organizationId: ORG_A, role: "UNIT_COORDINATOR", unitScope: ["unit-1"] }]);

describe("isolasi tenant", () => {
  it("pengguna organisasi A tidak dapat membaca asesmen organisasi B (404, keberadaan tidak terungkap)", () => {
    expect(
      resolveAssessmentAccess({ principal: clientAdminA, assessmentOrganizationId: ORG_B, assignmentRole: null, allowedRoles: ALL_ROLES }),
    ).toEqual({ ok: false, status: 404 });
  });

  it("pengguna organisasi A dapat membaca asesmen organisasinya tanpa batas unit", () => {
    expect(
      resolveAssessmentAccess({ principal: clientAdminA, assessmentOrganizationId: ORG_A, assignmentRole: null, allowedRoles: ALL_ROLES }),
    ).toEqual({ ok: true, roles: ["CLIENT_ADMIN"], unitScope: null });
  });

  it("peran operator di organisasi klien diabaikan (keanggotaan tidak sah)", () => {
    const forged = principal([{ organizationId: ORG_A, role: "SUPER_ADMIN" }]);
    expect(forged.isSuperAdmin).toBe(false);
    expect(forged.memberships).toEqual([]);
    expect(
      resolveAssessmentAccess({ principal: forged, assessmentOrganizationId: ORG_A, assignmentRole: null, allowedRoles: ALL_ROLES }),
    ).toEqual({ ok: false, status: 404 });
  });
});

describe("cakupan unit koordinator", () => {
  const roster = rolesFor("roster", "read");

  it("dapat membaca unitnya", () => {
    expect(
      resolveAssessmentAccess({ principal: coordinatorA, assessmentOrganizationId: ORG_A, assignmentRole: null, allowedRoles: roster, unitId: "unit-1" }),
    ).toEqual({ ok: true, roles: ["UNIT_COORDINATOR"], unitScope: ["unit-1"] });
  });

  it("tidak dapat membaca unit lain (403)", () => {
    expect(
      resolveAssessmentAccess({ principal: coordinatorA, assessmentOrganizationId: ORG_A, assignmentRole: null, allowedRoles: roster, unitId: "unit-2" }),
    ).toEqual({ ok: false, status: 403 });
  });

  it("tanpa unitId, akses dibatasi ke unitScope untuk penyaringan kueri", () => {
    const decision = resolveAssessmentAccess({ principal: coordinatorA, assessmentOrganizationId: ORG_A, assignmentRole: null, allowedRoles: roster });
    expect(decision).toEqual({ ok: true, roles: ["UNIT_COORDINATOR"], unitScope: ["unit-1"] });
    if (decision.ok) expect(unitWhere(decision)).toEqual({ unitId: { in: ["unit-1"] } });
  });

  it("peran yang lebih luas di organisasi yang sama meniadakan batas unit", () => {
    const both = principal([
      { organizationId: ORG_A, role: "UNIT_COORDINATOR", unitScope: ["unit-1"] },
      { organizationId: ORG_A, role: "CLIENT_ADMIN" },
    ]);
    const decision = resolveAssessmentAccess({ principal: both, assessmentOrganizationId: ORG_A, assignmentRole: null, allowedRoles: roster, unitId: "unit-2" });
    expect(decision).toEqual({ ok: true, roles: ["CLIENT_ADMIN", "UNIT_COORDINATOR"], unitScope: null });
    if (decision.ok) expect(unitWhere(decision)).toEqual({});
  });
});

describe("SUPER_ADMIN", () => {
  it("tidak dapat membuka daftar responden (403)", () => {
    expect(
      resolveAssessmentAccess({ principal: superAdmin, assessmentOrganizationId: ORG_A, assignmentRole: null, allowedRoles: rolesFor("roster", "read") }),
    ).toEqual({ ok: false, status: 403 });
  });

  it("dapat membaca parameter dan jejak audit asesmen organisasi mana pun", () => {
    for (const resource of ["parametersAfterLock", "auditTrail", "tokensAndParticipation"] as const) {
      expect(
        resolveAssessmentAccess({ principal: superAdmin, assessmentOrganizationId: ORG_B, assignmentRole: null, allowedRoles: rolesFor(resource, "read") }).ok,
      ).toBe(true);
    }
  });
});

describe("asesor ditugaskan per asesmen", () => {
  it("tanpa penugasan, asesor tidak berhubungan dengan asesmen (404)", () => {
    expect(
      resolveAssessmentAccess({ principal: assessor, assessmentOrganizationId: ORG_A, assignmentRole: null, allowedRoles: ALL_ROLES }),
    ).toEqual({ ok: false, status: 404 });
  });

  it("dengan penugasan, asesor membaca jawaban mentah tetapi tidak daftar responden", () => {
    const base = { principal: assessor, assessmentOrganizationId: ORG_A, assignmentRole: "ASSESSOR" as const };
    expect(resolveAssessmentAccess({ ...base, allowedRoles: rolesFor("rawSurveyAnswers", "read") }).ok).toBe(true);
    expect(resolveAssessmentAccess({ ...base, allowedRoles: rolesFor("roster", "read") })).toEqual({ ok: false, status: 403 });
  });

  it("penugasan tanpa keanggotaan staf Nusa Safety tidak memberi peran asesor", () => {
    expect(
      resolveAssessmentAccess({ principal: clientAdminA, assessmentOrganizationId: ORG_B, assignmentRole: "LEAD_ASSESSOR", allowedRoles: ALL_ROLES }),
    ).toEqual({ ok: false, status: 404 });
  });
});

describe("akses tingkat organisasi", () => {
  const write = rolesFor("organizationsAndUsers", "write");
  const read = rolesFor("organizationsAndUsers", "read");

  it("CLIENT_ADMIN hanya mengelola organisasinya", () => {
    expect(resolveOrganizationAccess(clientAdminA, { id: ORG_A, isOperator: false }, write)).toEqual({ ok: true, roles: ["CLIENT_ADMIN"] });
    expect(resolveOrganizationAccess(clientAdminA, { id: ORG_B, isOperator: false }, write)).toEqual({ ok: false, status: 404 });
    expect(resolveOrganizationAccess(clientAdminA, { id: OPERATOR, isOperator: true }, read)).toEqual({ ok: false, status: 404 });
  });

  it("SUPER_ADMIN mengelola semua organisasi; ASSESSOR tidak berhak", () => {
    expect(resolveOrganizationAccess(superAdmin, { id: ORG_B, isOperator: false }, write).ok).toBe(true);
    expect(resolveOrganizationAccess(assessor, { id: ORG_B, isOperator: false }, read)).toEqual({ ok: false, status: 403 });
  });

  it("LEAD_ASSESSOR hanya membaca", () => {
    const lead = principal([{ organizationId: OPERATOR, organizationIsOperator: true, role: "LEAD_ASSESSOR" }]);
    expect(resolveOrganizationAccess(lead, { id: ORG_A, isOperator: false }, read).ok).toBe(true);
    expect(resolveOrganizationAccess(lead, { id: ORG_A, isOperator: false }, write)).toEqual({ ok: false, status: 403 });
  });
});
