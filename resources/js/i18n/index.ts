import { usePage } from '@inertiajs/react';
import { en } from './en';
import { id } from './id';

// Sistem bahasa antarmuka NSCAS. Seluruh teks tampilan berada di i18n/id (bawaan) dan i18n/en; komponen hanya
// memakai kunci. Server mengirim kunci dan angka, bukan kalimat, sehingga teks tidak tersebar di pengendali.

export type Locale = 'id' | 'en';
type Tree = { [key: string]: string | Tree };

const DICTIONARIES: Record<Locale, Tree> = { id, en };

function lookup(tree: Tree, path: string): string | undefined {
    let node: string | Tree | undefined = tree;
    for (const part of path.split('.')) {
        if (typeof node !== 'object' || node === null) {
            return undefined;
        }
        node = node[part];
    }
    return typeof node === 'string' ? node : undefined;
}

export type Translate = (key: string, values?: Record<string, string | number>) => string;

export function translator(locale: Locale): Translate {
    return (key, values) => {
        // Bahasa Indonesia adalah sumber; kunci yang belum ada di bahasa lain jatuh ke bahasa Indonesia.
        const template = lookup(DICTIONARIES[locale], key) ?? lookup(id, key) ?? key;
        if (!values) {
            return template;
        }
        return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
    };
}

export function useLocale(): Locale {
    const { locale } = usePage<{ locale?: string }>().props;
    return locale === 'en' ? 'en' : 'id';
}

/** Penerjemah untuk bahasa halaman saat ini. */
export function useT(): Translate {
    return translator(useLocale());
}

/** Tanggal panjang, misalnya "19 November 2026". */
export function formatDate(value: string, locale: Locale): string {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`));
}
