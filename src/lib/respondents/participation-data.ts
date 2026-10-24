import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { loadEffectiveParameters } from "@/lib/assessments/load";
import { getDb } from "@/lib/db";
import { buildParticipation, snapshotTrend, type ParticipationInput, type SnapshotData } from "./participation";

type Db = Pick<Prisma.TransactionClient, "stratum" | "unit" | "accessToken" | "rosterEntry">;

/** Jumlah mentah per unit dan strata; unitScope membatasi ke unit koordinator. */
async function loadCounts(db: Db, assessmentId: string, unitScope: string[] | null) {
  const unitFilter = unitScope ? { unitId: { in: unitScope } } : {};
  const [strata, units, issued, completed, roster] = await Promise.all([
    db.stratum.findMany({ where: { assessmentId }, select: { id: true, code: true, name: true, population: true }, orderBy: { code: "asc" } }),
    db.unit.findMany({
      where: { assessmentId, ...(unitScope ? { id: { in: unitScope } } : {}) },
      select: { id: true, name: true, parentId: true },
      orderBy: { name: "asc" },
    }),
    db.accessToken.groupBy({ by: ["unitId", "stratumId"], where: { assessmentId, kind: "SURVEY", revokedAt: null, ...unitFilter }, _count: { _all: true } }),
    db.accessToken.groupBy({
      by: ["unitId", "stratumId"],
      where: { assessmentId, kind: "SURVEY", completedAt: { not: null }, ...unitFilter },
      _count: { _all: true },
    }),
    db.rosterEntry.groupBy({ by: ["unitId", "stratumId"], where: { assessmentId, ...unitFilter }, _count: { _all: true } }),
  ]);
  const key = (unitId: string, stratumId: string | null) => `${unitId}|${stratumId ?? ""}`;
  const tokens = new Map<string, ParticipationInput["tokens"][number]>();
  for (const row of issued) tokens.set(key(row.unitId, row.stratumId), { unitId: row.unitId, stratumId: row.stratumId, issued: row._count._all, completed: 0 });
  for (const row of completed) {
    const entry = tokens.get(key(row.unitId, row.stratumId)) ?? { unitId: row.unitId, stratumId: row.stratumId, issued: 0, completed: 0 };
    entry.completed = row._count._all;
    tokens.set(key(row.unitId, row.stratumId), entry);
  }
  return {
    strata,
    units,
    tokens: [...tokens.values()],
    roster: roster.map((r) => ({ unitId: r.unitId, stratumId: r.stratumId, count: r._count._all })),
  };
}

export async function loadParticipation(assessmentId: string, unitScope: string[] | null) {
  const db = getDb();
  const [{ parameters }, counts, snapshots] = await Promise.all([
    loadEffectiveParameters(assessmentId),
    loadCounts(db, assessmentId, unitScope),
    unitScope
      ? Promise.resolve([])
      : db.participationSnapshot.findMany({ where: { assessmentId }, orderBy: { takenOn: "asc" }, select: { takenOn: true, data: true } }),
  ]);
  const minCell = parameters.quality.minRespondentsPerReportCell;
  const summary = buildParticipation({
    ...counts,
    minParticipation: parameters.sampling.minParticipationPerStratum,
    minCell,
  });
  return {
    summary,
    minParticipation: parameters.sampling.minParticipationPerStratum,
    minCell,
    trend: snapshotTrend(snapshots.map((s) => ({ takenOn: s.takenOn, data: s.data as unknown as SnapshotData })), minCell),
  };
}

/** Tanggal kalender WIB (UTC+7) untuk kolom @db.Date. */
export function wibDate(now: Date): Date {
  const shifted = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

/** Tugas participation.snapshot: menyimpan jumlah harian untuk setiap asesmen yang sedang mengumpulkan data. */
export async function takeParticipationSnapshots(now: Date = new Date()): Promise<number> {
  const db = getDb();
  const assessments = await db.assessment.findMany({ where: { status: "DATA_COLLECTION" }, select: { id: true } });
  const takenOn = wibDate(now);
  for (const a of assessments) {
    const counts = await loadCounts(db, a.id, null);
    const data: SnapshotData = {
      population: counts.strata.reduce((t, s) => t + s.population, 0),
      issued: counts.tokens.reduce((t, x) => t + x.issued, 0),
      completed: counts.tokens.reduce((t, x) => t + x.completed, 0),
      strata: counts.strata.map((s) => ({
        stratumId: s.id,
        completed: counts.tokens.filter((x) => x.stratumId === s.id).reduce((t, x) => t + x.completed, 0),
      })),
    };
    const json = data as unknown as Prisma.InputJsonObject;
    await db.participationSnapshot.upsert({
      where: { assessmentId_takenOn: { assessmentId: a.id, takenOn } },
      create: { assessmentId: a.id, takenOn, data: json },
      update: { data: json },
    });
  }
  return assessments.length;
}
