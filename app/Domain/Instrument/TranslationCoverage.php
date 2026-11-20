<?php

namespace App\Domain\Instrument;

/**
 * Pemeriksaan berkas terjemahan isi instrumen (docs/17). Berkas harus memuat tepat semua karakteristik, kelima
 * pernyataan berjenjang, dimensi, dan butir skala iklim dari versi instrumen yang dituju: tidak boleh ada yang kosong,
 * tidak boleh ada kode yang tidak dikenal, dan tidak boleh memakai tanda pisah panjang (aturan bahasa docs/05).
 * Berkas baru boleh diterapkan bila bagian persetujuannya diisi.
 */
final class TranslationCoverage
{
    /**
     * @param  array<string, list<int>>  $characteristics  kode karakteristik => tingkat pernyataan yang ada
     * @param  array<string, list<string>>  $climate  kode dimensi iklim => kode butirnya
     * @param  array<string, mixed>  $translation  isi berkas terjemahan
     * @return list<string> daftar masalah; kosong bila lengkap
     */
    public static function problems(array $characteristics, array $climate, array $translation): array
    {
        $problems = [];

        $given = self::map($translation['characteristics'] ?? null);
        foreach ($characteristics as $code => $levels) {
            $entry = self::map($given[$code] ?? null);
            if ($entry === []) {
                $problems[] = "Karakteristik {$code} belum diterjemahkan.";

                continue;
            }
            $problems = [...$problems, ...self::text($entry['name'] ?? null, "nama karakteristik {$code}")];
            $texts = self::map($entry['levels'] ?? null);
            foreach ($levels as $level) {
                $problems = [...$problems, ...self::text($texts[(string) $level] ?? null, "pernyataan {$code} tingkat {$level}")];
            }
            foreach (array_keys($texts) as $level) {
                if (! in_array((int) $level, $levels, true)) {
                    $problems[] = "Tingkat {$level} pada {$code} tidak ada di instrumen.";
                }
            }
        }
        foreach (array_keys($given) as $code) {
            if (! array_key_exists((string) $code, $characteristics)) {
                $problems[] = "Karakteristik {$code} tidak ada di instrumen.";
            }
        }

        $dimensions = self::map($translation['climate'] ?? null);
        foreach ($climate as $code => $items) {
            $entry = self::map($dimensions[$code] ?? null);
            if ($entry === []) {
                $problems[] = "Dimensi iklim {$code} belum diterjemahkan.";

                continue;
            }
            $problems = [...$problems, ...self::text($entry['name'] ?? null, "nama dimensi {$code}")];
            $texts = self::map($entry['items'] ?? null);
            foreach ($items as $item) {
                $problems = [...$problems, ...self::text($texts[$item] ?? null, "butir iklim {$item}")];
            }
            foreach (array_keys($texts) as $item) {
                if (! in_array((string) $item, $items, true)) {
                    $problems[] = "Butir iklim {$item} tidak ada di dimensi {$code}.";
                }
            }
        }
        foreach (array_keys($dimensions) as $code) {
            if (! array_key_exists((string) $code, $climate)) {
                $problems[] = "Dimensi iklim {$code} tidak ada di instrumen.";
            }
        }

        return $problems;
    }

    /**
     * Persetujuan tercatat bila nama penelaah dan tanggal persetujuan diisi.
     *
     * @param  array<string, mixed>  $translation
     */
    public static function approved(array $translation): bool
    {
        $approval = self::map($translation['approval'] ?? null);

        return self::filled($approval['approvedBy'] ?? null) && self::filled($approval['approvedOn'] ?? null);
    }

    public static function filled(mixed $text): bool
    {
        return is_string($text) && trim($text) !== '';
    }

    /** @return list<string> */
    private static function text(mixed $text, string $label): array
    {
        if (! self::filled($text)) {
            return ["Teks {$label} kosong."];
        }
        if (str_contains((string) $text, "\u{2014}") || str_contains((string) $text, "\u{2013}") || str_contains((string) $text, '--')) {
            return ["Teks {$label} memakai tanda pisah panjang."];
        }

        return [];
    }

    /** @return array<array-key, mixed> */
    private static function map(mixed $value): array
    {
        return is_array($value) ? $value : [];
    }
}
