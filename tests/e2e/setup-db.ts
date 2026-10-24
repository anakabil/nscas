// Menyiapkan basis data e2e (nscas_e2e) sebelum server uji dijalankan oleh Playwright:
// dibuat ulang dari migrasi, diisi seed instrumen, lalu data uji untuk skenario hak akses.
// Data uji ditulis ke tests/e2e/.fixtures.json (diabaikan git) untuk dibaca oleh spesifikasi.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";
import { generateSecret } from "otplib";
import { Client } from "pg";
import { PrismaClient, type Role } from "../../src/generated/prisma/client";
import { encryptField, fieldContext } from "../../src/lib/privacy/crypto";
import { generateToken, hashToken } from "../../src/lib/privacy/tokens";
import { seedDatabase } from "../../prisma/seeding";
import { e2eDatabaseUrl } from "./database-url";

export const E2E_PASSWORD = "Kata-Sandi-Uji-2026";

async function main(): Promise<void> {
  const url = new URL(e2eDatabaseUrl());
  const name = url.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${name}"`);
  await client.end();
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe" });

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  await seedDatabase(prisma, { seedDir: join(__dirname, "..", "..", "seed"), admin: { email: "super@e2e.test", password: E2E_PASSWORD } });

  const passwordHash = await argon2.hash(E2E_PASSWORD, { type: argon2.argon2id });
  const operator = await prisma.organization.findFirstOrThrow({ where: { isOperator: true } });
  const version = await prisma.instrumentVersion.findUniqueOrThrow({ where: { code: "NS-SCML-1.0" } });
  const [orgA, orgB] = await Promise.all(
    [
      { name: "PT Alfa Konstruksi", legalName: "PT Alfa Konstruksi" },
      { name: "PT Beta Infrastruktur", legalName: "PT Beta Infrastruktur" },
    ].map((data) => prisma.organization.create({ data: { ...data, sector: "Konstruksi" } })),
  );

  const base = {
    instrumentVersionId: version.id,
    scopeType: "CORPORATE" as const,
    periodStart: new Date("2026-11-01"),
    periodEnd: new Date("2027-01-31"),
    targetLevel: 4,
  };
  const assessmentA = await prisma.assessment.create({ data: { ...base, organizationId: orgA.id, name: "Asesmen Budaya K3 Alfa 2026" } });
  const assessmentB = await prisma.assessment.create({ data: { ...base, organizationId: orgB.id, name: "Asesmen Budaya K3 Beta 2026" } });
  const unit = (assessmentId: string, unitName: string) =>
    prisma.unit.create({ data: { assessmentId, name: unitName, type: "PROJECT" } });
  const [unitA1, unitA2, unitB1] = await Promise.all([
    unit(assessmentA.id, "Proyek Jalan Tol Seksi 1"),
    unit(assessmentA.id, "Proyek Bendungan Hulu"),
    unit(assessmentB.id, "Proyek Pelabuhan Timur"),
  ]);
  const stratum = (assessmentId: string) =>
    prisma.stratum.create({ data: { assessmentId, code: "S4", name: "Pelaksana", group: "FIELD", population: 100 } });
  const [stratumA, stratumB] = await Promise.all([stratum(assessmentA.id), stratum(assessmentB.id)]);
  await prisma.rosterEntry.createMany({
    data: [
      { assessmentId: assessmentA.id, unitId: unitA1.id, stratumId: stratumA.id, fullName: "Responden Alfa Satu", employeeNo: "A-001" },
      { assessmentId: assessmentA.id, unitId: unitA1.id, stratumId: stratumA.id, fullName: "Responden Alfa Dua", employeeNo: "A-002" },
      { assessmentId: assessmentA.id, unitId: unitA2.id, stratumId: stratumA.id, fullName: "Responden Alfa Tiga", employeeNo: "A-003" },
      { assessmentId: assessmentB.id, unitId: unitB1.id, stratumId: stratumB.id, fullName: "Responden Beta Satu", employeeNo: "B-001" },
    ],
  });

  // Fase 5: asesmen organisasi ketiga yang sudah dikunci, untuk alur impor responden dan distribusi token.
  // Organisasi tersendiri agar pengguna ber-TOTP-nya tidak dipakai bersamaan dengan spesifikasi lain.
  const orgC = await prisma.organization.create({ data: { name: "PT Gamma Karya", legalName: "PT Gamma Karya", sector: "Konstruksi" } });
  const assessmentC = await prisma.assessment.create({
    data: { ...base, organizationId: orgC.id, name: "Asesmen Budaya K3 Gamma 2026", status: "LOCKED", lockedAt: new Date(), dpaSigned: true },
  });
  const [unitC1, unitC2] = await Promise.all([unit(assessmentC.id, "Proyek Gedung Utama"), unit(assessmentC.id, "Proyek Jembatan Barat")]);
  const strataC: [string, string, "MANAGEMENT" | "SUPERVISORY" | "FIELD", number, boolean][] = [
    ["S1", "Direksi dan manajemen puncak", "MANAGEMENT", 10, false],
    ["S2", "Manajemen menengah dan manajer proyek", "MANAGEMENT", 40, false],
    ["S3", "Penyelia dan pengawas lapangan", "SUPERVISORY", 100, false],
    ["S4", "Pelaksana dan pekerja sendiri", "FIELD", 400, false],
    ["S5", "Pekerja penyedia jasa dan subkontraktor", "FIELD", 450, true],
  ];
  await prisma.stratum.createMany({
    data: strataC.map(([code, stratumName, group, population, isContractor]) => ({ assessmentId: assessmentC.id, code, name: stratumName, group, population, isContractor })),
  });

  // Fase 6: asesmen yang sedang mengumpulkan data, dengan token survei mentah untuk tiap proyek uji
  // (tidak ada token yang dipakai dua proyek sekaligus).
  const parameters = version.defaultParameters as { quality?: Record<string, number> };
  const assessmentS = await prisma.assessment.create({
    data: {
      ...base,
      organizationId: orgC.id,
      name: "Survei Budaya K3 Gamma 2026",
      status: "DATA_COLLECTION",
      lockedAt: new Date(),
      dpaSigned: true,
      surveyOpensAt: new Date(Date.now() - 24 * 3_600_000),
      surveyClosesAt: new Date(Date.now() + 14 * 24 * 3_600_000),
      parameterSnapshot: {
        consent: {
          id: "PT Gamma Karya bersama Nusa Safety mengukur budaya keselamatan dan kesehatan kerja. Jawaban Anda anonim.",
          en: "PT Gamma Karya and Nusa Safety are measuring occupational safety and health culture. Your answers are anonymous.",
        },
        parameters: { quality: parameters.quality ?? {} },
      },
    },
  });
  const unitS = await unit(assessmentS.id, "Proyek Survei Timur");
  const stratumS = await prisma.stratum.create({ data: { assessmentId: assessmentS.id, code: "S4", name: "Pelaksana dan pekerja sendiri", group: "FIELD", population: 200 } });
  await prisma.stratum.create({ data: { assessmentId: assessmentS.id, code: "S5", name: "Pekerja penyedia jasa dan subkontraktor", group: "FIELD", population: 300, isContractor: true } });
  const surveyTokens: Record<string, string> = {};
  for (const project of ["desktop-chromium", "mobile-chromium"]) {
    for (const purpose of ["main", "payload", "decline", "qr"]) {
      const raw = generateToken();
      await prisma.accessToken.create({
        data: {
          assessmentId: assessmentS.id,
          unitId: unitS.id,
          stratumId: purpose === "qr" ? null : stratumS.id,
          kind: "SURVEY",
          channel: purpose === "qr" ? "QR" : "LINK",
          tokenHash: hashToken(raw),
        },
      });
      surveyTokens[`${project}:${purpose}`] = raw;
    }
  }
  const revokedRaw = generateToken();
  await prisma.accessToken.create({
    data: { assessmentId: assessmentS.id, unitId: unitS.id, stratumId: stratumS.id, kind: "SURVEY", channel: "LINK", tokenHash: hashToken(revokedRaw), revokedAt: new Date(), revokedReason: "MANUAL" },
  });
  surveyTokens.revoked = revokedRaw;

  const secrets: Record<string, string> = {};
  async function user(key: string, email: string, org: string, role: Role, options: { totp?: boolean; unitScope?: string[]; mustChangePassword?: boolean } = {}) {
    const existing = await prisma.user.findUnique({ where: { email } });
    const u = existing ?? (await prisma.user.create({ data: { email, name: key, passwordHash, mustChangePassword: options.mustChangePassword ?? false } }));
    if (!existing) await prisma.membership.create({ data: { userId: u.id, organizationId: org, role, unitScope: options.unitScope ?? [] } });
    if (options.totp) {
      secrets[key] = generateSecret();
      await prisma.user.update({
        where: { id: u.id },
        data: { totpEnabled: true, totpEnabledAt: new Date(), totpSecretEnc: encryptField(secrets[key], fieldContext("User", "totpSecretEnc", u.id)) },
      });
    }
    return { id: u.id, email };
  }

  const users = {
    superAdmin: await user("superAdmin", "super@e2e.test", operator.id, "SUPER_ADMIN", { totp: true }),
    adminA: await user("adminA", "admin.alfa@e2e.test", orgA.id, "CLIENT_ADMIN", { totp: true }),
    adminB: await user("adminB", "admin.beta@e2e.test", orgB.id, "CLIENT_ADMIN", { totp: true }),
    coordinatorA: await user("coordinatorA", "koordinator.alfa@e2e.test", orgA.id, "UNIT_COORDINATOR", { unitScope: [unitA1.id] }),
    newAdminA: await user("newAdminA", "admin.baru@e2e.test", orgA.id, "CLIENT_ADMIN"),
    lockoutUser: await user("lockoutUser", "terkunci@e2e.test", orgA.id, "EXECUTIVE_VIEWER"),
    tempPasswordUser: await user("tempPasswordUser", "sementara@e2e.test", orgA.id, "EXECUTIVE_VIEWER", { mustChangePassword: true }),
    leadAssessor: await user("leadAssessor", "asesor.utama@e2e.test", operator.id, "LEAD_ASSESSOR", { totp: true }),
    assessorStaff: await user("assessorStaff", "asesor@e2e.test", operator.id, "ASSESSOR"),
    adminC: await user("adminC", "admin.gamma@e2e.test", orgC.id, "CLIENT_ADMIN", { totp: true }),
    coordinatorC: await user("coordinatorC", "koordinator.gamma@e2e.test", orgC.id, "UNIT_COORDINATOR", { unitScope: [unitC1.id] }),
  };

  const fixtures = {
    password: E2E_PASSWORD,
    organizations: { a: orgA.id, b: orgB.id, operator: operator.id },
    assessments: { a: assessmentA.id, b: assessmentB.id, c: assessmentC.id, survey: assessmentS.id },
    surveyTokens,
    units: { a1: unitA1.id, a2: unitA2.id, b1: unitB1.id, c1: unitC1.id, c2: unitC2.id },
    users,
    totpSecrets: secrets,
  };
  writeFileSync(join(__dirname, ".fixtures.json"), JSON.stringify(fixtures, null, 2));
  await prisma.$disconnect();
  console.info(`E2E database ${name} siap.`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
