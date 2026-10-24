// Peran dan matriks hak akses (docs/04 bagian 2). Matriks ditulis sebagai data agar dapat diuji
// dan dipakai langsung oleh requireRole. Catatan dalam kurung di docs/04 (misalnya "unitnya",
// "miliknya", "tanpa identitas") ditegakkan oleh guard (cakupan unit) dan oleh kueri tiap fitur.

import type { Role } from "@/generated/prisma/enums";

export const ALL_ROLES = [
  "SUPER_ADMIN",
  "LEAD_ASSESSOR",
  "ASSESSOR",
  "CLIENT_ADMIN",
  "UNIT_COORDINATOR",
  "EXECUTIVE_VIEWER",
] as const satisfies readonly Role[];

/** Peran milik Nusa Safety; hanya sah sebagai keanggotaan di organisasi operator. */
export const OPERATOR_ROLES = ["SUPER_ADMIN", "LEAD_ASSESSOR", "ASSESSOR"] as const satisfies readonly Role[];

/** Peran milik klien; hanya sah sebagai keanggotaan di organisasi klien. */
export const CLIENT_ROLES = ["CLIENT_ADMIN", "UNIT_COORDINATOR", "EXECUTIVE_VIEWER"] as const satisfies readonly Role[];

/** TOTP wajib (docs/04 bagian 3). */
export const TOTP_REQUIRED_ROLES = ["SUPER_ADMIN", "LEAD_ASSESSOR", "ASSESSOR", "CLIENT_ADMIN"] as const satisfies readonly Role[];

/** Batas 30 menit tidak aktif berlaku untuk peran Nusa Safety (docs/04 bagian 3). */
export const IDLE_TIMEOUT_ROLES = OPERATOR_ROLES;

export function isOperatorRole(role: Role): boolean {
  return (OPERATOR_ROLES as readonly Role[]).includes(role);
}

export function isClientRole(role: Role): boolean {
  return (CLIENT_ROLES as readonly Role[]).includes(role);
}

/** Keanggotaan sah bila peran operator berada di organisasi operator dan peran klien di organisasi klien. */
export function isValidMembership(role: Role, organizationIsOperator: boolean): boolean {
  return organizationIsOperator ? isOperatorRole(role) : isClientRole(role);
}

const SA = "SUPER_ADMIN";
const LA = "LEAD_ASSESSOR";
const AS = "ASSESSOR";
const CA = "CLIENT_ADMIN";
const UC = "UNIT_COORDINATOR";
const EV = "EXECUTIVE_VIEWER";

/**
 * Matriks docs/04 bagian 2. "read" berisi peran dengan hak B atau U; "write" berisi peran dengan hak U.
 * UNIT_COORDINATOR selalu dibatasi ke unitnya oleh guard.
 */
export const PERMISSIONS = {
  organizationsAndUsers: { read: [SA, LA, CA], write: [SA, CA] }, // CA: pengguna klien di organisasinya
  parametersBeforeLock: { read: [SA, LA, AS, CA], write: [LA] },
  parametersAfterLock: { read: [SA, LA, AS, CA, EV], write: [] },
  roster: { read: [LA, CA, UC], write: [CA, UC] },
  tokensAndParticipation: { read: [SA, LA, AS, CA, UC, EV], write: [CA] }, // EV: agregat saja
  rawSurveyAnswers: { read: [LA, AS], write: [] }, // tanpa identitas
  selfAssessments: { read: [LA, AS, CA], write: [] },
  evidenceAndObservations: { read: [LA, AS, CA, UC], write: [CA, UC] },
  assessorRatings: { read: [LA, AS], write: [LA, AS] }, // AS: miliknya
  panelAndFinalization: { read: [LA, AS], write: [LA] },
  resultsDashboard: { read: [LA, AS, CA, UC, EV], write: [] }, // UC: unitnya, setelah final
  actionPlans: { read: [LA, AS, CA, UC, EV], write: [LA, AS, CA, UC] },
  reports: { read: [LA, AS, CA, EV], write: [LA] },
  auditTrail: { read: [SA, LA, CA], write: [] }, // LA dan CA: asesmennya; CA tanpa data mentah
} as const satisfies Record<string, { read: readonly Role[]; write: readonly Role[] }>;

export type Resource = keyof typeof PERMISSIONS;

export function rolesFor(resource: Resource, mode: "read" | "write"): readonly Role[] {
  return PERMISSIONS[resource][mode];
}

