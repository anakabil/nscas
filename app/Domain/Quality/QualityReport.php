<?php

declare(strict_types=1);

namespace App\Domain\Quality;

use App\Domain\Scoring\DataQuality;

/**
 * Statistik mutu data untuk tinjauan sebelum validasi (docs/03 bagian 8, docs/12 temuan T3), dibawa dari v1
 * src/lib/dashboard/analytics.ts: alfa Cronbach per dimensi iklim dan rwg(J) per unit. Hanya jawaban yang tidak
 * dikeluarkan; nilai dengan kurang dari ambang responden disembunyikan. Murni.
 */
final class QualityReport
{
    /**
     * @param  list<array{code: string, name: string, items: list<array{id: string, reverse: bool}>}>  $dimensions
     * @param  list<array{unitId: string, climate: array<string, int>}>  $responses
     * @return list<array{code: string, name: string, alpha: float|null, n: int|null, belowThreshold: bool}>
     */
    public static function alphaByDimension(array $dimensions, array $responses, int $minCell, float $threshold): array
    {
        $out = [];
        foreach ($dimensions as $d) {
            $matrix = self::matrix($d['items'], $responses);
            $alpha = count($matrix) >= $minCell
                ? DataQuality::cronbachAlpha($matrix, array_map(fn (array $i) => $i['reverse'], $d['items']))
                : null;
            $out[] = [
                'code' => $d['code'],
                'name' => $d['name'],
                'alpha' => $alpha,
                'n' => count($matrix) >= $minCell ? count($matrix) : null,
                'belowThreshold' => $alpha !== null && $alpha < $threshold,
            ];
        }

        return $out;
    }

    /**
     * rwg(J) per unit: rata-rata rwg(J) seluruh dimensi; unit dengan kurang dari ambang responden disembunyikan.
     *
     * @param  list<array{id: string, name: string}>  $units
     * @param  list<array{code: string, name: string, items: list<array{id: string, reverse: bool}>}>  $dimensions
     * @param  list<array{unitId: string, climate: array<string, int>}>  $responses
     * @return list<array{unitId: string, name: string, average: float|null, n: int|null, belowThreshold: bool}>
     */
    public static function rwgByUnit(array $units, array $dimensions, array $responses, int $minCell, float $threshold): array
    {
        $out = [];
        foreach ($units as $u) {
            $own = array_values(array_filter($responses, fn (array $r) => $r['unitId'] === $u['id']));
            if ($own === []) {
                continue;
            }
            $values = [];
            foreach ($dimensions as $d) {
                $matrix = self::matrix($d['items'], $own);
                $values[] = count($matrix) >= $minCell ? DataQuality::rwgJ($matrix) : null;
            }
            $visible = array_values(array_filter($values, fn ($v) => $v !== null));
            $average = $visible !== [] && count($visible) === count($dimensions) ? array_sum($visible) / count($visible) : null;
            $out[] = [
                'unitId' => $u['id'],
                'name' => $u['name'],
                'average' => $average,
                'n' => count($own) >= $minCell ? count($own) : null,
                'belowThreshold' => $average !== null && $average < $threshold,
            ];
        }

        return $out;
    }

    /**
     * Baris responden yang menjawab semua butir dimensi.
     *
     * @param  list<array{id: string, reverse: bool}>  $items
     * @param  list<array{unitId: string, climate: array<string, int>}>  $responses
     * @return list<list<int>>
     */
    private static function matrix(array $items, array $responses): array
    {
        $rows = [];
        foreach ($responses as $r) {
            $row = [];
            foreach ($items as $item) {
                if (! isset($r['climate'][$item['id']])) {
                    continue 2;
                }
                $row[] = $r['climate'][$item['id']];
            }
            $rows[] = $row;
        }

        return $rows;
    }
}
