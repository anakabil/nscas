import { cn } from '@/lib/utils';

// Logo NSCAS milik Nusa Safety (docs/11 bagian 3), diserahkan pemilik merek pada 19 November 2026.
//   - Perisai dua warna, marun dan hitam: perlindungan pekerja dan organisasi.
//   - Lima anak tangga emas yang naik di dalam perisai: lima tingkat kematangan budaya K3.
//   - Lekuk marun di bawah tangga: dukungan yang menopang pertumbuhan.
//   - Tulisan NSCAS hitam tebal dan nama lengkap berwarna marun.
// Berkas di public/brand adalah hasil penelusuran vektor dari berkas asli resources/brand/nscas-logo-source.webp
// (skrip di scripts/brand). Logo dimuat sebagai gambar SVG statis agar tersimpan di tembolok peramban dan tidak
// menambah ukuran kode halaman.

type Tone = 'color' | 'reversed';

const MARK = { color: '/brand/nscas-mark.svg', reversed: '/brand/nscas-mark-reversed.svg' } as const;
const LOCKUP = { color: '/brand/nscas-lockup.svg', reversed: '/brand/nscas-lockup-reversed.svg' } as const;
const LOGO = { color: '/brand/nscas-logo.svg', reversed: '/brand/nscas-logo-reversed.svg' } as const;

// Perbandingan lebar dan tinggi kotak gambar, agar ruang tersedia sebelum gambar dimuat (tanpa pergeseran tata letak).
const MARK_RATIO = 502 / 569;
const LOCKUP_RATIO = 1674 / 569;

/** Simbol perisai saja. Hiasan bila `label` kosong; nama aplikasi harus tertulis di dekatnya. */
export function NscasMark({ tone = 'color', label, className }: { tone?: Tone; label?: string; className?: string }) {
    return (
        <img
            src={MARK[tone]}
            alt={label ?? ''}
            aria-hidden={label ? undefined : true}
            width={Math.round(64 * MARK_RATIO)}
            height={64}
            decoding="async"
            className={cn('h-auto shrink-0 select-none', className)}
            data-brand="nscas-mark"
            draggable={false}
        />
    );
}

/**
 * Logo lengkap: simbol dan tulisan NSCAS. `tagline` menambahkan nama lengkap di bawah tulisan; pakai hanya bila
 * lebar logo paling sedikit 280 piksel agar nama lengkap tetap terbaca. `tone="reversed"` untuk bidang marun atau
 * hitam: perisai dan tulisan menjadi krem, tangga tetap emas.
 */
export function NscasLockup({
    label,
    tone = 'color',
    tagline = false,
    className,
}: {
    label: string;
    tone?: Tone;
    tagline?: boolean;
    className?: string;
}) {
    return (
        <img
            src={(tagline ? LOGO : LOCKUP)[tone]}
            alt={label}
            width={Math.round(48 * LOCKUP_RATIO)}
            height={48}
            decoding="async"
            className={cn('h-auto shrink-0 select-none', className)}
            data-brand="nscas-lockup"
            draggable={false}
        />
    );
}
