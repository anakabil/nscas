/** Keadaan formulir yang dikembalikan Server Action ke useActionState. Kode dipetakan ke teks next-intl di klien. */
export interface ActionState {
  error?: string;
  success?: string;
  /** Nilai yang hanya ditampilkan sekali, misalnya kata sandi sementara atau kode cadangan. */
  secrets?: string[];
  /** Rincian galat, misalnya kode syarat transisi yang belum terpenuhi. */
  details?: string[];
}

export const initialActionState: ActionState = {};
