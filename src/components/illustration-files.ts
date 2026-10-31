// Berkas ilustrasi NSCAS di public/illustrations (docs/11 bagian 4). Modul data tanpa next/image, agar halaman yang
// dimuat di setiap rute (misalnya not-found) dapat memakainya tanpa ikut mengirim komponen gambar ke peramban.

export const ILLUSTRATIONS = {
  "empty-start": { src: "/illustrations/empty-start.png", width: 800, height: 600 },
  "empty-respondents": { src: "/illustrations/empty-respondents.png", width: 800, height: 600 },
  "empty-evidence": { src: "/illustrations/empty-evidence.png", width: 800, height: 600 },
  "empty-observations": { src: "/illustrations/empty-observations.png", width: 800, height: 600 },
  "empty-report": { src: "/illustrations/empty-report.png", width: 800, height: 600 },
  "empty-action-plan": { src: "/illustrations/empty-action-plan.png", width: 800, height: 600 },
  "state-forbidden": { src: "/illustrations/state-forbidden.png", width: 800, height: 600 },
  "state-not-found": { src: "/illustrations/state-not-found.png", width: 800, height: 600 },
  "phase-preparation": { src: "/illustrations/phase-preparation.png", width: 640, height: 480 },
  "phase-data-collection": { src: "/illustrations/phase-data-collection.png", width: 640, height: 480 },
  "phase-scoring": { src: "/illustrations/phase-scoring.png", width: 640, height: 480 },
  "phase-results": { src: "/illustrations/phase-results.png", width: 640, height: 480 },
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;
