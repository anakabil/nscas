<?php

declare(strict_types=1);

namespace App\Domain\Setup;

/**
 * Templat teks persetujuan responden (docs/04 bagian 8). Lokasi data wajib disebut (CLAUDE.md aturan 7). Teks dapat
 * disesuaikan asesor utama sebelum asesmen dikunci.
 */
final class ConsentTemplate
{
    private const TEMPLATES = [
        'id' => 'Survei ini diselenggarakan oleh Nusa Safety atas permintaan {organization} untuk mengukur budaya '
            .'keselamatan dan kesehatan kerja. Jawaban Anda tidak dapat dihubungkan dengan identitas Anda. Hasil hanya '
            .'disajikan secara gabungan untuk kelompok paling sedikit lima orang. Data disimpan di pusat data di '
            .'{location} dan dimusnahkan setelah {months} bulan. Keikutsertaan bersifat sukarela dan Anda dapat berhenti '
            .'kapan saja. Dengan menekan tombol Setuju, Anda menyetujui pemrosesan jawaban sesuai Undang-Undang Nomor 27 '
            .'Tahun 2022 tentang Pelindungan Data Pribadi.',
        'en' => 'This survey is conducted by Nusa Safety at the request of {organization} to measure occupational '
            .'safety and health culture. Your answers cannot be linked to your identity. Results are only presented in '
            .'combined form for groups of at least five people. Data is stored in a data centre in {location} and '
            .'destroyed after {months} months. Participation is voluntary and you may stop at any time. By pressing '
            .'Agree, you consent to the processing of your answers in accordance with Law Number 27 of 2022 on Personal '
            .'Data Protection.',
    ];

    /** @param  'id'|'en'  $language */
    public static function render(string $language, string $organization, string $location, int $retentionMonths): string
    {
        return strtr(self::TEMPLATES[$language], [
            '{organization}' => $organization,
            '{location}' => $location,
            '{months}' => (string) $retentionMonths,
        ]);
    }
}
