<?php

namespace App\Services\Validation;

/**
 * Bahan validasi lapangan versi 2 dari seed/panduan-validasi-v2.json: pertanyaan pendalaman dan petunjuk penilaian
 * jawaban wawancara, alur diskusi kelompok terarah, dan lembar kerja kunjungan proyek. Lembar kunjungan dibuat baku
 * untuk semua asesmen agar hasil antarproyek dan antarperiode dapat dibandingkan.
 */
final class FieldGuide
{
    /** @var array<string, mixed>|null */
    private static ?array $content = null;

    /** @return array<string, mixed> */
    public static function content(): array
    {
        return self::$content ??= json_decode((string) file_get_contents(base_path('seed/panduan-validasi-v2.json')), true);
    }

    /**
     * Butir lembar kunjungan: kode butir ke kode karakteristik.
     *
     * @return array<string, string>
     */
    public static function siteItems(): array
    {
        $items = [];
        foreach (self::content()['siteVisit']['sections'] as $section) {
            foreach ($section['items'] as $item) {
                $items[$item['code']] = $item['characteristic'];
            }
        }

        return $items;
    }

    /**
     * Bagian bahan yang dipakai pada satu jenis sesi.
     *
     * @return array<string, mixed>|null
     */
    public static function forType(string $type): ?array
    {
        $c = self::content();

        return match ($type) {
            'INTERVIEW' => ['kind' => 'INTERVIEW', 'opening' => $c['interview']['opening'], 'closing' => $c['interview']['closing'],
                'characteristics' => $c['interview']['characteristics']],
            'FOCUS_GROUP' => ['kind' => 'FOCUS_GROUP', 'rules' => $c['focusGroup']['rules'], 'opening' => $c['focusGroup']['opening'],
                'warmUp' => $c['focusGroup']['warmUp'], 'closing' => $c['focusGroup']['closing'],
                'characteristics' => array_map(fn (array $q) => ['probes' => $q['probes']], $c['focusGroup']['characteristics'])],
            'SITE_VISIT', 'VIRTUAL_SITE_VISIT' => ['kind' => 'SITE_VISIT', 'intro' => $c['siteVisit']['intro'], 'sections' => $c['siteVisit']['sections']],
            default => null,
        };
    }
}
