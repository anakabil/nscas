<?php

declare(strict_types=1);

namespace App\Domain\Results;

/**
 * Perbandingan antarperiode (docs/01 M9, docs/12 temuan T6): hasil final asesmen organisasi yang sama dengan versi
 * instrumen yang sama, diurutkan menurut awal periode, dengan selisih indeks organisasi dan indeks aspek terhadap
 * periode sebelumnya. Murni.
 */
final class Trend
{
    /**
     * @param  list<array{id: string, name: string, periodStart: string, index: float, level: int, aspects: array<string, float|null>}>  $periods
     * @return list<array{id: string, name: string, periodStart: string, index: float, level: int, aspects: array<string, float|null>, delta: float|null, levelDelta: int|null, aspectDeltas: array<string, float|null>}>
     */
    public static function compare(array $periods): array
    {
        usort($periods, fn (array $a, array $b) => strcmp($a['periodStart'], $b['periodStart']) ?: strcmp($a['id'], $b['id']));
        $out = [];
        $previous = null;
        foreach ($periods as $p) {
            $deltas = [];
            foreach ($p['aspects'] as $code => $value) {
                $before = $previous['aspects'][$code] ?? null;
                $deltas[$code] = $value !== null && $before !== null ? $value - $before : null;
            }
            $out[] = [
                ...$p,
                'delta' => $previous === null ? null : $p['index'] - $previous['index'],
                'levelDelta' => $previous === null ? null : $p['level'] - $previous['level'],
                'aspectDeltas' => $deltas,
            ];
            $previous = $p;
        }

        return $out;
    }
}
