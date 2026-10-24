// Pemuat data awal NSCAS. Dipanggil oleh prisma/seed.ts dan tes integrasi.
//
// Idempoten: dijalankan berulang kali menghasilkan isi yang sama tanpa duplikat.
// Versi instrumen yang sudah dipakai asesmen tidak diubah sama sekali (docs/02 bagian 3:
// instrumen berversi, tidak diubah setelah dipakai).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import argon2 from "argon2";
import { z } from "zod";
import type { PrismaClient } from "../src/generated/prisma/client";

export const INSTRUMENT_CODE = "NS-SCML-1.0";

export const OPERATOR_ORGANIZATION = {
  name: "Nusa Safety",
  legalName: "PT Nusa Rendra Jayatama",
  sector: "Konsultan keselamatan dan kesehatan kerja",
} as const;

export const DEMO_ORGANIZATION = {
  name: "PT Contoh Konstruksi",
  legalName: "PT Contoh Konstruksi",
  sector: "Konstruksi",
} as const;

// ---------------------------------------------------------------------------
// Skema berkas seed
// ---------------------------------------------------------------------------

const parametersSchema = z
  .object({
    instrumentVersion: z.literal(INSTRUMENT_CODE),
    aspects: z
      .array(
        z.object({
          code: z.string().min(1),
          name: z.string().min(1),
          maxPoints: z.record(z.enum(["2", "3", "4", "5"]), z.number().int().positive()).nullable(),
          excludedFromLevel: z.boolean().optional(),
        }),
      )
      .min(1),
  })
  .loose();

const instrumentSchema = z.object({
  characteristics: z
    .array(
      z.object({
        code: z.string().min(1),
        aspectCode: z.string().min(1),
        name: z.string().min(1),
        isContextual: z.boolean(),
        levels: z
          .array(z.object({ level: z.number().int().min(1).max(5), statement: z.string().min(1) }))
          .length(5)
          .refine((levels) => new Set(levels.map((l) => l.level)).size === 5, "tingkat 1 sampai 5 harus lengkap"),
        targetRespondents: z.array(z.string()).default([]),
        evidenceExamples: z.array(z.string().min(1)).default([]),
      }),
    )
    .min(1),
});

const climateSchema = z.object({
  dimensions: z
    .array(
      z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        items: z
          .array(z.object({ code: z.string().min(1), text: z.string().min(1), reverse: z.boolean() }))
          .min(1),
      }),
    )
    .min(1),
});

export interface SeedFiles {
  parameters: z.infer<typeof parametersSchema>;
  instrument: z.infer<typeof instrumentSchema>;
  climate: z.infer<typeof climateSchema>;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Membaca dan memvalidasi ketiga berkas seed. Galat menyebut berkas yang bermasalah. */
export function loadSeedFiles(seedDir: string): SeedFiles {
  const parse = <T>(schema: z.ZodType<T>, file: string): T => {
    const result = schema.safeParse(readJson(join(seedDir, file)));
    if (!result.success) throw new Error(`Invalid seed file ${file}: ${z.prettifyError(result.error)}`);
    return result.data;
  };
  const files: SeedFiles = {
    parameters: parse(parametersSchema, "aspek-dan-parameter.json"),
    instrument: parse(instrumentSchema, "instrumen-karakteristik-v1.json"),
    climate: parse(climateSchema, "skala-iklim-draf.json"),
  };

  const aspectCodes = new Set(files.parameters.aspects.map((a) => a.code));
  for (const c of files.instrument.characteristics) {
    if (!aspectCodes.has(c.aspectCode)) {
      throw new Error(`Characteristic ${c.code} refers to unknown aspect ${c.aspectCode}`);
    }
  }
  return files;
}

/** Parameter bawaan tanpa kunci catatan (diawali garis bawah). */
function defaultParameters(parameters: SeedFiles["parameters"]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(parameters).filter(([key]) => !key.startsWith("_")));
}

// ---------------------------------------------------------------------------
// Instrumen
// ---------------------------------------------------------------------------

export interface InstrumentSeedResult {
  instrumentVersionId: string;
  skippedBecauseInUse: boolean;
}

