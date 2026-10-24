import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { AssessmentStatus, QualityFlag } from "@/generated/prisma/enums";
import { getDb } from "@/lib/db";
import { hashToken, looksLikeToken, roundToNearestHour } from "@/lib/privacy/tokens";
import { responseQualityFlags } from "@/lib/scoring/quality";
import { durationBucket, estimatedMedianMinutes, respondentOrder, wibDateOnly, type DurationBucketCode, type SurveySubmission } from "./rules";

// Survei responden (docs/01 M3) dengan desain anonimitas docs/02 bagian 4. Modul ini sengaja tidak memakai
// jejak audit maupun metadata permintaan: mencatat waktu atau alamat pengiriman akan memungkinkan jawaban
// dicocokkan dengan token. Satu-satunya jejak per token adalah completedAt yang dibulatkan ke jam.

export type TokenState =
  | { state: "INVALID" }
  | { state: "USED" }
  | { state: "NOT_OPEN"; opensAt: Date | null }
  | { state: "CLOSED" }
  | {
      state: "READY";
      tokenHash: string;
      assessmentId: string;
      instrumentVersionId: string;
      organizationName: string;
      needsStratum: boolean;
      closesAt: Date | null;
      consent: { id: string; en: string };
    };

interface Window {
  status: AssessmentStatus;
  surveyOpensAt: Date | null;
  surveyClosesAt: Date | null;
}

function windowState(a: Window, now: Date): "OPEN" | "NOT_OPEN" | "CLOSED" {
  if (a.status !== "DATA_COLLECTION") return STATUS_AFTER_COLLECTION.has(a.status) ? "CLOSED" : "NOT_OPEN";
  if (a.surveyOpensAt && a.surveyOpensAt > now) return "NOT_OPEN";
  if (a.surveyClosesAt && a.surveyClosesAt <= now) return "CLOSED";
  return "OPEN";
}

const STATUS_AFTER_COLLECTION = new Set<AssessmentStatus>(["SCORING", "PANEL_REVIEW", "ACTION_PLANNING", "REPORTED", "MONITORING", "ARCHIVED", "PURGED"]);

const tokenSelect = {
  id: true,
  kind: true,
  revokedAt: true,
  completedAt: true,
  stratumId: true,
  unitId: true,
  assessment: {
    select: {
      id: true,
      status: true,
      surveyOpensAt: true,
      surveyClosesAt: true,
      instrumentVersionId: true,
      parameterSnapshot: true,
      organization: { select: { name: true } },
    },
  },
} satisfies Prisma.AccessTokenSelect;

/** Status tautan survei untuk halaman /s/[token]. Tidak mengubah apa pun. */
export async function resolveSurveyToken(raw: string, now: Date = new Date()): Promise<TokenState> {
  if (!looksLikeToken(raw)) return { state: "INVALID" };
  const tokenHash = hashToken(raw);
  const token = await getDb().accessToken.findUnique({ where: { tokenHash }, select: tokenSelect });
  if (!token || token.kind !== "SURVEY" || token.revokedAt) return { state: "INVALID" };
  if (token.completedAt) return { state: "USED" };
  const a = token.assessment;
  const window = windowState(a, now);
  if (window === "NOT_OPEN") return { state: "NOT_OPEN", opensAt: a.status === "DATA_COLLECTION" ? a.surveyOpensAt : null };
  if (window === "CLOSED") return { state: "CLOSED" };
  const snapshot = a.parameterSnapshot as { consent?: { id?: string; en?: string } } | null;
  return {
    state: "READY",
    tokenHash,
    assessmentId: a.id,
    instrumentVersionId: a.instrumentVersionId,
    organizationName: a.organization.name,
    needsStratum: token.stratumId === null,
    closesAt: a.surveyClosesAt,
    consent: { id: snapshot?.consent?.id ?? "", en: snapshot?.consent?.en ?? "" },
  };
}

