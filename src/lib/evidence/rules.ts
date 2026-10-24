// Aturan murni bukti (docs/01 M5): daftar periksa per karakteristik dan jumlah jenis bukti.

/** Bawaan quality.minEvidenceTypesPerCharacteristic di seed. */
export const DEFAULT_MIN_EVIDENCE_TYPES = 2;

export interface ChecklistInput {
  characteristics: { id: string; code: string; name: string; requirements: { id: string; description: string }[] }[];
  /** Tautan bukti yang berlaku (versi terbaru dan belum dihapus). */
  links: { evidenceItemId: string; characteristicId: string; requirementIds: string[] }[];
  minTypes: number;
}

export interface ChecklistRow {
  characteristicId: string;
  code: string;
  name: string;
  requirements: { id: string; description: string; met: boolean }[];
  evidenceCount: number;
  /** Jenis bukti: butir daftar periksa yang terpenuhi, ditambah satu bila ada bukti yang belum dikaitkan ke butir mana pun. */
  types: number;
  belowMinimum: boolean;
}

export function buildChecklist(input: ChecklistInput): ChecklistRow[] {
  return input.characteristics.map((c) => {
    const links = input.links.filter((l) => l.characteristicId === c.id);
    const metIds = new Set(links.flatMap((l) => l.requirementIds.filter((id) => c.requirements.some((r) => r.id === id))));
    const untyped = links.some((l) => l.requirementIds.every((id) => !c.requirements.some((r) => r.id === id)));
    const types = metIds.size + (untyped ? 1 : 0);
    return {
      characteristicId: c.id,
      code: c.code,
      name: c.name,
      requirements: c.requirements.map((r) => ({ ...r, met: metIds.has(r.id) })),
      evidenceCount: new Set(links.map((l) => l.evidenceItemId)).size,
      types,
      belowMinimum: types < input.minTypes,
    };
  });
}
