// NSCAS memakai satu tema yang dirancang (bingkai gelap, bidang kerja terang; docs/05 bagian 1), tanpa mode
// gelap. Hook ini dipertahankan agar komponen yang menanyakan tema tetap bekerja.

export type ResolvedAppearance = 'light' | 'dark';
export type Appearance = ResolvedAppearance | 'system';

export function useAppearance(): { appearance: Appearance; resolvedAppearance: ResolvedAppearance } {
    return { appearance: 'light', resolvedAppearance: 'light' };
}
