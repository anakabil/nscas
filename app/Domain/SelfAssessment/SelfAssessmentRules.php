<?php

declare(strict_types=1);

namespace App\Domain\SelfAssessment;

/**
 * Aturan penilaian mandiri (docs/01 M4), dibawa dari v1 src/lib/self-assessment/rules.ts. Penilaian mandiri
 * teridentifikasi: setiap jawaban wajib beralasan agar asesor dapat menelusurinya, sehingga alasan pendek atau
 * kosong tidak dapat dikirim.
 */
final class SelfAssessmentRules
{
    public const JUSTIFICATION_MIN_LENGTH = 50;

    public const JUSTIFICATION_MAX_LENGTH = 4000;

    /** Panjang alasan dihitung tanpa spasi berlebih di awal, akhir, dan di antara kata. */
    public static function justificationLength(?string $text): int
    {
        return mb_strlen((string) preg_replace('/\s+/u', ' ', trim((string) $text)));
    }

    /**
     * Karakteristik yang belum memenuhi syarat kirim: belum memilih pernyataan atau alasan kurang dari 50 karakter.
     *
     * @param  list<string>  $characteristicIds
     * @param  list<array{characteristicId: string, level: int|null, justification: string|null}>  $answers
     * @return list<array{characteristicId: string, reasons: list<'LEVEL'|'JUSTIFICATION'>}>
     */
    public static function missingForSubmit(array $characteristicIds, array $answers): array
    {
        $byId = [];
        foreach ($answers as $answer) {
            $byId[$answer['characteristicId']] = $answer;
        }
        $missing = [];
        foreach ($characteristicIds as $id) {
            $answer = $byId[$id] ?? null;
            $reasons = [];
            if ($answer === null || $answer['level'] === null) {
                $reasons[] = 'LEVEL';
            }
            if (self::justificationLength($answer['justification'] ?? null) < self::JUSTIFICATION_MIN_LENGTH) {
                $reasons[] = 'JUSTIFICATION';
            }
            if ($reasons !== []) {
                $missing[] = ['characteristicId' => $id, 'reasons' => $reasons];
            }
        }

        return $missing;
    }
}
