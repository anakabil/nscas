<?php

declare(strict_types=1);

namespace App\Domain\Validation;

/**
 * Ringkasan triangulasi per karakteristik dari wawancara, diskusi kelompok terarah, dan kunjungan proyek (bahan
 * validasi versi 2). Bukan nilai: rumus penilaian di App\Domain\Scoring tidak memakai angka ini. Dipakai asesor dan
 * rapat panel untuk melihat apakah sumber data saling menguatkan. Murni.
 *
 * Indeks kunjungan = (Sesuai + 0,5 x Sebagian) / butir yang dapat diperiksa, 0 sampai 1. Nilai sesi dinormalkan ke
 * 0 sampai 1 dengan (nilai - 1) / 4. Sumber dianggap perlu dibahas bila selisih keduanya paling sedikit 0,40.
 */
final class Triangulation
{
    public const DIVERGENCE = 0.40;

    /**
     * @param  list<string>  $codes  kode karakteristik berurutan
     * @param  list<array{code: string, type: string, layer: string, level: float, evidence: ?string, agreement: ?string}>  $ratings
     * @param  list<array{code: string, result: string, unitId: ?string}>  $checks
     * @return array<string, array<string, mixed>>
     */
    public static function summarize(array $codes, array $ratings, array $checks): array
    {
        $out = [];
        foreach ($codes as $code) {
            $own = array_values(array_filter($ratings, fn (array $r) => $r['code'] === $code));
            $site = array_values(array_filter($checks, fn (array $c) => $c['code'] === $code));
            $talkMean = $own === [] ? null : array_sum(array_column($own, 'level')) / count($own);
            $byLayer = [];
            foreach ($own as $r) {
                $byLayer[$r['layer']][] = $r['level'];
            }
            $siteIndex = self::siteIndex(array_column($site, 'result'));
            $out[$code] = [
                'talks' => [
                    'n' => count($own),
                    'mean' => $talkMean,
                    'byLayer' => array_map(fn (array $levels) => array_sum($levels) / count($levels), $byLayer),
                    'evidence' => self::count(array_column($own, 'evidence'), FieldCoding::EVIDENCE),
                    'agreement' => self::count(array_column(array_filter($own, fn (array $r) => $r['type'] === 'FOCUS_GROUP'), 'agreement'), FieldCoding::AGREEMENT),
                ],
                'site' => [
                    'counts' => self::count(array_column($site, 'result'), FieldCoding::SITE_RESULTS),
                    'index' => $siteIndex,
                ],
                'divergent' => self::divergent($talkMean, $siteIndex),
            ];
        }

        return $out;
    }

    /** @param  list<string>  $results */
    public static function siteIndex(array $results): ?float
    {
        $meets = count(array_filter($results, fn (string $r) => $r === 'MEETS'));
        $partial = count(array_filter($results, fn (string $r) => $r === 'PARTIAL'));
        $notMet = count(array_filter($results, fn (string $r) => $r === 'NOT_MET'));
        $checked = $meets + $partial + $notMet;

        return $checked === 0 ? null : ($meets + 0.5 * $partial) / $checked;
    }

    public static function divergent(?float $talkMean, ?float $siteIndex): bool
    {
        if ($talkMean === null || $siteIndex === null) {
            return false;
        }

        return abs(($talkMean - 1) / 4 - $siteIndex) >= self::DIVERGENCE - 1e-9;
    }

    /**
     * @param  list<?string>  $values
     * @param  list<string>  $keys
     * @return array<string, int>
     */
    private static function count(array $values, array $keys): array
    {
        $counts = array_fill_keys($keys, 0);
        foreach ($values as $v) {
            if ($v !== null && array_key_exists($v, $counts)) {
                $counts[$v]++;
            }
        }

        return $counts;
    }
}