/** Peran yang boleh diberikan oleh pelaku, sesuai jenis organisasi tujuan. */
export function grantableRoles(actor: { isSuperAdmin: boolean; isClientAdminOfTarget: boolean }, targetIsOperator: boolean): Role[] {
  if (actor.isSuperAdmin) return targetIsOperator ? [...OPERATOR_ROLES] : [...CLIENT_ROLES];
  if (actor.isClientAdminOfTarget && !targetIsOperator) return [...CLIENT_ROLES];
  return [];
}

// Di luar matriks docs/04 bagian 2 (matriks itu tidak memuat pembuatan asesmen dan tim asesor):
/** Membuat asesmen: lead assessor Nusa Safety, yang otomatis menjadi asesor utama asesmen tersebut. */
export const ASSESSMENT_CREATE_ROLES = ["LEAD_ASSESSOR"] as const satisfies readonly Role[];
/** Tim asesor: dilihat staf Nusa Safety yang terkait, diubah SUPER_ADMIN atau asesor utama yang ditugaskan. */
export const ASSESSMENT_TEAM_ROLES = {
  read: ["SUPER_ADMIN", "LEAD_ASSESSOR", "ASSESSOR"],
  write: ["SUPER_ADMIN", "LEAD_ASSESSOR"],
} as const satisfies { read: readonly Role[]; write: readonly Role[] };
/**
 * Jendela survei (tanggal buka dan tutup): diatur asesor utama atau administrator klien. Tidak termasuk
 * parameter terkunci (CLAUDE.md aturan 5) karena jadwal lapangan dapat bergeser selama pengumpulan data.
 */
export const SURVEY_WINDOW_WRITE_ROLES = ["LEAD_ASSESSOR", "CLIENT_ADMIN"] as const satisfies readonly Role[];
/** Jendela observasi dibuat asesor Nusa Safety yang ditugaskan (docs/01 M6). */
export const OBSERVATION_WINDOW_WRITE_ROLES = ["LEAD_ASSESSOR", "ASSESSOR"] as const satisfies readonly Role[];
/**
 * Validasi daring (docs/01 M7): dijalankan asesor Nusa Safety. Asesor utama menjadwalkan sesi dan mengubah
 * templat panduan; asesor yang ditugaskan mengisi nilai miliknya sendiri (sejalan dengan baris "Nilai asesor").
 */
export const VALIDATION_ROLES = {
  read: ["LEAD_ASSESSOR", "ASSESSOR"],
  schedule: ["LEAD_ASSESSOR"],
  rate: ["LEAD_ASSESSOR", "ASSESSOR"],
} as const satisfies Record<string, readonly Role[]>;
/**
 * Penilaian asesor dan rapat panel (docs/01 M8, baris "Nilai asesor" dan "Penyesuaian panel dan finalisasi"):
 * setiap asesor mengisi nilai buktinya sendiri; asesor utama mengisi jalur setara Safety Culture Ladder,
 * menjalankan mesin, menyesuaikan nilai di rapat panel, dan menetapkan hasil.
 */
export const SCORING_ROLES = {
  read: ["LEAD_ASSESSOR", "ASSESSOR"],
  rate: ["LEAD_ASSESSOR", "ASSESSOR"],
  scl: ["LEAD_ASSESSOR"],
  run: ["LEAD_ASSESSOR"],
  panelRead: ["LEAD_ASSESSOR", "ASSESSOR"],
  panelWrite: ["LEAD_ASSESSOR"],
} as const satisfies Record<string, readonly Role[]>;
/**
 * Dasbor hasil (docs/04 baris "Dasbor hasil"): pembaca menurut matriks, dengan koordinator unit dan pimpinan
 * eksekutif dibatasi oleh layanan dasbor (unitnya, setelah final; ringkasan dan grafik, setelah final).
 * Panel mutu data berisi agregat; daftar jawaban bertanda dan tombol keluarkan atau pulihkan hanya untuk asesor
 * (baris "Jawaban survei mentah").
 */
export const DASHBOARD_ROLES = {
  read: ["LEAD_ASSESSOR", "ASSESSOR", "CLIENT_ADMIN", "UNIT_COORDINATOR", "EXECUTIVE_VIEWER"],
  quality: ["LEAD_ASSESSOR", "ASSESSOR", "CLIENT_ADMIN"],
  exclude: ["LEAD_ASSESSOR", "ASSESSOR"],
  export: ["LEAD_ASSESSOR", "ASSESSOR", "CLIENT_ADMIN"],
} as const satisfies Record<string, readonly Role[]>;
