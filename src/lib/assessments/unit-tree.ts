// Struktur unit bertingkat (kantor pusat, divisi, proyek, cabang).

export interface UnitNode {
  id: string;
  parentId: string | null;
  name: string;
}

/** Urutan tampilan pohon: induk lalu anak-anaknya (urut nama), dengan kedalaman. Unit yatim ditaruh di akar. */
export function flattenUnitTree<T extends UnitNode>(units: readonly T[]): (T & { depth: number })[] {
  const ids = new Set(units.map((u) => u.id));
  const children = new Map<string | null, T[]>();
  for (const u of units) {
    const parent = u.parentId && ids.has(u.parentId) ? u.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), u]);
  }
  for (const list of children.values()) list.sort((a, b) => a.name.localeCompare(b.name, "id"));

  const out: (T & { depth: number })[] = [];
  const visited = new Set<string>();
  const visit = (parent: string | null, depth: number) => {
    for (const u of children.get(parent) ?? []) {
      if (visited.has(u.id)) continue;
      visited.add(u.id);
      out.push({ ...u, depth });
      visit(u.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}

/** true bila menjadikan newParentId induk unitId akan membentuk siklus (termasuk menjadi induk dirinya sendiri). */
export function wouldCreateCycle(units: readonly UnitNode[], unitId: string, newParentId: string | null): boolean {
  const parentOf = new Map(units.map((u) => [u.id, u.parentId]));
  let current = newParentId;
  const seen = new Set<string>();
  while (current) {
    if (current === unitId) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    current = parentOf.get(current) ?? null;
  }
  return false;
}
