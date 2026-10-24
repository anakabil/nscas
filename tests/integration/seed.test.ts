// Membuktikan seed memuat instrumen NS-SCML-1.0 dengan lengkap, idempoten, dan tidak mengubah
// versi instrumen yang sudah dipakai asesmen.

import argon2 from "argon2";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DEMO_ORGANIZATION,
  INSTRUMENT_CODE,
  OPERATOR_ORGANIZATION,
  loadSeedFiles,
  seedDatabase,
  seedInstrument,
} from "../../prisma/seeding";
import { createTestClient, SEED_DIR } from "./db";

const prisma = createTestClient();
const admin = { email: "Admin@NusaSafety.test", password: "kata-sandi-uji-123" };

async function counts() {
  const version = await prisma.instrumentVersion.findUniqueOrThrow({ where: { code: INSTRUMENT_CODE } });
  const byVersion = { instrumentVersionId: version.id };
  return {
    versions: await prisma.instrumentVersion.count(),
    aspects: await prisma.aspect.count({ where: byVersion }),
    characteristics: await prisma.characteristic.count({ where: byVersion }),
    levelStatements: await prisma.levelStatement.count({ where: { characteristic: byVersion } }),
    evidenceRequirements: await prisma.evidenceRequirement.count({ where: { characteristic: byVersion } }),
    climateDimensions: await prisma.climateDimension.count({ where: byVersion }),
    climateItems: await prisma.climateItem.count({ where: { dimension: byVersion } }),
    users: await prisma.user.count(),
    organizations: await prisma.organization.count(),
    memberships: await prisma.membership.count(),
    seedAuditEntries: await prisma.auditLog.count({ where: { after: { path: ["source"], equals: "seed" } } }),
  };
}

