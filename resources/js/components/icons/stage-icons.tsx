import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';

// Ikon enam tahap penilaian, gaya dua nada NSCAS v2 (docs/11 bagian 4): garis mengikuti warna teks
// (currentColor), satu unsur kunci berwarna emas. Kisi 24 x 24, garis 1,5, ujung membulat.
// Ikon bersifat hiasan; nama tahap selalu tertulis di sebelahnya.

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { accent?: string };

function Frame({ className, accent: _accent, children, ...props }: IconProps & { children: React.ReactNode }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            focusable="false"
            className={cn('size-6 shrink-0', className)}
            {...props}
        >
            {children}
        </svg>
    );
}

const GOLD = 'var(--gold)';

/** 1. Perencanaan: jangka. Mengukur dan menetapkan lingkup sebelum bekerja. Emas: poros jangka. */
export function StagePlanning({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M11.1 6.6 6.4 20M12.9 6.6 17.6 20" />
            <path d="M5 16.2c4.2 2.9 9.8 2.9 14 0" />
            <path d="M12 2.2v1.3" />
            <circle cx="12" cy="5.2" r="1.7" stroke={accent} fill={accent} fillOpacity="0.25" />
        </Frame>
    );
}

/** 2. Pengumpulan data: lapisan yang terhimpun. Tiga sumber data bertumpuk. Emas: lapisan teratas. */
export function StageCollection({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="m3.5 12.4 8.5 4.3 8.5-4.3" />
            <path d="m3.5 16.3 8.5 4.3 8.5-4.3" />
            <path d="M12 3.4 20.5 7.7 12 12 3.5 7.7Z" stroke={accent} fill={accent} fillOpacity="0.18" />
        </Frame>
    );
}

/** 3. Validasi dan triangulasi: tiga titik yang saling menguji. Emas: titik puncak, tempat temuan bertemu. */
export function StageValidation({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M10.9 6.9 6.2 16.2M13.1 6.9l4.7 9.3M7.6 18.4h8.8" />
            <circle cx="5.2" cy="18.4" r="2.2" />
            <circle cx="18.8" cy="18.4" r="2.2" />
            <circle cx="12" cy="5" r="2.2" stroke={accent} fill={accent} fillOpacity="0.25" />
        </Frame>
    );
}

/** 4. Penilaian dan penetapan: timbangan seimbang. Dua asesor, satu ketetapan. Emas: poros timbangan. */
export function StageRating({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M12 6.4V20.5M8 20.5h8M4.6 8h14.8" />
            <path d="M4.6 8 2.4 13.6a2.5 2.5 0 0 0 4.4 0Z" />
            <path d="m19.4 8-2.2 5.6a2.5 2.5 0 0 0 4.4 0Z" />
            <circle cx="12" cy="4.6" r="1.7" stroke={accent} fill={accent} fillOpacity="0.25" />
        </Frame>
    );
}

/** 5. Pelaporan dan rencana aksi: lembar laporan dengan batang hasil. Emas: batang hasil yang naik. */
export function StageReporting({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M6 2.8h8.2L18.5 7v14.2H6Z" />
            <path d="M14 2.8V7.2h4.5" />
            <path d="M9.3 17.6v-2.4M12.2 17.6v-4.8M15.1 17.6v-7" stroke={accent} strokeWidth={1.8} />
        </Frame>
    );
}

/** 6. Pemantauan dan perbaikan: siklus yang berputar. Emas: titik pusat, yaitu perbaikan yang dijaga. */
export function StageMonitoring({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M19.6 10.4A7.8 7.8 0 0 0 5.9 7.1M4.4 13.6a7.8 7.8 0 0 0 13.7 3.3" />
            <path d="M5.6 3.4v3.9h3.9M18.4 20.6v-3.9h-3.9" />
            <circle cx="12" cy="12" r="1.9" stroke={accent} fill={accent} fillOpacity="0.25" />
        </Frame>
    );
}

export const STAGE_ICONS = {
    PLANNING: StagePlanning,
    DATA_COLLECTION: StageCollection,
    VALIDATION: StageValidation,
    RATING: StageRating,
    REPORTING: StageReporting,
    MONITORING: StageMonitoring,
} as const;

export type StageKey = keyof typeof STAGE_ICONS;
