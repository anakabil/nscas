// Membuktikan pemicu PostgreSQL menjadikan AuditLog hanya-tambah (CLAUDE.md aturan 6).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient } from "./db";

const prisma = createTestClient();
let entryId: string;

beforeAll(async () => {
  const entry = await prisma.auditLog.create({
    data: {
      action: "assessment.lock",
      entityType: "Assessment",
      entityId: "assessment-1",
      before: { status: "CONFIGURED" },
      after: { status: "LOCKED" },
    },
  });
  entryId = entry.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("AuditLog hanya boleh ditambah", () => {
  it("INSERT diterima", async () => {
    await expect(
      prisma.auditLog.create({ data: { action: "report.download", entityType: "Report" } }),
    ).resolves.toMatchObject({ action: "report.download" });
  });

  it("UPDATE ditolak", async () => {
    await expect(
      prisma.auditLog.update({ where: { id: entryId }, data: { action: "tampered" } }),
    ).rejects.toThrow(/append-only: UPDATE/);
    await expect(prisma.auditLog.updateMany({ data: { action: "tampered" } })).rejects.toThrow(/append-only/);
  });

  it("DELETE ditolak", async () => {
    await expect(prisma.auditLog.delete({ where: { id: entryId } })).rejects.toThrow(/append-only: DELETE/);
    await expect(prisma.auditLog.deleteMany({})).rejects.toThrow(/append-only/);
  });

  it("UPDATE dan DELETE melalui SQL mentah juga ditolak", async () => {
    await expect(
      prisma.$executeRawUnsafe(`UPDATE "AuditLog" SET "action" = 'tampered' WHERE "id" = $1`, entryId),
    ).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe(`DELETE FROM "AuditLog"`)).rejects.toThrow(/append-only/);
  });

  it("TRUNCATE ditolak", async () => {
    await expect(prisma.$executeRawUnsafe(`TRUNCATE "AuditLog"`)).rejects.toThrow(/append-only: TRUNCATE/);
  });

  it("baris asli tetap utuh setelah seluruh upaya di atas", async () => {
    const entry = await prisma.auditLog.findUniqueOrThrow({ where: { id: entryId } });
    expect(entry.action).toBe("assessment.lock");
    expect(entry.after).toEqual({ status: "LOCKED" });
    expect(await prisma.auditLog.count({ where: { action: "tampered" } })).toBe(0);
  });
});
