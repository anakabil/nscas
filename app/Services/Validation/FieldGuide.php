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
     * Butir lembar kunjungan: kode butir ke kode karakteristik. Bila kode karakteristik instrumen asesmen diberikan,
     * hanya butir yang karakteristiknya ada di instrumen itu yang dikembalikan; bahan versi 2 disusun untuk kode
     * instrumen versi 1 (K1.1 sampai KT.2).
     *
     * @param  list<string>|null  $instrumentCodes
     * @return array<string, string>
     */
    public static function siteItems(?array $instrumentCodes = null): array
    {
        $items = [];
        foreach (self::content()['siteVisit']['sections'] as $section) {
            foreach ($section['items'] as $item) {
                if ($instrumentCodes === null || in_array($item['characteristic'], $instrumentCodes, true)) {
                    $items[$item['code']] = $item['characteristic'];
                }
            }
        }

        return $items;
    }

    /**
     * Bagian bahan yang dipakai pada satu jenis sesi, terbatas pada karakteristik instrumen asesmen. Bila tidak ada
     * karakteristik yang cocok, bahan tidak ditampilkan (null).
     *
     * @param  list<string>  $instrumentCodes
     * @return array<string, mixed>|null
     */
    public static function forType(string $type, array $instrumentCodes): ?array
    {
        $c = self::content();
        $known = fn (array $byCode): array => array_intersect_key($byCode, array_flip($instrumentCodes));

        $guide = match ($type) {
            'INTERVIEW' => ['kind' => 'INTERVIEW', 'opening' => $c['interview']['opening'], 'closing' => $c['interview']['closing'],
                'characteristics' => $known($c['interview']['characteristics'])],
            'FOCUS_GROUP' => ['kind' => 'FOCUS_GROUP', 'rules' => $c['focusGroup']['rules'], 'opening' => $c['focusGroup']['opening'],
                'warmUp' => $c['focusGroup']['warmUp'], 'closing' => $c['focusGroup']['closing'],
                'characteristics' => array_map(fn (array $q) => ['probes' => $q['probes']], $known($c['focusGroup']['characteristics']))],
            'SITE_VISIT', 'VIRTUAL_SITE_VISIT' => ['kind' => 'SITE_VISIT', 'intro' => $c['siteVisit']['intro'],
                'sections' => array_values(array_filter(array_map(fn (array $section) => [
                    ...$section,
                    'items' => array_values(array_filter($section['items'], fn (array $i) => in_array($i['characteristic'], $instrumentCodes, true))),
                ], $c['siteVisit']['sections']), fn (array $section) => $section['items'] !== []))],
            default => null,
        };
        if ($guide === null) {
            return null;
        }
        $empty = $guide['kind'] === 'SITE_VISIT' ? $guide['sections'] === [] : $guide['characteristics'] === [];

        return $empty ? null : $guide;
    }
}