beforeAll(async () => {
  await seedDatabase(prisma, { seedDir: SEED_DIR, admin });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("seed instrumen NS-SCML-1.0", () => {
  it("menghasilkan 7 aspek, 18 karakteristik, 90 pernyataan berjenjang, dan 21 butir skala iklim", async () => {
    const c = await counts();
    expect(c.aspects).toBe(7);
    expect(c.characteristics).toBe(18);
    expect(c.levelStatements).toBe(90);
    expect(c.climateDimensions).toBe(7);
    expect(c.climateItems).toBe(21);
  });

  it("berstatus PUBLISHED dengan parameter bawaan dari seed", async () => {
    const version = await prisma.instrumentVersion.findUniqueOrThrow({ where: { code: INSTRUMENT_CODE } });
    expect(version.status).toBe("PUBLISHED");
    expect(version.publishedAt).toBeInstanceOf(Date);
    const params = version.defaultParameters as Record<string, unknown>;
    expect(params.layerWeights).toEqual({ perception: 0.35, evidence: 0.4, validation: 0.25 });
    expect(params).not.toHaveProperty("_catatan");
  });

  it("setiap karakteristik memiliki tepat lima pernyataan, tingkat 1 sampai 5", async () => {
    const characteristics = await prisma.characteristic.findMany({
      include: { levelStatements: { select: { level: true }, orderBy: { level: "asc" } } },
    });
    for (const c of characteristics) {
      expect(c.levelStatements.map((l) => l.level), c.code).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it("bobot aspek dan karakteristik kontekstual sesuai seed", async () => {
    const aspects = await prisma.aspect.findMany({ orderBy: { code: "asc" } });
    expect(aspects.map((a) => [a.code, a.maxPointsStep5, a.excludedFromLevel])).toEqual([
      ["A1", 4800, false],
      ["A2", 1800, false],
      ["A3", 3450, false],
      ["A4", 3200, false],
      ["A5", 3950, false],
      ["A6", 800, false],
      ["KT", null, true],
    ]);
    const contextual = await prisma.characteristic.findMany({ where: { isContextual: true }, select: { code: true } });
    expect(contextual.map((c) => c.code).sort()).toEqual(["KT.1", "KT.2"]);
  });

  it("butir iklim negatif ditandai sesuai seed", async () => {
    const files = loadSeedFiles(SEED_DIR);
    const expected = files.climate.dimensions.flatMap((d) => d.items.filter((i) => i.reverse).map((i) => i.code));
    const reverse = await prisma.climateItem.findMany({ where: { reverseCoded: true }, select: { code: true } });
    expect(reverse.map((i) => i.code).sort()).toEqual(expected.sort());
  });
});

describe("pengguna SUPER_ADMIN dan organisasi demo", () => {
  it("SUPER_ADMIN dibuat dengan surel huruf kecil dan kata sandi argon2id", async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@nusasafety.test" },
      include: { memberships: { include: { organization: true } } },
    });
    expect(user.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(await argon2.verify(user.passwordHash, admin.password)).toBe(true);
    expect(user.memberships).toHaveLength(1);
    expect(user.memberships[0].role).toBe("SUPER_ADMIN");
    expect(user.memberships[0].organization.legalName).toBe(OPERATOR_ORGANIZATION.legalName);
  });

  it("organisasi demo PT Contoh Konstruksi tanpa asesmen dan tanpa data responden", async () => {
    const demo = await prisma.organization.findFirstOrThrow({
      where: { name: DEMO_ORGANIZATION.name },
      include: { _count: { select: { assessments: true, memberships: true } } },
    });
    expect(demo._count.assessments).toBe(0);
    expect(demo._count.memberships).toBe(0);
    expect(await prisma.rosterEntry.count()).toBe(0);
    expect(await prisma.accessToken.count()).toBe(0);
    expect(await prisma.surveyResponse.count()).toBe(0);
  });

  it("menolak kata sandi kurang dari 12 karakter", async () => {
    await expect(
      seedDatabase(prisma, { seedDir: SEED_DIR, admin: { email: "lain@nusasafety.test", password: "pendek" } }),
    ).rejects.toThrow(/12 characters/);
    expect(await prisma.user.count({ where: { email: "lain@nusasafety.test" } })).toBe(0);
  });
});

describe("idempotensi", () => {
  it("menjalankan ulang seed tidak menambah baris dan tidak mengubah kata sandi", async () => {
    const before = await counts();
    const userBefore = await prisma.user.findUniqueOrThrow({ where: { email: "admin@nusasafety.test" } });

    await seedDatabase(prisma, { seedDir: SEED_DIR, admin: { ...admin, password: "kata-sandi-lain-456" } });
    await seedDatabase(prisma, { seedDir: SEED_DIR, admin });

    expect(await counts()).toEqual(before);
    const userAfter = await prisma.user.findUniqueOrThrow({ where: { email: "admin@nusasafety.test" } });
    expect(userAfter.passwordHash).toBe(userBefore.passwordHash);
  });

  it("memulihkan isi instrumen yang menyimpang selama versi belum dipakai", async () => {
    const statement = await prisma.levelStatement.findFirstOrThrow({ where: { level: 3 } });
    await prisma.levelStatement.update({ where: { id: statement.id }, data: { textId: "diubah manual" } });

    await seedInstrument(prisma, loadSeedFiles(SEED_DIR));

    const restored = await prisma.levelStatement.findUniqueOrThrow({ where: { id: statement.id } });
    expect(restored.textId).toBe(statement.textId);
  });

  it("tidak mengubah versi instrumen yang sudah dipakai asesmen", async () => {
    const version = await prisma.instrumentVersion.findUniqueOrThrow({ where: { code: INSTRUMENT_CODE } });
    const demo = await prisma.organization.findFirstOrThrow({ where: { name: DEMO_ORGANIZATION.name } });
    const assessment = await prisma.assessment.create({
      data: {
        organizationId: demo.id,
        instrumentVersionId: version.id,
        name: "Asesmen uji",
        scopeType: "CORPORATE",
        periodStart: new Date("2026-11-01"),
        periodEnd: new Date("2026-12-31"),
        targetLevel: 4,
      },
    });
    const statement = await prisma.levelStatement.findFirstOrThrow({ where: { level: 2 } });
    await prisma.levelStatement.update({ where: { id: statement.id }, data: { textId: "teks yang sudah dipakai" } });

    try {
      const result = await seedInstrument(prisma, loadSeedFiles(SEED_DIR));
      expect(result.skippedBecauseInUse).toBe(true);
      const unchanged = await prisma.levelStatement.findUniqueOrThrow({ where: { id: statement.id } });
      expect(unchanged.textId).toBe("teks yang sudah dipakai");
    } finally {
      await prisma.assessment.delete({ where: { id: assessment.id } });
      await prisma.levelStatement.update({ where: { id: statement.id }, data: { textId: statement.textId } });
    }
  });
});
