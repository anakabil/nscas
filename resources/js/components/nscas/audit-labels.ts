import type { Translate } from '@/i18n';

/** Label aksi jejak audit dari teks antarmuka; kode aksi ditampilkan apa adanya bila belum berlabel. */
export function actionLabel(t: Translate, action: string): string {
    const key = `auditActions.${action}`;
    const label = t(key);
    return label === key ? action : label;
}

/** Label kategori (awalan kode aksi). */
export function categoryLabel(t: Translate, category: string): string {
    const key = `auditCategories.${category}`;
    const label = t(key);
    return label === key ? category : label;
}
