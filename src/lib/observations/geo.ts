// Perhitungan jarak titik observasi ke titik proyek (docs/01 M6). Murni.

const EARTH_RADIUS_METERS = 6_371_008.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Jarak lingkaran besar (haversine) dalam meter. */
export function haversineMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface RadiusCheck {
  distanceMeters: number | null;
  /** Ditandai bila titik berada di luar radius; lokasi yang tidak tersedia tidak dianggap di luar radius. */
  outsideRadius: boolean;
}

export function checkRadius(
  site: { latitude: number; longitude: number; radiusMeters: number },
  point: { latitude: number; longitude: number } | null,
): RadiusCheck {
  if (!point) return { distanceMeters: null, outsideRadius: false };
  const distanceMeters = haversineMeters(site, point);
  return { distanceMeters, outsideRadius: distanceMeters > site.radiusMeters };
}

export interface ChecklistItem {
  code: string;
  label: string;
}

/** Daftar periksa observasi dari isian satu butir per baris; kode O1, O2, dan seterusnya. */
export function parseChecklist(text: string): ChecklistItem[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 50)
    .map((label, i) => ({ code: `O${i + 1}`, label: label.slice(0, 300) }));
}
