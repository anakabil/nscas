// Usulan pembagian sesi validasi dari hasil kalkulator sampel (docs/03 bagian 7): wawancara individual untuk
// strata MANAGEMENT dan SUPERVISORY sebanyak wawancara minimum manajemen dan staf; diskusi kelompok terarah
// untuk strata SUPERVISORY dan FIELD sebanyak wawancara minimum pekerja operasional, maksimal 8 peserta per
// sesi; serta kunjungan virtual sebanyak proyek yang dikunjungi. Murni.

export type StratumGroup = "MANAGEMENT" | "SUPERVISORY" | "FIELD";

export interface ProposalStratum {
  id: string;
  code: string;
  group: StratumGroup;
  population: number;
}

export interface ProposalInput {
  interviewsManagement: number;
  interviewsOperational: number;
  projectsToVisit: number;
  strata: ProposalStratum[];
  maxParticipantsPerSession: number;
}

export interface ProposedSession {
  type: "INTERVIEW" | "FOCUS_GROUP" | "VIRTUAL_SITE_VISIT";
  stratumId: string | null;
  stratumCode: string | null;
  layer: StratumGroup;
  participantCount: number;
  /** Nomor urut sesi dalam jenis dan strata yang sama, mulai dari 1. */
  sequence: number;
}

export interface Proposal {
  interviews: { stratumId: string; code: string; count: number }[];
  focusGroups: { stratumId: string; code: string; participants: number; sessions: number }[];
  virtualVisits: number;
  sessions: ProposedSession[];
  /** Kuota yang tidak dapat dibagi karena tidak ada strata yang sesuai atau populasinya kurang. */
  unallocated: { interviews: number; focusGroupParticipants: number };
}

/**
 * Pembagian proporsional dengan metode sisa terbesar, dibatasi populasi tiap strata. Jumlah hasil sama dengan
 * total kecuali total melebihi seluruh populasi; selisihnya dilaporkan sebagai tidak terbagi.
 */
export function allocate(total: number, strata: readonly { id: string; population: number }[]): Map<string, number> {
  const result = new Map(strata.map((s) => [s.id, 0]));
  let remaining = Math.max(0, Math.floor(total));
  let open = strata.filter((s) => s.population > 0);
  while (remaining > 0 && open.length > 0) {
    const weight = open.reduce((sum, s) => sum + s.population, 0);
    const shares = open.map((s) => ({ s, exact: (remaining * s.population) / weight }));
    let given = 0;
    for (const share of shares) {
      const room = share.s.population - (result.get(share.s.id) ?? 0);
      const n = Math.min(Math.floor(share.exact), room);
      result.set(share.s.id, (result.get(share.s.id) ?? 0) + n);
      given += n;
    }
    let left = remaining - given;
    // Sisa dibagikan ke pecahan terbesar; seri diputus menurut populasi lalu urutan masukan.
    const order = [...shares].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)) || b.s.population - a.s.population);
    for (const share of order) {
      if (left === 0) break;
      if ((result.get(share.s.id) ?? 0) < share.s.population) {
        result.set(share.s.id, (result.get(share.s.id) ?? 0) + 1);
        left -= 1;
      }
    }
    // Strata yang sudah penuh keluar dari putaran berikutnya, sehingga perulangan selalu berakhir.
    remaining = left;
    open = open.filter((s) => (result.get(s.id) ?? 0) < s.population);
  }
  return result;
}

/** Peserta dibagi rata ke sesi berkapasitas maksimal: 17 peserta dengan batas 8 menjadi 6, 6, 5. */
export function splitIntoSessions(participants: number, maxPerSession: number): number[] {
  if (participants <= 0) return [];
  const sessions = Math.ceil(participants / Math.max(1, maxPerSession));
  const base = Math.floor(participants / sessions);
  const extra = participants % sessions;
  return Array.from({ length: sessions }, (_, i) => base + (i < extra ? 1 : 0));
}

export function proposeSessions(input: ProposalInput): Proposal {
  const interviewStrata = input.strata.filter((s) => s.group === "MANAGEMENT" || s.group === "SUPERVISORY");
  const focusStrata = input.strata.filter((s) => s.group === "SUPERVISORY" || s.group === "FIELD");
  const interviewAlloc = allocate(input.interviewsManagement, interviewStrata);
  const focusAlloc = allocate(input.interviewsOperational, focusStrata);

  const interviews = interviewStrata.map((s) => ({ stratumId: s.id, code: s.code, count: interviewAlloc.get(s.id) ?? 0 })).filter((x) => x.count > 0);
  const focusGroups = focusStrata
    .map((s) => {
      const participants = focusAlloc.get(s.id) ?? 0;
      return { stratumId: s.id, code: s.code, participants, sessions: splitIntoSessions(participants, input.maxParticipantsPerSession).length };
    })
    .filter((x) => x.participants > 0);

  const sessions: ProposedSession[] = [];
  for (const i of interviews) {
    const group = input.strata.find((s) => s.id === i.stratumId)?.group as StratumGroup;
    for (let n = 1; n <= i.count; n++) sessions.push({ type: "INTERVIEW", stratumId: i.stratumId, stratumCode: i.code, layer: group, participantCount: 1, sequence: n });
  }
  for (const g of focusGroups) {
    const group = input.strata.find((s) => s.id === g.stratumId)?.group as StratumGroup;
    splitIntoSessions(g.participants, input.maxParticipantsPerSession).forEach((count, idx) =>
      sessions.push({ type: "FOCUS_GROUP", stratumId: g.stratumId, stratumCode: g.code, layer: group, participantCount: count, sequence: idx + 1 }),
    );
  }
  for (let n = 1; n <= input.projectsToVisit; n++) sessions.push({ type: "VIRTUAL_SITE_VISIT", stratumId: null, stratumCode: null, layer: "FIELD", participantCount: 0, sequence: n });

  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  return {
    interviews,
    focusGroups,
    virtualVisits: input.projectsToVisit,
    sessions,
    unallocated: {
      interviews: Math.max(0, input.interviewsManagement - sum(interviewAlloc)),
      focusGroupParticipants: Math.max(0, input.interviewsOperational - sum(focusAlloc)),
    },
  };
}

/** Nilai validasi 1,0 sampai 5,0 kelipatan 0,5 (docs/01 M7). */
export function isValidRating(level: number): boolean {
  return Number.isFinite(level) && level >= 1 && level <= 5 && Math.abs(level * 2 - Math.round(level * 2)) < 1e-9;
}

export const RATING_LEVELS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;