export interface SurveyContent {
  characteristics: {
    id: string;
    code: string;
    name: { id: string; en: string | null };
    /** Urutan acak tetap per responden; tingkat pernyataan tidak dikirim ke peramban. */
    statements: { id: string; text: { id: string; en: string | null } }[];
  }[];
  /** Butir skala iklim dikelompokkan per dimensi; satu kelompok satu layar. */
  climateScreens: { id: string; text: { id: string; en: string | null } }[][];
  strata: { id: string; name: string }[];
}

export async function loadSurveyContent(instrumentVersionId: string, assessmentId: string, seed: string, needsStratum: boolean): Promise<SurveyContent> {
  const db = getDb();
  const [characteristics, dimensions, strata] = await Promise.all([
    db.characteristic.findMany({
      where: { instrumentVersionId },
      orderBy: { order: "asc" },
      select: { id: true, code: true, nameId: true, nameEn: true, levelStatements: { select: { id: true, textId: true, textEn: true } } },
    }),
    db.climateDimension.findMany({
      where: { instrumentVersionId },
      orderBy: { order: "asc" },
      select: { items: { orderBy: { order: "asc" }, select: { id: true, textId: true, textEn: true } } },
    }),
    needsStratum
      ? db.stratum.findMany({ where: { assessmentId }, orderBy: { code: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);
  return {
    characteristics: characteristics.map((c) => ({
      id: c.id,
      code: c.code,
      name: { id: c.nameId, en: c.nameEn },
      statements: respondentOrder(c.levelStatements, seed).map((s) => ({ id: s.id, text: { id: s.textId, en: s.textEn } })),
    })),
    climateScreens: dimensions.filter((d) => d.items.length > 0).map((d) => d.items.map((i) => ({ id: i.id, text: { id: i.textId, en: i.textEn } }))),
    strata,
  };
}

/** Mencatat bahwa tautan pernah dibuka (dibulatkan ke jam), dipakai pengingat untuk tidak mengganti token. */
export async function markSurveyOpened(raw: string, now: Date = new Date()): Promise<void> {
  if (!looksLikeToken(raw)) return;
  await getDb().accessToken.updateMany({
    where: { tokenHash: hashToken(raw), kind: "SURVEY", firstOpenedAt: null, revokedAt: null, completedAt: null },
    data: { firstOpenedAt: roundToNearestHour(now) },
  });
}

export type SubmitResult =
  | { ok: true }
  | { ok: false; status: 404; code: "INVALID_TOKEN" }
  | { ok: false; status: 409; code: "ALREADY_SUBMITTED" | "SURVEY_CLOSED" | "SURVEY_NOT_OPEN" }
  | { ok: false; status: 422; code: "INCOMPLETE" | "STRATUM_REQUIRED" | "UNKNOWN_ITEM" };

/**
 * Pengiriman survei dalam satu transaksi (docs/02 bagian 4 butir 2): token ditandai selesai, lalu
 * SurveyResponse dibuat dengan unit dan strata yang disalin dari token, tanpa rujukan ke token maupun daftar
 * responden, dengan tanggal tanpa jam dan durasi dalam rentang. Tanda mutu dihitung sesuai docs/03 bagian 8.
 */
export async function submitSurvey(raw: string, input: SurveySubmission, now: Date = new Date()): Promise<SubmitResult> {
  if (!looksLikeToken(raw)) return { ok: false, status: 404, code: "INVALID_TOKEN" };
  const tokenHash = hashToken(raw);
  return getDb().$transaction(async (tx) => {
    // Kunci baris token: dua kiriman bersamaan dengan token yang sama tidak boleh sama-sama tersimpan.
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "AccessToken" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
    if (locked.length === 0) return { ok: false, status: 404, code: "INVALID_TOKEN" } as const;
    const token = await tx.accessToken.findUniqueOrThrow({ where: { tokenHash }, select: tokenSelect });
    if (token.kind !== "SURVEY" || token.revokedAt) return { ok: false, status: 404, code: "INVALID_TOKEN" } as const;
    if (token.completedAt) return { ok: false, status: 409, code: "ALREADY_SUBMITTED" } as const;
    const window = windowState(token.assessment, now);
    if (window === "CLOSED") return { ok: false, status: 409, code: "SURVEY_CLOSED" } as const;
    if (window === "NOT_OPEN") return { ok: false, status: 409, code: "SURVEY_NOT_OPEN" } as const;
    const a = token.assessment;

    let stratumId = token.stratumId;
    if (!stratumId) {
      const chosen = input.stratumId ? await tx.stratum.findFirst({ where: { id: input.stratumId, assessmentId: a.id }, select: { id: true } }) : null;
      if (!chosen) return { ok: false, status: 422, code: "STRATUM_REQUIRED" } as const;
      stratumId = chosen.id;
    }

    // Seluruh karakteristik dan butir iklim versi instrumen ini wajib dijawab tepat satu kali.
    const characteristics = await tx.characteristic.findMany({
      where: { instrumentVersionId: a.instrumentVersionId },
      select: { id: true, levelStatements: { select: { id: true, level: true } } },
    });
    const items = await tx.climateItem.findMany({ where: { dimension: { instrumentVersionId: a.instrumentVersionId } }, select: { id: true } });
    const answers = new Map(input.characteristics.map((c) => [c.characteristicId, c.statementId]));
    const values = new Map(input.climate.map((c) => [c.itemId, c.value]));
    if (answers.size !== input.characteristics.length || values.size !== input.climate.length) return { ok: false, status: 422, code: "INCOMPLETE" } as const;
    if (answers.size !== characteristics.length || values.size !== items.length) return { ok: false, status: 422, code: "INCOMPLETE" } as const;

    const characteristicAnswers: { characteristicId: string; level: number | null }[] = [];
    for (const c of characteristics) {
      if (!answers.has(c.id)) return { ok: false, status: 422, code: "UNKNOWN_ITEM" } as const;
      const statementId = answers.get(c.id) ?? null;
      if (statementId === null) {
        characteristicAnswers.push({ characteristicId: c.id, level: null });
        continue;
      }
      const statement = c.levelStatements.find((s) => s.id === statementId);
      if (!statement) return { ok: false, status: 422, code: "UNKNOWN_ITEM" } as const;
      characteristicAnswers.push({ characteristicId: c.id, level: statement.level });
    }
    if (items.some((i) => !values.has(i.id))) return { ok: false, status: 422, code: "UNKNOWN_ITEM" } as const;
    const climateAnswers = items.map((i) => ({ itemId: i.id, value: values.get(i.id) as number }));

    const bucketRows = await tx.surveyResponse.groupBy({ by: ["durationBucket"], where: { assessmentId: a.id }, _count: { _all: true } });
    const medianMinutes = estimatedMedianMinutes(Object.fromEntries(bucketRows.map((r) => [r.durationBucket, r._count._all])) as Record<DurationBucketCode, number>);
    const quality = (a.parameterSnapshot as { parameters?: { quality?: Record<string, number> } } | null)?.parameters?.quality ?? {};
    const qualityFlags = responseQualityFlags(
      {
        climateValues: climateAnswers.map((c) => c.value),
        characteristicLevels: characteristicAnswers.map((c) => c.level),
        durationMinutes: input.durationSeconds / 60,
      },
      medianMinutes,
      {
        straightliningShare: quality.straightliningShare ?? 0.9,
        speedingFractionOfMedian: quality.speedingFractionOfMedian ?? 0.33,
        dontKnowShareMax: quality.dontKnowShareMax ?? 0.5,
      },
    ) as QualityFlag[];

    const roundedNow = roundToNearestHour(now);
    await tx.accessToken.update({
      where: { id: token.id },
      data: { completedAt: roundedNow, consentAt: roundedNow, ...(token.stratumId ? {} : { stratumId }) },
    });
    await tx.surveyResponse.create({
      data: {
        assessmentId: a.id,
        unitId: token.unitId,
        stratumId,
        instrumentVersionId: a.instrumentVersionId,
        language: input.language,
        submittedOn: wibDateOnly(now),
        durationBucket: durationBucket(input.durationSeconds),
        qualityFlags,
        characteristicAnswers: { createMany: { data: characteristicAnswers } },
        climateAnswers: { createMany: { data: climateAnswers } },
      },
      select: { id: true },
    });
    return { ok: true } as const;
  });
}
