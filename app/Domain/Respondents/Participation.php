<?php

declare(strict_types=1);

namespace App\Domain\Respondents;

/**
 * Perhitungan partisipasi (docs/01 M2), dibawa dari v1 src/lib/respondents/participation.ts. Selalu dari token akses
 * (completed_at), tidak pernah dari tabel jawaban, agar penghitungan tidak menyentuh data survei yang anonim
 * (docs/02 bagian 4). Jumlah selesai 1 sampai minCell - 1 disembunyikan (CLAUDE.md aturan 3).
 */
final class Participation
{
    /** @return array{value: int|null, suppressed: bool} */
    public static function maskCount(int $count, int $minCell): array
    {
        return $count > 0 && $count < $minCell
            ? ['value' => null, 'suppressed' => true]
            : ['value' => $count, 'suppressed' => false];
    }

    /**
     * @param  list<array{id: string, code: string, name: string, population: int}>  $strata
     * @param  list<array{id: string, name: string, parentId: string|null}>  $units
     * @param  list<array{unitId: string, stratumId: string|null, issued: int, completed: int}>  $tokens  Token survei yang tidak dicabut; stratumId null untuk token kode QR yang belum memilih strata.
     * @param  list<array{unitId: string, stratumId: string, count: int}>  $roster
     * @return array<string, mixed>
     */
    public static function build(array $strata, array $units, array $tokens, array $roster, float $minParticipation, int $minCell): array
    {
        $sum = static fn (array $rows, string $key): int => array_sum(array_map(static fn (array $r): int => (int) $r[$key], $rows));
        $where = static fn (array $rows, string $key, ?string $value): array => array_values(array_filter($rows, static fn (array $r): bool => $r[$key] === $value));

        $strataRows = array_map(static function (array $s) use ($tokens, $roster, $sum, $where, $minCell, $minParticipation): array {
            $own = $where($tokens, 'stratumId', $s['id']);
            $completedRaw = $sum($own, 'completed');
            $completed = self::maskCount($completedRaw, $minCell);
            $rawRate = $s['population'] > 0 ? $completedRaw / $s['population'] : 0.0;

            return [
                'stratumId' => $s['id'],
                'code' => $s['code'],
                'name' => $s['name'],
                'population' => $s['population'],
                'registered' => $sum($where($roster, 'stratumId', $s['id']), 'count'),
                'issued' => $sum($own, 'issued'),
                'completed' => $completed,
                'rate' => $completed['suppressed'] || $s['population'] <= 0 ? null : $rawRate,
                'belowMinimum' => $rawRate < $minParticipation,
            ];
        }, $strata);

        $unitRows = array_map(static function (array $u) use ($tokens, $roster, $sum, $where, $minCell): array {
            $own = $where($tokens, 'unitId', $u['id']);
            $completedRaw = $sum($own, 'completed');
            $registered = $sum($where($roster, 'unitId', $u['id']), 'count');
            $completed = self::maskCount($completedRaw, $minCell);

            return [
                'unitId' => $u['id'],
                'name' => $u['name'],
                'parentId' => $u['parentId'],
                'registered' => $registered,
                'issued' => $sum($own, 'issued'),
                'completed' => $completed,
                'rate' => $completed['suppressed'] || $registered === 0 ? null : min(1.0, $completedRaw / $registered),
            ];
        }, $units);

        $population = $sum($strata, 'population');
        $completedTotal = $sum($tokens, 'completed');
        $totalCompleted = self::maskCount($completedTotal, $minCell);
        $pending = $where($tokens, 'stratumId', null);

        return [
            'strata' => $strataRows,
            'pendingStratumSelection' => $sum($pending, 'issued') - $sum($pending, 'completed'),
            'units' => $unitRows,
            'totals' => [
                'population' => $population,
                'registered' => $sum($roster, 'count'),
                'issued' => $sum($tokens, 'issued'),
                'completed' => $totalCompleted,
                'rate' => $totalCompleted['suppressed'] || $population <= 0 ? null : $completedTotal / $population,
            ],
            'strataBelowMinimum' => count(array_filter($strataRows, static fn (array $s): bool => $s['belowMinimum'])),
        ];
    }

    /**
     * Isi snapshot harian: jumlah mentah agar ambang sel dapat diterapkan saat ditampilkan.
     *
     * @param  list<array{id: string, code: string, name: string, population: int}>  $strata
     * @param  list<array{unitId: string, stratumId: string|null, issued: int, completed: int}>  $tokens
     * @return array{population: int, issued: int, completed: int, strata: list<array{stratumId: string, completed: int}>}
     */
    public static function snapshotData(array $strata, array $tokens): array
    {
        $byStratum = [];
        foreach ($tokens as $t) {
            if ($t['stratumId'] !== null) {
                $byStratum[$t['stratumId']] = ($byStratum[$t['stratumId']] ?? 0) + $t['completed'];
            }
        }

        return [
            'population' => array_sum(array_column($strata, 'population')),
            'issued' => array_sum(array_column($tokens, 'issued')),
            'completed' => array_sum(array_column($tokens, 'completed')),
            'strata' => array_map(static fn (array $s): array => ['stratumId' => $s['id'], 'completed' => $byStratum[$s['id']] ?? 0], $strata),
        ];
    }

    /**
     * @param  list<array{date: string, data: array{population: int, completed: int}}>  $rows
     * @return list<array{date: string, completed: array{value: int|null, suppressed: bool}, rate: float|null}>
     */
    public static function trend(array $rows, int $minCell): array
    {
        return array_map(static function (array $r) use ($minCell): array {
            $completed = self::maskCount((int) $r['data']['completed'], $minCell);
            $population = (int) $r['data']['population'];

            return [
                'date' => $r['date'],
                'completed' => $completed,
                'rate' => $completed['suppressed'] || $population <= 0 ? null : $r['data']['completed'] / $population,
            ];
        }, $rows);
    }
}
