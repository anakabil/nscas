import type { useT } from '@/i18n';

const ROMAN = ['I', 'II', 'III', 'IV'];

/** "2026-Q4" menjadi "Triwulan IV 2026". */
export function quarterLabel(key: string, t: ReturnType<typeof useT>): string {
    const [year, q] = key.split('-Q');
    return t('quarterLabel', { q: ROMAN[Number(q) - 1] ?? q, year });
}

/** Tanggal kalender yyyy-mm-dd dalam format bahasa halaman, tanpa bergantung zona waktu peramban. */
export function formatDay(value: string, locale: 'id' | 'en'): string {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`));
}

export const DUE_STYLE: Record<string, string> = {
    overdue: 'bg-destructive/10 text-destructive',
    dueSoon: 'bg-gold/15 text-gold-deep',
    onTrack: 'bg-success/10 text-success',
    closed: 'bg-muted text-muted-foreground',
};
