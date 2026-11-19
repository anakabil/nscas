<?php

declare(strict_types=1);

namespace App\Domain\Evidence;

/**
 * Daftar periksa bukti per karakteristik dan jumlah jenis bukti (docs/01 M5), dibawa dari v1
 * src/lib/evidence/rules.ts. Jenis bukti dihitung dari butir daftar periksa yang terpenuhi, ditambah satu bila ada
 * bukti yang belum dikaitkan ke butir mana pun.
 */
final class EvidenceChecklist
{
    /** Bawaan quality.minEvidenceTypesPerCharacteristic di seed. */
    public const DEFAULT_MIN_TYPES = 2;

    /**
     * @param  list<array{id: string, code: string, name: string, requirements: list<array{id: string, description: string}>}>  $characteristics
     * @param  list<array{evidenceItemId: string, characteristicId: string, requirementIds: list<string>}>  $links  tautan bukti yang berlaku (versi terbaru, belum dihapus)
     * @return list<array{characteristicId: string, code: string, name: string, requirements: list<array{id: string, description: string, met: bool}>, evidenceCount: int, types: int, belowMinimum: bool}>
     */
    public static function build(array $characteristics, array $links, int $minTypes): array
    {
        $rows = [];
        foreach ($characteristics as $c) {
            $own = array_values(array_filter($links, fn (array $l) => $l['characteristicId'] === $c['id']));
            $known = array_column($c['requirements'], 'id');
            $met = [];
            $untyped = false;
            foreach ($own as $link) {
                $valid = array_values(array_intersect($link['requirementIds'], $known));
                $met = [...$met, ...$valid];
                if ($valid === []) {
                    $untyped = true;
                }
            }
            $met = array_values(array_unique($met));
            $types = count($met) + ($untyped ? 1 : 0);
            $rows[] = [
                'characteristicId' => $c['id'],
                'code' => $c['code'],
                'name' => $c['name'],
                'requirements' => array_map(
                    fn (array $r) => [...$r, 'met' => in_array($r['id'], $met, true)],
                    $c['requirements'],
                ),
                'evidenceCount' => count(array_unique(array_column($own, 'evidenceItemId'))),
                'types' => $types,
                'belowMinimum' => $types < $minTypes,
            ];
        }

        return $rows;
    }
}
