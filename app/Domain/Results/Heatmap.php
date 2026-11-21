<?php

declare(strict_types=1);

namespace App\Domain\Results;

/**
 * Peta warna aspek terhadap strata atau unit (docs/01 M9) dari jawaban survei: rata-rata tiap responden atas
 * karakteristik nonkontekstual aspek itu, lalu rata-rata per kolom. Sel dengan kurang dari ambang responden
 * disembunyikan beserta jumlah respondennya, dan sel lain ikut disembunyikan bila agregat kelompoknya diterbitkan
 * (App\Domain\Results\CellSuppression; CLAUDE.md aturan 3). Murni.
 */
final class Heatmap
{
    /**
     * @param  list<array{id: string, aspectCode: string, contextual: bool}>  $characteristics
     * @param  list<array{stratumId: string, unitId: string, levels: array<string, int|null>}>  $responses
     * @param  list<array{id: string, label: string}>  $columns
     * @param  'stratumId'|'unitId'  $key
     * @param  list<list<string>>  $groups  id kolom yang agregatnya diterbitkan di tempat lain (penyembunyian pelengkap)
     * @return array{columns: list<array{id: string, label: string}>, rows: list<array{aspectCode: string, cells: list<array{value: float|null, n: int|null, suppressed: bool}>}>}
     */
    public static function build(array $characteristics, array $responses, array $columns, string $key, int $minCell, array $groups = []): array
    {
        $byAspect = [];
        foreach ($characteristics as $c) {
            if (! $c['contextual']) {
                $byAspect[$c['aspectCode']][] = $c['id'];
            }
        }
        $rows = [];
        foreach ($byAspect as $aspect => $ids) {
            $sums = [];
            foreach ($responses as $r) {
                $values = [];
                foreach ($ids as $id) {
                    if (isset($r['levels'][$id])) {
                        $values[] = $r['levels'][$id];
                    }
                }
                if ($values !== []) {
                    $sums[$r[$key]][] = array_sum($values) / count($values);
                }
            }
            $raw = [];
            foreach ($columns as $col) {
                $own = $sums[$col['id']] ?? [];
                $raw[$col['id']] = ['value' => $own === [] ? null : (float) (array_sum($own) / count($own)), 'n' => count($own)];
            }
            $safe = CellSuppression::apply($raw, $minCell, $groups);
            $rows[] = ['aspectCode' => $aspect, 'cells' => array_map(fn (array $col) => $safe[$col['id']], $columns)];
        }

        return ['columns' => $columns, 'rows' => $rows];
    }
}
