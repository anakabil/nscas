// Tipe masukan dan keluaran mesin penilaian NSCAS (docs/03 bagian 9).
// Modul ini murni: tanpa impor Prisma, Next.js, atau I/O.

export type Flag =
  | "SELISIH_PERSEPSI_BUKTI"
  | "LAPISAN_TIDAK_LENGKAP"
  | "SEMUA_LAPISAN_KOSONG"
  | "PENILAI_TUNGGAL"
  | "PERLU_REKONSILIASI";

export type QualityFlag = "POLA_SERAGAM" | "TERLALU_CEPAT" | "BANYAK_TIDAK_TAHU";

export type Level = 1 | 2 | 3 | 4 | 5;
export type SclStep = 2 | 3 | 4 | 5;
export type StratumGroup = "MANAGEMENT" | "SUPERVISORY" | "FIELD";

// ---------------------------------------------------------------------------
// Parameter (dibaca dari Assessment.parameterSnapshot, bukan dari berkas seed)
// ---------------------------------------------------------------------------

export interface LayerWeights {
  perception: number;
  evidence: number;
  validation: number;
}

export interface AspectParameter {
  code: string;
  /** Poin maksimum tingkat 5; bobot aspek = poin ini dibagi jumlah poin seluruh aspek (18.000). */
  maxPointsStep5: number | null;
  /** Aspek kontekstual (KT) dihitung tetapi tidak masuk indeks organisasi. */
  excludedFromLevel: boolean;
}

export interface SclThreshold {
  step: SclStep;
  minWeightedAverage: number;
  minPerAspect: number;
}

export interface EngineParameters {
  layerWeights: LayerWeights;
  selfAssessmentWeightInPerception: number;
  divergenceThreshold: number;
  consolidation: {
    maxAspectBelowLevel: number;
    maxCharacteristicBelowLevel: number;
  };
  perceptionGapAttention: number;
  assessorDisagreementFlag: number;
  aspects: AspectParameter[];
  sclThresholds: SclThreshold[];
  minRespondentsPerReportCell: number;
}

// ---------------------------------------------------------------------------
// Masukan
// ---------------------------------------------------------------------------

/** Nilai tiga lapisan per karakteristik yang sudah dihitung. */
export interface CharacteristicInput {
  code: string;
  aspectCode: string;
  isContextual: boolean;
  perception: number | null;
  evidence: number | null;
  validation: number | null;
  /** PanelAdjustment.adjustedValue bila ada. */
  panelAdjusted?: number | null;
  /** Tanda dari lapisan bukti (PENILAI_TUNGGAL, PERLU_REKONSILIASI). */
  flags?: Flag[];
}

/** Persentase pemenuhan per aspek per tingkat, rentang 0 sampai 1. */
export type SclFulfillment = Record<string, Record<SclStep, number>>;

export interface EngineInput {
  characteristics: CharacteristicInput[];
  targetLevel: number;
  sclFulfillment?: SclFulfillment;
}

export interface CharacteristicDefinition {
  code: string;
  aspectCode: string;
  isContextual: boolean;
}

export interface StratumInput {
  code: string;
  group: StratumGroup;
  population: number;
}

/** Satu respons survei anonim. Jawaban null berarti "Tidak tahu". */
export interface SurveyResponseInput {
  stratumCode: string;
  excluded?: boolean;
  characteristicAnswers: Record<string, number | null>;
}

export interface SelfAssessmentInput {
  status: "DRAFT" | "SUBMITTED";
  answers: Record<string, number | null>;
}

export interface EvidenceRatingInput {
  characteristicCode: string;
  assessorId: string;
  level: number;
}

export interface ValidationRatingInput {
  sessionId: string;
  characteristicCode: string;
  assessorId: string;
  level: number;
}

/** Data mentah satu asesmen, sudah disaring per organisasi oleh pemanggil. */
export interface RawAssessmentInput {
  characteristics: CharacteristicDefinition[];
  strata: StratumInput[];
  surveyResponses: SurveyResponseInput[];
  selfAssessments: SelfAssessmentInput[];
  evidenceRatings: EvidenceRatingInput[];
  validationRatings: ValidationRatingInput[];
  /** Kode karakteristik ke PanelAdjustment.adjustedValue. */
  panelAdjustments?: Record<string, number>;
  targetLevel: number;
  sclFulfillment?: SclFulfillment;
}

// ---------------------------------------------------------------------------
// Keluaran
// ---------------------------------------------------------------------------

export interface PerceptionResult {
  survey: number | null;
  selfAssessment: number | null;
  perception: number | null;
}

export interface LayerCombination {
  combined: number | null;
  flags: Flag[];
}

export interface CharacteristicScore {
  combined: number | null;
  divergence: number | null;
  final: number | null;
  flags: Flag[];
}

export interface CharacteristicResult {
  code: string;
  aspectCode: string;
  isContextual: boolean;
  perception: number | null;
  evidence: number | null;
  validation: number | null;
  combined: number | null;
  divergence: number | null;
  final: number | null;
  panelAdjusted: number | null;
  flags: Flag[];
}

export interface AspectResult {
  index: number;
  min: number;
  weight: number;
  gapToTarget: number;
}

export interface OrganizationResult {
  index: number;
  indicativeLevel: Level;
  consolidated: boolean;
  minAspectIndex: number;
  minCharacteristicIndex: number;
  gapToTarget: number;
  priorityAspect: string;
  contextualIndex: number | null;
}

export interface SclStepResult {
  weightedAverage: number;
  minimum: number;
  thresholdAverage: number;
  thresholdMinimum: number;
  passed: boolean;
}

export interface SclTrackResult {
  steps: Record<SclStep, SclStepResult>;
  indicativeLevel: Level;
}

export interface EngineResult {
  engineVersion: string;
  characteristics: CharacteristicResult[];
  aspects: Record<string, AspectResult>;
  organization: OrganizationResult;
  sclTrack?: SclTrackResult;
}

export interface PerceptionGapResult {
  /** Rata-rata skor survei kelompok MANAGEMENT; null bila disembunyikan. */
  management: number | null;
  /** Rata-rata skor survei kelompok FIELD; null bila disembunyikan. */
  field: number | null;
  /** management dikurangi field; null bila disembunyikan. */
  gap: number | null;
  attention: boolean;
  /** true bila salah satu kelompok memiliki kurang dari batas minimum respons. */
  suppressed: boolean;
  managementResponses: number;
  fieldResponses: number;
}

export class EngineInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineInputError";
  }
}
