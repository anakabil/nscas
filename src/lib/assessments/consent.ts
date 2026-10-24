// Templat teks persetujuan responden (docs/04 bagian 8). Dapat disesuaikan sebelum asesmen dikunci.

export const CONSENT_TEMPLATES = {
  id:
    "Survei ini diselenggarakan oleh Nusa Safety atas permintaan {organizationName} untuk mengukur budaya keselamatan dan kesehatan kerja. " +
    "Jawaban Anda tidak dapat dihubungkan dengan identitas Anda. Hasil hanya disajikan secara gabungan untuk kelompok paling sedikit lima orang. " +
    "Data disimpan di pusat data di Indonesia dan dimusnahkan setelah {retentionMonths} bulan. " +
    "Keikutsertaan bersifat sukarela dan Anda dapat berhenti kapan saja. " +
    "Dengan menekan tombol Setuju, Anda menyetujui pemrosesan jawaban sesuai Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.",
  en:
    "This survey is conducted by Nusa Safety at the request of {organizationName} to measure occupational safety and health culture. " +
    "Your answers cannot be linked to your identity. Results are only presented in combined form for groups of at least five people. " +
    "Data is stored in a data centre in Indonesia and destroyed after {retentionMonths} months. " +
    "Participation is voluntary and you may stop at any time. " +
    "By pressing Agree, you consent to the processing of your answers in accordance with Law Number 27 of 2022 on Personal Data Protection.",
} as const;

export function renderConsent(language: keyof typeof CONSENT_TEMPLATES, values: { organizationName: string; retentionMonths: number }): string {
  return CONSENT_TEMPLATES[language]
    .replace("{organizationName}", values.organizationName)
    .replace("{retentionMonths}", String(values.retentionMonths));
}
