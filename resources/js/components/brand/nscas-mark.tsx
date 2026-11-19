import { useId } from 'react';
import { cn } from '@/lib/utils';

// Logo NSCAS v2 "Dial Lima Busur" (docs/11 bagian 3).
// Gagasan: NSCAS adalah instrumen ukur, sehingga logonya meminjam bahasa dial kronometer.
//   - Lima busur pada lengkung 270 derajat: lima tingkat kematangan budaya K3, dibaca searah jarum jam.
//   - Empat busur perak yang makin terang, busur kelima emas: tujuan, yaitu budaya yang matang.
//   - Garis skala halus di luar busur: ketelitian pengukuran.
//   - Monogram N berserif di tengah: Nusa Safety sebagai pemilik metode.
// Sengaja bukan tangga, segel, medali, atau pita, agar tidak dikira tanda sertifikasi (CLAUDE.md aturan 8).

const CENTER = 60;

function point(radius: number, degrees: number): [number, number] {
    const angle = (degrees * Math.PI) / 180;
    return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)];
}

/** Lima busur sama panjang dengan celah tetap, mulai dari kiri bawah (135 derajat) searah jarum jam. */
function arcs(radius: number, gap = 7, sweep = 270, start = 135): string[] {
    const length = (sweep - 4 * gap) / 5;
    return Array.from({ length: 5 }, (_, index) => {
        const from = start + index * (length + gap);
        const [x0, y0] = point(radius, from);
        const [x1, y1] = point(radius, from + length);
        return `M${x0.toFixed(3)} ${y0.toFixed(3)} A${radius} ${radius} 0 0 1 ${x1.toFixed(3)} ${y1.toFixed(3)}`;
    });
}

/** Garis skala: 61 garis pada lengkung yang sama, setiap garis kedua belas lebih panjang. */
function ticks(inner = 52.5, outer = 55.5, count = 60, start = 135, sweep = 270): string {
    return Array.from({ length: count + 1 }, (_, index) => {
        const degrees = start + (sweep * index) / count;
        const [x0, y0] = point(inner - (index % 12 === 0 ? 1.2 : 0), degrees);
        const [x1, y1] = point(outer, degrees);
        return `M${x0.toFixed(2)} ${y0.toFixed(2)}L${x1.toFixed(2)} ${y1.toFixed(2)}`;
    }).join('');
}

// Monogram N bergaya didone: batang tipis, diagonal tebal, kait halus.
const MONOGRAM =
    'M45.2 42.6h7.0L71.6 70.3V44.2c0-.9-.5-1.3-1.5-1.4l-1.4-.1v-.9h8.1v.9l-1.4.1c-1 .1-1.5.5-1.5 1.4v33.5h-1.5L49.3 46.9v28.6c0 .9.5 1.3 1.5 1.4l1.4.1v.9h-8.1v-.9l1.4-.1c1-.1 1.5-.5 1.5-1.4V44.9l-1.2-1.4z';

const SILVER = {
    // Di bidang gelap perak makin terang; di bidang terang makin gelap, agar busur keempat tetap paling kuat.
    dark: ['#8d9299', '#a7acb3', '#c3c7cc', '#e2e4e7'],
    light: ['#b9bdc3', '#9a9fa6', '#7b8087', '#5b6067'],
} as const;

const ARCS = arcs(44);
const TICKS = ticks();

type Props = {
    /** dark: untuk bidang gelap (tinta putih). light: untuk bidang terang (tinta hitam). */
    tone?: 'dark' | 'light';
    /** Garis skala dihilangkan pada ukuran kecil agar tidak menjadi noda. */
    detailed?: boolean;
    className?: string;
};

/** Simbol logo NSCAS. Hiasan (aria-hidden): nama aplikasi selalu tertulis di sebelahnya. */
export function NscasMark({ tone = 'dark', detailed = false, className }: Props) {
    const gradient = useId();
    const ink = tone === 'dark' ? '#f4f4f5' : '#111113';
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 120 120"
            aria-hidden
            focusable="false"
            className={cn('h-auto shrink-0', className)}
            data-brand="nscas-mark"
        >
            <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#f3dfa2" />
                    <stop offset="0.45" stopColor="#d4af37" />
                    <stop offset="1" stopColor="#9c7a1e" />
                </linearGradient>
            </defs>
            {detailed ? <path d={TICKS} stroke={ink} strokeOpacity="0.38" strokeWidth="0.6" fill="none" /> : null}
            {ARCS.map((d, index) => (
                <path
                    key={d}
                    d={d}
                    fill="none"
                    stroke={index === 4 ? `url(#${gradient})` : SILVER[tone][index]}
                    strokeWidth={detailed ? 5.2 : 6.5}
                />
            ))}
            <path d={MONOGRAM} fill={ink} />
        </svg>
    );
}

/**
 * Logo mendatar: simbol, nama NSCAS berhuruf serif dengan jarak lebar, dan baris pengenal. Tulisan berupa teks
 * HTML dengan huruf yang sudah dimuat halaman, bukan bagian gambar, agar tajam dan dapat diterjemahkan.
 */
export function NscasLockup({
    name,
    byline,
    tone = 'dark',
    size = 'md',
    className,
}: {
    name: string;
    byline?: string;
    tone?: 'dark' | 'light';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}) {
    const mark = { sm: 'w-9', md: 'w-12', lg: 'w-20' }[size];
    const title = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl' }[size];
    return (
        <span className={cn('inline-flex items-center gap-3', size === 'lg' && 'gap-5', className)}>
            <NscasMark tone={tone} detailed={size === 'lg'} className={mark} />
            <span className="flex flex-col leading-none">
                <span
                    className={cn(
                        'font-display font-normal tracking-[0.3em]',
                        title,
                        tone === 'dark' ? 'text-white' : 'text-obsidian',
                    )}
                >
                    {name}
                </span>
                {byline ? (
                    <span
                        className={cn(
                            'eyebrow mt-1.5',
                            size === 'sm' && 'text-[0.5625rem]',
                            tone === 'dark' ? 'text-gold' : 'text-gold-deep',
                        )}
                    >
                        {byline}
                    </span>
                ) : null}
            </span>
        </span>
    );
}
