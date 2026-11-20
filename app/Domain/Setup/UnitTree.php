<?php

declare(strict_types=1);

namespace App\Domain\Setup;

/** Struktur unit bertingkat: kantor pusat, divisi, proyek, cabang (dibawa dari v1 src/lib/assessments/unit-tree.ts). */
final class UnitTree
{
    /**
     * Urutan tampilan pohon: induk lalu anak-anaknya (urut nama), dengan kedalaman. Unit yang induknya tidak dikenal
     * ditaruh di akar.
     *
     * @template T of array{id: string, parentId: string|null, name: string}
     *
     * @param  list<T>  $units
     * @return list<array<string, mixed>> Butir masukan beserta kunci depth.
     */
    public static function flatten(array $units): array
    {
        $ids = array_fill_keys(array_column($units, 'id'), true);
        $children = [];
        foreach ($units as $unit) {
            $parent = $unit['parentId'] !== null && isset($ids[$unit['parentId']]) ? $unit['parentId'] : '';
            $children[$parent][] = $unit;
        }
        foreach ($children as &$list) {
            usort($list, static fn (array $a, array $b): int => strcasecmp($a['name'], $b['name']));
        }
        unset($list);

        $out = [];
        $visited = [];
        $visit = static function (string $parent, int $depth) use (&$visit, &$out, &$visited, $children): void {
            foreach ($children[$parent] ?? [] as $unit) {
                if (isset($visited[$unit['id']])) {
                    continue;
                }
                $visited[$unit['id']] = true;
                $out[] = [...$unit, 'depth' => $depth];
                $visit($unit['id'], $depth + 1);
            }
        };
        $visit('', 0);

        return $out;
    }

    /**
     * true bila menjadikan $newParentId induk $unitId membentuk siklus, termasuk menjadi induk dirinya sendiri.
     *
     * @param  list<array{id: string, parentId: string|null}>  $units
     */
    public static function wouldCreateCycle(array $units, string $unitId, ?string $newParentId): bool
    {
        $parentOf = array_column($units, 'parentId', 'id');
        $current = $newParentId;
        $seen = [];
        while ($current !== null) {
            if ($current === $unitId || isset($seen[$current])) {
                return true;
            }
            $seen[$current] = true;
            $current = $parentOf[$current] ?? null;
        }

        return false;
    }

    /**
     * Unit-unit ini beserta seluruh unit di bawahnya (cakupan koordinator unit).
     *
     * @param  list<array{id: string, parentId: string|null}>  $units
     * @param  list<string>  $roots
     * @return list<string>
     */
    public static function withDescendants(array $units, array $roots): array
    {
        $children = [];
        foreach ($units as $unit) {
            if ($unit['parentId'] !== null) {
                $children[$unit['parentId']][] = $unit['id'];
            }
        }
        $known = array_fill_keys(array_column($units, 'id'), true);
        $out = [];
        $stack = array_values(array_filter($roots, static fn (string $id): bool => isset($known[$id])));
        while ($stack !== []) {
            $id = array_pop($stack);
            if (isset($out[$id])) {
                continue;
            }
            $out[$id] = true;
            array_push($stack, ...($children[$id] ?? []));
        }

        return array_keys($out);
    }
}
