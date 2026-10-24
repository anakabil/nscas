import "server-only";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { draftFromDefaults, type DraftParameters } from "./parameters";

/** Data kepala halaman asesmen; disimpan per permintaan agar layout dan halaman tidak membaca dua kali. */
export const loadAssessmentHeader = cache(async (assessmentId: string, organizationId: string) => {
  return getDb().assessment.findUniqueOrThrow({
    where: { id: assessmentId, organizationId },
    select: {
      id: true,
      name: true,
      status: true,
      scopeType: true,
      periodStart: true,
      periodEnd: true,
      targetLevel: true,
      lockedAt: true,
      organization: { select: { id: true, name: true } },
      instrumentVersion: { select: { id: true, code: true } },
    },
  });
});

/** Parameter yang berlaku: snapshot bila sudah dikunci, selain itu draf. */
export async function loadEffectiveParameters(assessmentId: string) {
  const row = await getDb().assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    select: {
      parameterDraft: true,
      parameterSnapshot: true,
      consentTextId: true,
      consentTextEn: true,
      dpaSigned: true,
      instrumentVersion: { select: { defaultParameters: true } },
    },
  });
  const snapshot = row.parameterSnapshot as unknown as
    | { parameters: Omit<DraftParameters, "samplePlan">; samplePlan: DraftParameters["samplePlan"]; consent: { id: string; en: string }; dpaSigned: boolean }
    | null;
  if (snapshot) {
    return {
      locked: true,
      parameters: { ...snapshot.parameters, samplePlan: snapshot.samplePlan } as DraftParameters,
      consentTextId: snapshot.consent.id ?? "",
      consentTextEn: snapshot.consent.en ?? "",
      dpaSigned: snapshot.dpaSigned,
    };
  }
  return {
    locked: false,
    // Asesmen yang dibuat di luar formulir belum memiliki draf; pakai parameter bawaan instrumennya.
    parameters: (row.parameterDraft as unknown as DraftParameters | null) ?? draftFromDefaults(row.instrumentVersion.defaultParameters),
    consentTextId: row.consentTextId ?? "",
    consentTextEn: row.consentTextEn ?? "",
    dpaSigned: row.dpaSigned,
  };
}
