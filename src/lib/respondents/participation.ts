// Perhitungan partisipasi (docs/01 M2). Selalu dari AccessToken.completedAt, tidak pernah dari
// SurveyResponse, agar penghitungan tidak menyentuh tabel jawaban yang anonim (docs/02 bagian 4).
// Modul ini murni; pemuatan data ada di participation-data.ts.

export interface ParticipationInput {
  strata: { id: string; code: string; name: string; population: number }[];
  units: { id: string; name: string; parentId: string | null }[];
  /** Jumlah token survei yang tidak dicabut, per unit dan strata (stratumId null: token kode QR yang belum memilih strata). */
  tokens: { unitId: string; stratumId: string | null; issued: number; completed: number }[];
  roster: { unitId: string; stratumId: string; count: number }[];
  minParticipation: number;
  /** Ambang sel (CLAUDE.md aturan 3): jumlah selesai 1 sampai minCell - 1 tidak ditampilkan. */
  minCell: number;
}

/** Jumlah responden selesai yang aman ditampilkan; null bila disembunyikan karena di bawah ambang sel. */
export interface MaskedCount {
  value: number | null;
  suppressed: boolean;
}

export function maskCount(count: number, minCell: number): MaskedCount {
  return count > 0 && count < minCell ? { value: null, suppressed: true } : { value: count, suppressed: false };
}

export interface StratumParticipation {
  stratumId: string;
  code: string;
  name: string;
  population: number;
  registered: number;
  issued: number;
  completed: MaskedCount;
  /** completed / population; null bila jumlah selesai disembunyikan atau populasi nol. */
  rate: number | null;
  belowMinimum: boolean;
}

export interface UnitParticipation {
  unitId: string;
  name: string;
  parentId: string | null;
  registered: number;
  issued: number;
  completed: MaskedCount;
  /** completed / registered; null bila disembunyikan atau unit tanpa daftar responden (hanya kode QR). */
  rate: number | null;
}

export interface ParticipationSummary {
  strata: StratumParticipation[];
  /** Token kode QR yang sudah diterbitkan tetapi strata belum dipilih (survei belum dimulai). */
  pendingStratumSelection: number;
  units: UnitParticipation[];
  totals: { population: number; registered: number; issued: number; completed: MaskedCount; rate: number | null };
  strataBelowMinimum: number;
}

function sum<T>(rows: readonly T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

export function buildParticipation(input: ParticipationInput): ParticipationSummary {
  const { minCell, minParticipation } = input;

  const strata = input.strata.map((s): StratumParticipation => {
    const tokens = input.tokens.filter((t) => t.stratumId === s.id);
    const completedRaw = sum(tokens, (t) => t.completed);
    const completed = maskCount(completedRaw, minCell);
    const rawRate = s.population > 0 ? completedRaw / s.population : 0;
    return {
      stratumId: s.id,
      code: s.code,
      name: s.name,
      population: s.population,
      registered: sum(input.roster.filter((r) => r.stratumId === s.id), (r) => r.count),
      issued: sum(tokens, (t) => t.issued),
      completed,
      rate: completed.suppressed || s.population <= 0 ? null : rawRate,
      belowMinimum: rawRate < minParticipation,
    };
  });

  const units = input.units.map((u): UnitParticipation => {
    const tokens = input.tokens.filter((t) => t.unitId === u.id);
    const completedRaw = sum(tokens, (t) => t.completed);
    const registered = sum(input.roster.filter((r) => r.unitId === u.id), (r) => r.count);
    const completed = maskCount(completedRaw, minCell);
    return {
      unitId: u.id,
      name: u.name,
      parentId: u.parentId,
      registered,
      issued: sum(tokens, (t) => t.issued),
      completed,
      rate: completed.suppressed || registered === 0 ? null : Math.min(1, completedRaw / registered),
    };
  });

  const population = sum(input.strata, (s) => s.population);
  const completedTotal = sum(input.tokens, (t) => t.completed);
  const totalCompleted = maskCount(completedTotal, minCell);
  return {
    strata,
    pendingStratumSelection: sum(input.tokens.filter((t) => t.stratumId === null), (t) => t.issued - t.completed),
    units,
    totals: {
      population,
      registered: sum(input.roster, (r) => r.count),
      issued: sum(input.tokens, (t) => t.issued),
      completed: totalCompleted,
      rate: totalCompleted.suppressed || population <= 0 ? null : completedTotal / population,
    },
    strataBelowMinimum: strata.filter((s) => s.belowMinimum).length,
  };
}

/** Isi ParticipationSnapshot.data: jumlah mentah agar ambang sel dapat diterapkan saat ditampilkan. */
export interface SnapshotData {
  population: number;
  issued: number;
  completed: number;
  strata: { stratumId: string; completed: number }[];
}

export interface TrendPoint {
  date: string;
  completed: MaskedCount;
  rate: number | null;
}

export function snapshotTrend(rows: { takenOn: Date; data: SnapshotData }[], minCell: number): TrendPoint[] {
  return rows.map((r) => {
    const completed = maskCount(r.data.completed, minCell);
    return {
      date: r.takenOn.toISOString().slice(0, 10),
      completed,
      rate: completed.suppressed || r.data.population <= 0 ? null : r.data.completed / r.data.population,
    };
  });
}
