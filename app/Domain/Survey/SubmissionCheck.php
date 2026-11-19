<?php

declare(strict_types=1);

namespace App\Domain\Survey;

/**
 * Pemeriksaan kiriman survei terhadap struktur instrumen (dibawa dari v1 checkAnswers). Peramban mengirim id
 * pernyataan, bukan tingkatnya; tingkat hanya diketahui di sini. Seluruh karakteristik dan butir iklim versi
 * instrumen wajib dijawab tepat satu kali.
 */
final class SubmissionCheck
{
    /**
     * @param  array<string, array<string, int>>  $statementLevels  characteristicId => (statementId => tingkat).
     * @param  list<string>  $itemIds  Seluruh butir iklim versi instrumen.
     * @param  list<array{characteristicId: string, statementId: string|null}>  $characteristics
     * @param  list<array{itemId: string, value: int}>  $climate
     * @return array{ok: true, characteristicAnswers: list<array{characteristicId: string, level: int|null}>, climateAnswers: list<array{itemId: string, value: int}>}|array{ok: false, code: 'INCOMPLETE'|'UNKNOWN_ITEM'}
     */
    public static function check(array $statementLevels, array $itemIds, array $characteristics, array $climate): array
    {
        $answers = [];
        foreach ($characteristics as $c) {
            $answers[$c['characteristicId']] = $c['statementId'];
        }
        $values = [];
        foreach ($climate as $c) {
            $values[$c['itemId']] = $c['value'];
        }
        if (count($answers) !== count($characteristics) || count($values) !== count($climate)) {
            return ['ok' => false, 'code' => 'INCOMPLETE'];
        }
        if (count($answers) !== count($statementLevels) || count($values) !== count($itemIds)) {
            return ['ok' => false, 'code' => 'INCOMPLETE'];
        }

        $characteristicAnswers = [];
        foreach ($statementLevels as $characteristicId => $levels) {
            if (! array_key_exists($characteristicId, $answers)) {
                return ['ok' => false, 'code' => 'UNKNOWN_ITEM'];
            }
            $statementId = $answers[$characteristicId];
            if ($statementId === null) {
                $characteristicAnswers[] = ['characteristicId' => (string) $characteristicId, 'level' => null];

                continue;
            }
            if (! isset($levels[$statementId])) {
                return ['ok' => false, 'code' => 'UNKNOWN_ITEM'];
            }
            $characteristicAnswers[] = ['characteristicId' => (string) $characteristicId, 'level' => $levels[$statementId]];
        }

        $climateAnswers = [];
        foreach ($itemIds as $itemId) {
            if (! array_key_exists($itemId, $values) || $values[$itemId] < 1 || $values[$itemId] > 5) {
                return ['ok' => false, 'code' => 'UNKNOWN_ITEM'];
            }
            $climateAnswers[] = ['itemId' => $itemId, 'value' => $values[$itemId]];
        }

        return ['ok' => true, 'characteristicAnswers' => $characteristicAnswers, 'climateAnswers' => $climateAnswers];
    }
}
