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
  };

  const fixtures = {
    password: E2E_PASSWORD,
    organizations: { a: orgA.id, b: orgB.id, operator: operator.id },
    assessments: { a: assessmentA.id, b: assessmentB.id },
    units: { a1: unitA1.id, a2: unitA2.id, b1: unitB1.id },
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