export async function seedInstrument(prisma: PrismaClient, files: SeedFiles): Promise<InstrumentSeedResult> {
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.instrumentVersion.findUnique({
        where: { code: INSTRUMENT_CODE },
        select: { id: true, publishedAt: true, _count: { select: { assessments: true } } },
      });
      if (existing && existing._count.assessments > 0) {
        return { instrumentVersionId: existing.id, skippedBecauseInUse: true };
      }

      const version = await tx.instrumentVersion.upsert({
        where: { code: INSTRUMENT_CODE },
        create: {
          code: INSTRUMENT_CODE,
          status: "PUBLISHED",
          publishedAt: new Date(),
          defaultParameters: defaultParameters(files.parameters) as object,
        },
        update: {
          status: "PUBLISHED",
          publishedAt: existing?.publishedAt ?? new Date(),
          defaultParameters: defaultParameters(files.parameters) as object,
        },
      });

      // Aspek
      const aspectIdByCode = new Map<string, string>();
      for (const a of files.parameters.aspects) {
        const data = {
          name: a.name,
          maxPointsStep5: a.maxPoints?.["5"] ?? null,
          excludedFromLevel: a.excludedFromLevel ?? false,
        };
        const row = await tx.aspect.upsert({
          where: { instrumentVersionId_code: { instrumentVersionId: version.id, code: a.code } },
          create: { instrumentVersionId: version.id, code: a.code, ...data },
          update: data,
        });
        aspectIdByCode.set(a.code, row.id);
      }

      // Karakteristik, pernyataan berjenjang, dan kebutuhan bukti.
      // nameEn dan textEn tidak ditimpa agar terjemahan yang diisi kemudian tidak hilang.
      for (const [index, c] of files.instrument.characteristics.entries()) {
        const data = {
          aspectId: aspectIdByCode.get(c.aspectCode) as string,
          nameId: c.name,
          isContextual: c.isContextual,
          order: index + 1,
          targetRespondents: c.targetRespondents,
        };
        const characteristic = await tx.characteristic.upsert({
          where: { instrumentVersionId_code: { instrumentVersionId: version.id, code: c.code } },
          create: { instrumentVersionId: version.id, code: c.code, ...data },
          update: data,
        });

        for (const l of c.levels) {
          await tx.levelStatement.upsert({
            where: { characteristicId_level: { characteristicId: characteristic.id, level: l.level } },
            create: { characteristicId: characteristic.id, level: l.level, textId: l.statement },
            update: { textId: l.statement },
          });
        }

        for (const [order, description] of c.evidenceExamples.entries()) {
          await tx.evidenceRequirement.upsert({
            where: { characteristicId_order: { characteristicId: characteristic.id, order: order + 1 } },
            create: { characteristicId: characteristic.id, order: order + 1, description },
            update: { description },
          });
        }
        await tx.evidenceRequirement.deleteMany({
          where: { characteristicId: characteristic.id, order: { gt: c.evidenceExamples.length } },
        });
      }

      // Skala iklim
      for (const [dimIndex, d] of files.climate.dimensions.entries()) {
        const dimension = await tx.climateDimension.upsert({
          where: { instrumentVersionId_code: { instrumentVersionId: version.id, code: d.code } },
          create: { instrumentVersionId: version.id, code: d.code, nameId: d.name, order: dimIndex + 1 },
          update: { nameId: d.name, order: dimIndex + 1 },
        });
        for (const [itemIndex, item] of d.items.entries()) {
          const data = { textId: item.text, reverseCoded: item.reverse, order: itemIndex + 1 };
          await tx.climateItem.upsert({
            where: { dimensionId_code: { dimensionId: dimension.id, code: item.code } },
            create: { dimensionId: dimension.id, code: item.code, ...data },
            update: data,
          });
        }
        await tx.climateItem.deleteMany({
          where: { dimensionId: dimension.id, code: { notIn: d.items.map((i) => i.code) } },
        });
      }

      // Buang isi yang tidak lagi ada di seed (aman karena versi ini belum dipakai asesmen).
      const characteristicCodes = files.instrument.characteristics.map((c) => c.code);
      await tx.characteristic.deleteMany({
        where: { instrumentVersionId: version.id, code: { notIn: characteristicCodes } },
      });
      await tx.climateDimension.deleteMany({
        where: { instrumentVersionId: version.id, code: { notIn: files.climate.dimensions.map((d) => d.code) } },
      });
      await tx.aspect.deleteMany({
        where: { instrumentVersionId: version.id, code: { notIn: files.parameters.aspects.map((a) => a.code) } },
      });

      if (!existing) {
        await tx.auditLog.create({
          data: {
            action: "instrument.publish",
            entityType: "InstrumentVersion",
            entityId: version.id,
            after: { code: INSTRUMENT_CODE, status: "PUBLISHED", source: "seed" },
          },
        });
      }

      return { instrumentVersionId: version.id, skippedBecauseInUse: false };
    },
    { timeout: 60_000 },
  );
}

