// Penyembunyian sel laporan dengan kurang dari 5 responden (CLAUDE.md aturan 3, docs/04). Murni.
//
// Penyembunyian primer: sel dengan 1 sampai min - 1 responden tidak menampilkan nilai maupun jumlahnya.
// Penyembunyian pelengkap: bila agregat sekelompok sel ikut diterbitkan (misalnya rata-rata kelompok manajemen
// pada kesenjangan persepsi), satu sel tersembunyi dapat dihitung balik dari agregat dan sel lain yang tampil.
// Karena itu, bila dalam satu kelompok hanya satu sel yang tersembunyi, sel tampil dengan responden paling
// sedikit ikut disembunyikan. Diulang sampai tidak ada kelompok yang tersisa dengan tepat satu sel tersembunyi.

export type CellState = "visible" | "suppressed" | "secondary" | "empty";

export interface CellInput {
  key: string;
  value: number | null;
  /** Jumlah responden yang membentuk nilai sel. */
  n: number;
}

export interface SafeCell {
  key: string;
  /** Null bila sel kosong atau disembunyikan. */
  value: number | null;
  /** Null bila sel disembunyikan, agar jumlah kecil tidak terbaca. */
  n: number | null;
  state: CellState;
}

const hidden = (state: CellState) => state === "suppressed" || state === "secondary";

/**
 * Jumlah responden diperiksa lebih dulu: sel dengan 1 sampai min - 1 responden selalu disembunyikan, juga bila
 * nilainya tidak dapat dihitung, agar jumlah kecil itu sendiri tidak terbaca.
 */
export function primaryState(value: number | null, n: number, min: number): CellState {
  if (n <= 0) return "empty";
  if (n < min) return "suppressed";
  return value === null ? "empty" : "visible";
}

/** Satu nilai tunggal (misalnya alfa Cronbach atau rwg satu unit) yang dibentuk dari n responden. */
export function suppressValue(value: number | null, n: number, min: number): SafeCell {
  const state = primaryState(value, n, min);
  return { key: "", value: state === "visible" ? value : null, n: hidden(state) ? null : n, state };
}

/**
 * Sekumpulan sel dengan kelompok yang agregatnya diterbitkan di tempat lain. Mengembalikan sel dalam urutan
 * masukan; nilai dan jumlah sel tersembunyi dikosongkan.
 */
export function suppressCells(cells: readonly CellInput[], min: number, groups: readonly (readonly string[])[] = []): SafeCell[] {
  const state = new Map(cells.map((c) => [c.key, primaryState(c.value, c.n, min)]));
  const n = new Map(cells.map((c) => [c.key, c.n]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const group of groups) {
      const members = group.filter((k) => state.has(k));
      const hiddenCount = members.filter((k) => hidden(state.get(k) as CellState)).length;
      const visible = members.filter((k) => state.get(k) === "visible");
      if (hiddenCount === 1 && visible.length > 0) {
        const smallest = visible.reduce((a, b) => ((n.get(b) ?? 0) < (n.get(a) ?? 0) ? b : a));
        state.set(smallest, "secondary");
        changed = true;
      }
    }
  }
  return cells.map((c) => {
    const s = state.get(c.key) as CellState;
    return { key: c.key, value: s === "visible" ? c.value : null, n: hidden(s) ? null : c.n, state: s };
  });
}

/** Pemeriksaan untuk tes dan ekspor: setiap nilai yang tampil berasal dari paling sedikit min responden. */
export function allVisibleMeetMinimum(cells: readonly SafeCell[], min: number): boolean {
  return cells.every((c) => c.value === null || (c.n !== null && c.n >= min));
}
