import type { ComponentType, ReactNode, SVGProps } from 'react';
import { cn } from '@/lib/utils';

// Ikon halaman kerja dan menu akun NSCAS v2 (docs/11 bagian 5), satu keluarga dengan ikon enam tahap
// (stage-icons.tsx): kisi 24 x 24 dengan tepi kosong sekitar 2, garis 1,5 mengikuti warna teks (currentColor),
// ujung dan sambungan membulat, tanpa isian kecuali satu unsur kunci berwarna emas dengan isian emas tipis.
// Ikon bersifat hiasan; nama halaman selalu tertulis di sebelahnya.

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { accent?: string };

function Frame({ className, accent: _accent, children, ...props }: IconProps & { children: ReactNode }) {
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

/** Unsur emas berisi: garis emas dengan isian emas tipis. */
function tint(accent: string, opacity = 0.22) {
    return { stroke: accent, fill: accent, fillOpacity: opacity };
}

// Tahap 1, Perencanaan ------------------------------------------------------------------------------

/** M01 Rincian dan lingkup: lembar dokumen dengan bingkai bidik di sudut. Emas: bingkai bidik, lingkup yang ditetapkan. */
export function IconDetails({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M17.5 10.6V7.3L13 2.8H4.5v18.4h5" />
            <path d="M13 2.8v4.5h4.5M7.5 8.8h2.6M7.5 12h5.5M7.5 15.2h1.8" />
            <g stroke={accent}>
                <circle cx="15.8" cy="16.8" r="2.8" fill={accent} fillOpacity={0.2} />
                <path d="M15.8 12.3v3M15.8 18.3v3M11.3 16.8h3M17.3 16.8h3" />
            </g>
        </Frame>
    );
}

/** M02 Unit: penanda lokasi berisi gedung kecil (kantor, lokasi, proyek). Emas: titik penanda di tanah. */
export function IconUnits({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M12 18.6 7.23 12.86A6.2 6.2 0 1 1 16.77 12.86Z" />
            <path d="M8.8 9.2 12 6.4l3.2 2.8M9.7 9.6V12M12 9.6V12M14.3 9.6V12" />
            <ellipse cx="12" cy="20.2" rx="3.6" ry="1.1" {...tint(accent)} />
        </Frame>
    );
}

/** M03 Strata: tiga lapisan piramida datar, jenjang jabatan. Emas: lapisan puncak. */
export function IconStrata({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M7.63 10.2h8.74l1.86 3.6H5.77Z" />
            <path d="M4.85 15.6h14.3l1.85 3.6H3Z" />
            <path d="M10.4 4.8h3.2l1.85 3.6h-6.9Z" {...tint(accent)} />
        </Frame>
    );
}

/** M04 Parameter penilaian: tiga penggeser mendatar, bobot dan ambang. Emas: kenop tengah. */
export function IconParameters({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M3.5 6h9.4M17.1 6h3.4M3.5 12h2.9M10.6 12h9.9M3.5 18h7.4M15.1 18h5.4" />
            <circle cx="15" cy="6" r="2.1" />
            <circle cx="13" cy="18" r="2.1" />
            <circle cx="8.5" cy="12" r="2.1" {...tint(accent, 0.25)} />
        </Frame>
    );
}

/** M05 Kalkulator sampel: lingkaran populasi berisi enam titik, tiga terpilih. Emas: tiga titik sampel. */
export function IconSampling({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <circle cx="12" cy="12" r="9.2" />
            <circle cx="16.5" cy="9.4" r="1.35" />
            <circle cx="12" cy="17.2" r="1.35" />
            <circle cx="7.5" cy="9.4" r="1.35" />
            <g {...tint(accent, 0.25)}>
                <circle cx="12" cy="6.8" r="1" />
                <circle cx="16.5" cy="14.6" r="1" />
                <circle cx="7.5" cy="14.6" r="1" />
            </g>
        </Frame>
    );
}

/** M06 Tim asesor: dua figur setengah badan dengan lencana centang. Emas: lencana, tanda tim yang ditetapkan. */
export function IconTeam({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <circle cx="8.7" cy="7.3" r="3" />
            <path d="M2.7 19.3a6 6 0 0 1 9.9-4.55" />
            <circle cx="16.3" cy="6.5" r="2.4" />
            <circle cx="17.7" cy="16.9" r="3.4" {...tint(accent)} />
            <path d="m16.2 17 1.05 1.05 2-2.2" stroke={accent} />
        </Frame>
    );
}

/** M07 Komunikasi awal: pengeras suara tangan, pesan pimpinan kepada pekerja. Emas: tiga garis suara. */
export function IconKickoff({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M6.4 8.8H4.3a1 1 0 0 0-1 1v4.4a1 1 0 0 0 1 1h2.1Z" />
            <path d="M6.4 8.8 14.2 4.6v14.8l-7.8-4.2" />
            <path d="m8.4 16.3 1.05 3.5" />
            <path d="M17.2 12h3.3M17 8.3l2.7-1.5M17 15.7l2.7 1.5" stroke={accent} />
        </Frame>
    );
}

// Tahap 2, Pengumpulan data --------------------------------------------------------------------------

/** M08 Responden dan undangan: tiga figur pekerja berhelm. Emas: helm figur tengah. */
export function IconRespondents({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M6.6 19.2a5.4 5.4 0 0 1 10.8 0M9.9 9a2.1 2.1 0 0 0 4.2 0" />
            <path d="M2.8 19.2a3.1 3.1 0 0 1 2.28-3.08M3.8 11a2 2 0 0 1 4 0M3.3 11h5" />
            <path d="M21.2 19.2a3.1 3.1 0 0 0-2.28-3.08M16.2 11a2 2 0 0 1 4 0M15.7 11h5" />
            <path d="M8.5 8h7M9.3 8a2.7 2.7 0 0 1 5.4 0Z" {...tint(accent)} />
        </Frame>
    );
}

/** M09 Kode QR: kode QR sederhana dengan tiga persegi sudut. Emas: persegi sudut kiri atas, titik baca. */
export function IconQr({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <rect x="14.25" y="3.25" width="6.5" height="6.5" rx="1.2" />
            <rect x="3.25" y="14.25" width="6.5" height="6.5" rx="1.2" />
            <path d="M16.9 5.9h1.2v1.2h-1.2ZM5.9 16.9h1.2v1.2H5.9Z" />
            <path d="M12 3.6v2.2M12 9v3h-3M14.6 13.4h2.2M20.4 13.4v.01M12 15.4v5M15.6 17.2h2.6v3.2M20.6 17.6v2.8" />
            <g stroke={accent}>
                <rect x="3.25" y="3.25" width="6.5" height="6.5" rx="1.2" fill={accent} fillOpacity={0.2} />
                <path d="M5.9 5.9h1.2v1.2H5.9Z" />
            </g>
        </Frame>
    );
}

/** M10 Partisipasi: garis tren naik dengan figur kecil di puncak. Emas: titik puncak, partisipasi tertinggi. */
export function IconParticipation({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M5.29 19.15 9.91 15.75M11.86 14.8l4.8-1.39" />
            <circle cx="4.4" cy="19.8" r="1.1" />
            <circle cx="10.8" cy="15.1" r="1.1" />
            <circle cx="18.1" cy="4.1" r="1.4" />
            <path d="M15.8 9.6a2.3 2.3 0 0 1 4.6 0" />
            <circle cx="18.1" cy="13" r="1.5" {...tint(accent, 0.25)} />
        </Frame>
    );
}

/** M11 Penilaian mandiri: figur berdasi dengan tanda centang; penilaian ini tidak anonim. Emas: tanda centang. */
export function IconSelfAssessments({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <circle cx="10" cy="7.6" r="3.2" />
            <path d="M3.5 20.5a6.5 6.5 0 0 1 13 0" />
            <path d="m10 14.3 1 1.2-1 3.9-1-3.9Z" />
            <path d="m15.6 12.4 1.9 1.9 3.7-4" stroke={accent} />
        </Frame>
    );
}

/** M12 Bukti dokumen: map terbuka dengan selembar dokumen. Emas: penjepit kertas yang menahan bukti. */
export function IconEvidence({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M3 19.8V7a1.5 1.5 0 0 1 1.5-1.5h3.1l1.6 1.8" />
            <path d="M10.8 11.5V4.8a.8.8 0 0 1 .8-.8h1.1M16.3 4h1.5a.8.8 0 0 1 .8.8v6.7" />
            <path d="M3 19.8 5.55 12.35a1.2 1.2 0 0 1 1.13-.85H21l-2.62 7.45a1.2 1.2 0 0 1-1.13.85H3" />
            <path d="M13.4 8.6V4.9a1.2 1.2 0 0 1 2.4 0v4.4" stroke={accent} />
        </Frame>
    );
}

/** M13 Observasi lapangan: kamera dengan penanda lokasi kecil, bukan kamera pengawas. Emas: penanda lokasi. */
export function IconObservations({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M14.05 8.8h-.4l-1.3-2H7.95l-1.3 2H4.7a1.9 1.9 0 0 0-1.9 1.9v7.5a1.9 1.9 0 0 0 1.9 1.9h10.7a1.9 1.9 0 0 0 1.9-1.9v-4.3" />
            <circle cx="10.05" cy="14.4" r="3.1" />
            <path d="M18.4 12 16.05 7.9A2.7 2.7 0 1 1 20.75 7.9Z" {...tint(accent)} />
        </Frame>
    );
}

// Tahap 3, Validasi dan triangulasi ------------------------------------------------------------------

/** M14 Mutu data: alat ukur setengah lingkaran dengan skala, mutu yang terukur. Emas: jarum dan porosnya. */
export function IconDataQuality({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M3 15.8a9 9 0 0 1 18 0" />
            <path d="M6.6 12.7l-.95-.55M9.05 10.5l-.55-.95M12 9.7V8.6M14.95 10.5l.55-.95M17.4 12.7l.95-.55" />
            <g stroke={accent}>
                <path d="m13.05 14.75 2.3-2.3" />
                <circle cx="12" cy="15.8" r="1.5" fill={accent} fillOpacity={0.25} />
            </g>
        </Frame>
    );
}

/** M15 Temuan awal: kaca pembesar di atas tiga batang, melihat data sebelum menilai. Emas: lensa. */
export function IconFindings({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="m15.2 15.2 5.3 5.3" />
            <circle cx="10.4" cy="10.4" r="6.6" {...tint(accent, 0.18)} />
            <path d="M7.8 13.2v-2.2M10.4 13.2V8M13 13.2V9.6" />
        </Frame>
    );
}

/** M16 Wawancara dan diskusi kelompok terarah: dua gelembung percakapan. Emas: tiga titik, suara yang didengar. */
export function IconValidation({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M14.5 6.6V5.45a2.2 2.2 0 0 0-2.2-2.2H4.95a2.2 2.2 0 0 0-2.2 2.2v4.35a2.2 2.2 0 0 0 2.2 2.2h.55v2.8l2.6-2.8" />
            <path d="M12.2 8.75h6.85a2.2 2.2 0 0 1 2.2 2.2v4.6a2.2 2.2 0 0 1-2.2 2.2h-.45v2.75l-2.75-2.75H12.2a2.2 2.2 0 0 1-2.2-2.2v-4.6a2.2 2.2 0 0 1 2.2-2.2Z" />
            <g {...tint(accent, 0.25)}>
                <circle cx="12.9" cy="13.25" r="0.45" />
                <circle cx="15.6" cy="13.25" r="0.45" />
                <circle cx="18.3" cy="13.25" r="0.45" />
            </g>
        </Frame>
    );
}

// Tahap 4, Penilaian dan penetapan -------------------------------------------------------------------

/** M17 Penilaian asesor: daftar periksa dengan bintang setengah terisi, nilai kelipatan 0,5. Emas: bintang. */
export function IconScoring({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="m3.6 5.8 1.7 1.7 3.3-3.6M3.6 11.8l1.7 1.7 3.3-3.6M12 5.8h8.4M12 11.8h8.4M12 17.8h5.6" />
            <g stroke={accent}>
                <path d="M6.1 14 6.98 16.29 9.43 16.42 7.53 17.96 8.16 20.33 6.1 19 4.04 20.33 4.67 17.96 2.77 16.42 5.22 16.29Z" />
                <path
                    d="M6.1 14 5.22 16.29 2.77 16.42 4.67 17.96 4.04 20.33 6.1 19Z"
                    fill={accent}
                    fillOpacity={0.25}
                    stroke="none"
                />
            </g>
        </Frame>
    );
}

/** M18 Rapat panel: meja bundar tampak atas dengan tiga kursi, bukan palu hakim. Emas: titik tengah meja. */
export function IconPanel({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <circle cx="12" cy="13.4" r="4.2" />
            <rect x="10.5" y="3.9" width="3" height="3" rx="0.7" />
            <rect x="10.5" y="3.9" width="3" height="3" rx="0.7" transform="rotate(120 12 13.4)" />
            <rect x="10.5" y="3.9" width="3" height="3" rx="0.7" transform="rotate(240 12 13.4)" />
            <circle cx="12" cy="13.4" r="1.2" {...tint(accent, 0.25)} />
        </Frame>
    );
}

// Tahap 5, Pelaporan dan rencana aksi ----------------------------------------------------------------

/** M19 Dasbor hasil: tiga batang grafik dalam bingkai membulat. Emas: batang tertinggi. */
export function IconDashboard({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <rect x="3" y="3.5" width="18" height="17" rx="2.5" />
            <rect x="6.7" y="11.5" width="2.6" height="5" rx="0.6" />
            <rect x="14.7" y="10" width="2.6" height="6.5" rx="0.6" />
            <rect x="10.7" y="7.5" width="2.6" height="9" rx="0.6" {...tint(accent, 0.25)} />
        </Frame>
    );
}

/** M20 Kesenjangan dan rencana aksi: dua batang berbeda tinggi dan panah penghubung. Emas: panah, jarak yang ditutup. */
export function IconGaps({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <rect x="3.5" y="13" width="4.5" height="7.5" rx="0.8" />
            <rect x="16" y="5" width="4.5" height="15.5" rx="0.8" />
            <path d="M5.75 10.6C6.6 7.2 9.4 5.6 13.4 5.6M11.6 3.8l1.8 1.8-1.8 1.8" stroke={accent} />
        </Frame>
    );
}

/** M21 Laporan: dokumen dengan grafik kecil dan tanda tangan. Emas: garis tanda tangan, laporan yang disahkan. */
export function IconReport({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M5.5 2.8H14l4.5 4.5v13.9h-13Z" />
            <path d="M14 2.8v4.5h4.5M8.8 13.4v-2.6M11.8 13.4v-5M14.8 13.4v-3.4" />
            <path d="M8.4 18.3c.9-1.6 1.9-2 2.1-1 .2.9-.4 1.6.4 1.4.8-.3 1.3-1.4 2.1-1.3.6.1.4.9 1 .9h1" stroke={accent} />
        </Frame>
    );
}

/** M22 Komunikasi hasil: lembar hasil dengan panah menuju tiga figur, hasil kembali ke pekerja. Emas: panah. */
export function IconCommunication({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M10.6 10H8V2.8h5.6L16 5.2V10h-2.6" />
            <path d="M13.6 2.8v2.4H16" />
            <circle cx="5.8" cy="15.5" r="1.4" />
            <circle cx="12" cy="15.5" r="1.4" />
            <circle cx="18.2" cy="15.5" r="1.4" />
            <path d="M3.6 21.2a2.2 2.2 0 0 1 4.4 0M9.8 21.2a2.2 2.2 0 0 1 4.4 0M16 21.2a2.2 2.2 0 0 1 4.4 0" />
            <path d="M12 6v6M9.9 9.9 12 12l2.1-2.1" stroke={accent} />
        </Frame>
    );
}

// Tahap 6, Pemantauan dan perbaikan ------------------------------------------------------------------

/** M23 Pemantauan rencana aksi: kalender dengan tanda centang. Emas: tanda centang, tindakan yang selesai. */
export function IconMonitoring({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
            <path d="M3.5 9.6h17M8 3.2v3.6M16 3.2v3.6" />
            <path d="m8.6 14.9 2.3 2.3 4.6-4.8" stroke={accent} />
        </Frame>
    );
}

/** M24 Perbandingan antarperiode: dua garis tren, yang baru lebih tinggi. Emas: garis periode baru. */
export function IconTrend({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M3 3.5v17h18" />
            <path d="m6.5 17 3.5-2.6 3.5 1.6 3.5-3.6 3 1" strokeDasharray="0.01 2.6" />
            <path d="m6.5 12.2 3.5-3.4 3.5 1.8 3.5-4.6 3 1.2" stroke={accent} />
        </Frame>
    );
}

// Lintas tahap dan menu akun -------------------------------------------------------------------------

/** M25 Jejak audit: jam dengan panah melingkar berlawanan arah jarum jam. Emas: jarum jam. */
export function IconAudit({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M3.79 14.2A8.5 8.5 0 1 0 5.99 5.99M5.99 2.99v3h3" />
            <path d="M18.2 12h-.8M12 18.2v-.8M5.8 12h.8" />
            <path d="M12 7.6V12l2.8 1.6" stroke={accent} />
        </Frame>
    );
}

/** A01 Daftar asesmen: papan klip dengan tiga baris daftar periksa. Emas: penjepit papan. */
export function IconAssessments({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M8.5 4.5h-2a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V6.5a2 2 0 0 0-2-2h-2" />
            <path d="M8.5 10.2h.01M11.2 10.2h4.3M8.5 13.7h.01M11.2 13.7h4.3M8.5 17.2h.01M11.2 17.2h2.8" />
            <rect x="8.5" y="2.75" width="7" height="3.5" rx="1" {...tint(accent, 0.25)} />
        </Frame>
    );
}

/** A02 Asesmen baru: papan klip dengan tanda tambah. Emas: tanda tambah. */
export function IconNewAssessment({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M8.5 4.5h-2a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V6.5a2 2 0 0 0-2-2h-2" />
            <rect x="8.5" y="2.75" width="7" height="3.5" rx="1" />
            <path d="M12 10.3v6.6M8.7 13.6h6.6" stroke={accent} />
        </Frame>
    );
}

/** A03 Organisasi dan pengguna: gedung kantor dengan satu figur di depannya. Emas: figur pengguna. */
export function IconOrganizations({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <path d="M14 15.6V4.5a1.5 1.5 0 0 0-1.5-1.5H5a1.5 1.5 0 0 0-1.5 1.5V21H12" />
            <path d="M6.6 7h1M9.9 7h1M6.6 11h1M9.9 11h1M6.6 15h1M9.9 15h1" />
            <g {...tint(accent)}>
                <circle cx="17.6" cy="13.1" r="1.9" />
                <path d="M14 21a3.6 3.6 0 0 1 7.2 0" />
            </g>
        </Frame>
    );
}

/** A04 Retensi data: kotak arsip dengan jam pasir, bukan tempat sampah. Emas: jam pasir, masa simpan. */
export function IconRetention({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <rect x="3" y="3.75" width="18" height="4.5" rx="1" />
            <path d="M4.5 8.25v10.5a1.75 1.75 0 0 0 1.75 1.75h11.5a1.75 1.75 0 0 0 1.75-1.75V8.25" />
            <g stroke={accent}>
                <path d="M9.4 11.2h5.2M9.4 17.6h5.2" />
                <path d="M10.2 11.2h3.6L12 14.4l1.8 3.2h-3.6l1.8-3.2Z" fill={accent} fillOpacity={0.22} />
            </g>
        </Frame>
    );
}

/** A05 Status sistem: garis denyut di dalam bingkai layar. Emas: garis denyut, layanan yang hidup. */
export function IconSystemStatus({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <rect x="2.75" y="4" width="18.5" height="12.5" rx="2" />
            <path d="M12 16.5V20M8.5 20h7" />
            <path d="M5.5 10.6h3.1l1.5-3 2.6 6 1.7-4.4 1.1 1.4h3" stroke={accent} />
        </Frame>
    );
}

/** A06 Akun dan keamanan: figur setengah badan dengan perisai bergembok. Emas: perisai. */
export function IconAccount({ accent = GOLD, ...props }: IconProps) {
    return (
        <Frame {...props}>
            <circle cx="9" cy="7.6" r="3.2" />
            <path d="M2.8 20.6A6.2 6.2 0 0 1 12 15.17" />
            <path d="m17.6 10.2 3.6 1.45v3.45c0 2.7-1.5 4.4-3.6 5.4-2.1-1-3.6-2.7-3.6-5.4v-3.45Z" {...tint(accent)} />
            <rect x="16.1" y="15.2" width="3" height="2.6" rx="0.5" />
            <path d="M16.75 15.2v-.8a.85.85 0 0 1 1.7 0v.8" />
        </Frame>
    );
}

export const MODULE_ICONS: Record<string, ComponentType<IconProps>> = {
    details: IconDetails,
    units: IconUnits,
    strata: IconStrata,
    parameters: IconParameters,
    sampling: IconSampling,
    team: IconTeam,
    kickoff: IconKickoff,
    respondents: IconRespondents,
    qr: IconQr,
    participation: IconParticipation,
    selfAssessments: IconSelfAssessments,
    evidence: IconEvidence,
    observations: IconObservations,
    dataQuality: IconDataQuality,
    findings: IconFindings,
    validation: IconValidation,
    scoring: IconScoring,
    panel: IconPanel,
    dashboard: IconDashboard,
    gaps: IconGaps,
    report: IconReport,
    communication: IconCommunication,
    monitoring: IconMonitoring,
    trend: IconTrend,
    audit: IconAudit,
};

export const ACCOUNT_ICONS: Record<string, ComponentType<IconProps>> = {
    assessments: IconAssessments,
    newAssessment: IconNewAssessment,
    organizations: IconOrganizations,
    retention: IconRetention,
    systemStatus: IconSystemStatus,
    account: IconAccount,
};
