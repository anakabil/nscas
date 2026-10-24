import "server-only";

// Cache isi instrumen per proses untuk rute survei (docs/07: uji beban 300 pengisian serentak). Aman karena survei
// hanya terbuka setelah asesmen dikunci, dan versi instrumen yang sudah dipakai asesmen tidak dapat diubah
// (CLAUDE.md aturan 5, prisma/seeding.ts). Batas umur tetap dipasang agar perbaikan teks sebelum dipakai ikut terbaca.

const TTL_MS = 5 * 60_000;
const entries = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

export function cachedByKey<T>(key: string, load: () => Promise<T>, now: number = Date.now()): Promise<T> {
  const hit = entries.get(key);
  if (hit && hit.expiresAt > now) return hit.value as Promise<T>;
  const value = load();
  entries.set(key, { expiresAt: now + TTL_MS, value });
  // Pemuatan yang gagal tidak disimpan, agar permintaan berikutnya mencoba lagi.
  value.catch(() => {
    if (entries.get(key)?.value === value) entries.delete(key);
  });
  return value;
}

export function clearInstrumentCache(): void {
  entries.clear();
}