// ---------------------------------------------------------------------------
// Organisasi dan pengguna
// ---------------------------------------------------------------------------

const adminSchema = z.object({
  email: z.email().transform((e) => e.trim().toLowerCase()),
  // docs/04 bagian 3: kata sandi minimal 12 karakter
  password: z.string().min(12, "SEED_ADMIN_PASSWORD must be at least 12 characters"),
  name: z.string().min(1).default("Administrator NSCAS"),
});

export type AdminSeedInput = z.input<typeof adminSchema>;

async function ensureOrganization(
  prisma: PrismaClient,
  org: { name: string; legalName: string; sector: string },
  isOperator = false,
): Promise<{ id: string; created: boolean }> {
  // Organisasi operator dikenali dari penandanya; organisasi lain dari nama dan nama resmi.
  const existing = await prisma.organization.findFirst({
    where: isOperator ? { isOperator: true } : { name: org.name, legalName: org.legalName, isOperator: false },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };
  const created = await prisma.organization.create({ data: { ...org, isOperator }, select: { id: true } });
  await prisma.auditLog.create({
    data: {
      organizationId: created.id,
      action: "organization.create",
      entityType: "Organization",
      entityId: created.id,
      after: { ...org, isOperator, source: "seed" },
    },
  });
  return { id: created.id, created: true };
}

export interface AdminSeedResult {
  userId: string;
  created: boolean;
}

/**
 * Membuat pengguna SUPER_ADMIN di organisasi operator (Nusa Safety). Bila surel sudah terdaftar,
 * kata sandi tidak diubah agar menjalankan ulang seed tidak menimpa kata sandi yang telah diganti.
 */
export async function seedSuperAdmin(prisma: PrismaClient, input: AdminSeedInput): Promise<AdminSeedResult> {
  const admin = adminSchema.parse(input);
  const operator = await ensureOrganization(prisma, OPERATOR_ORGANIZATION, true);

  let user = await prisma.user.findUnique({ where: { email: admin.email }, select: { id: true } });
  const created = !user;
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: admin.email,
        name: admin.name,
        passwordHash: await argon2.hash(admin.password, { type: argon2.argon2id }),
      },
      select: { id: true },
    });
    await prisma.auditLog.create({
      data: {
        organizationId: operator.id,
        action: "user.create",
        entityType: "User",
        entityId: user.id,
        after: { email: admin.email, source: "seed" },
      },
    });
  }

  const membershipKey = { userId: user.id, organizationId: operator.id, role: "SUPER_ADMIN" as const };
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId_role: membershipKey },
    select: { id: true },
  });
  if (!membership) {
    const m = await prisma.membership.create({ data: membershipKey, select: { id: true } });
    await prisma.auditLog.create({
      data: {
        organizationId: operator.id,
        action: "membership.role_grant",
        entityType: "Membership",
        entityId: m.id,
        after: { ...membershipKey, source: "seed" },
      },
    });
  }

  return { userId: user.id, created };
}

/** Organisasi demo tanpa asesmen dan tanpa data responden. */
export async function seedDemoOrganization(prisma: PrismaClient): Promise<{ id: string; created: boolean }> {
  return ensureOrganization(prisma, DEMO_ORGANIZATION);
}

// ---------------------------------------------------------------------------
// Pintu masuk
// ---------------------------------------------------------------------------

export interface SeedOptions {
  seedDir: string;
  admin: AdminSeedInput;
  log?: (message: string) => void;
}

export async function seedDatabase(prisma: PrismaClient, options: SeedOptions): Promise<void> {
  const log = options.log ?? (() => {});
  const files = loadSeedFiles(options.seedDir);

  const instrument = await seedInstrument(prisma, files);
  log(
    instrument.skippedBecauseInUse
      ? `Instrumen ${INSTRUMENT_CODE} sudah dipakai asesmen; isinya tidak diubah.`
      : `Instrumen ${INSTRUMENT_CODE} dimuat dengan status PUBLISHED.`,
  );

  const admin = await seedSuperAdmin(prisma, options.admin);
  log(
    admin.created
      ? "Pengguna SUPER_ADMIN dibuat."
      : "Pengguna SUPER_ADMIN sudah ada; kata sandi tidak diubah.",
  );

  const demo = await seedDemoOrganization(prisma);
  log(demo.created ? `Organisasi demo ${DEMO_ORGANIZATION.name} dibuat.` : `Organisasi demo ${DEMO_ORGANIZATION.name} sudah ada.`);
}
