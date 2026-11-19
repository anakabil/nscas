<?php

declare(strict_types=1);

namespace App\Domain\Setup;

/**
 * Kelengkapan tahap perencanaan menurut tujuh halaman tahap 1, untuk dasbor progres dan pusat asesmen. Setelah
 * parameter dikunci, seluruh butir dianggap lengkap karena isinya sudah tersimpan di snapshot.
 */
final class PlanningChecklist
{
    public const ITEMS = ['details', 'units', 'strata', 'parameters', 'sampling', 'team', 'kickoff'];

    /** @return list<array{key: string, done: bool}> */
    public static function items(SetupFacts $facts, bool $locked): array
    {
        $done = [
            'details' => $facts->instrumentPublished,
            'units' => $facts->unitCount >= 1,
            'strata' => $facts->strataCount >= 1 && $facts->strataWithoutPopulation === 0,
            'parameters' => $facts->consentFilled && $facts->dpaSigned,
            'sampling' => $facts->samplePlanSaved,
            'team' => $facts->leadAssessorCount >= 1 && $facts->teamSize >= ConditionEvaluator::MIN_TEAM_SIZE,
            'kickoff' => $facts->kickoffComplete && $facts->calibrationComplete,
        ];

        return array_map(static fn (string $key): array => ['key' => $key, 'done' => $locked || $done[$key]], self::ITEMS);
    }

    /** @param  list<array{key: string, done: bool}>  $items */
    public static function doneCount(array $items): int
    {
        return count(array_filter($items, static fn (array $item): bool => $item['done']));
    }
}
