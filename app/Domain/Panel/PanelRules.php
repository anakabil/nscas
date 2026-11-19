<?php

declare(strict_types=1);

namespace App\Domain\Panel;

use App\Domain\Scoring\CharacteristicInput;
use App\Domain\Scoring\EngineInput;
use App\Domain\Scoring\Flag;
use App\Domain\Workflow\AssessmentStatus;

/**
 * Aturan penilaian asesor dan rapat panel (docs/01 M8, docs/03 bagian 2.2, 3, dan 5), dibawa dari v1
 * src/lib/assessor-scoring/rules.ts dan engine-input.ts. Murni.
 */
final class PanelRules
{
    /** Alasan nilai bukti dan keputusan panel wajib diisi; batas minimum mencegah alasan kosong seperti "ok". */
    public const RATIONALE_MIN = 20;

    public const SCL_JUSTIFICATION_MIN = 10;

    public const SCL_STEPS = [2, 3, 4, 5];

    /** Tanda yang wajib dibahas rapat panel: selisih persepsi dan bukti, serta nilai asesor yang berselisih. */
    public const ATTENTION_FLAGS = [Flag::SelisihPersepsiBukti, Flag::PerluRekonsiliasi];

    /** Nilai bukti dan jalur setara diisi selama validasi dan penilaian; terkunci sejak rapat panel. */
    public static function ratingOpen(AssessmentStatus $status): bool
    {
        return $status === AssessmentStatus::Validation || $status === AssessmentStatus::Scoring;
    }

    /** Mesin dijalankan pada tahap penilaian. */
    public static function runOpen(AssessmentStatus $status): bool
    {
        return $status === AssessmentStatus::Scoring;
    }

    public static function panelOpen(AssessmentStatus $status): bool
    {
        return $status === AssessmentStatus::PanelReview;
    }

    /** Nilai panel 1,00 sampai 5,00 dengan paling banyak dua desimal. */
    public static function isValidPanelValue(float $value): bool
    {
        return $value >= 1.0 && $value <= 5.0 && abs($value * 100 - round($value * 100)) < 1e-6;
    }

    /**
     * Asesor tidak melihat nilai asesor lain sebelum menyimpan nilainya sendiri, agar penilaian bukti berdiri sendiri
     * dan tidak terjangkar pada nilai rekan (docs/01 M8).
     *
     * @template T of array{assessorId: int|string}
     *
     * @param  list<T>  $ratings
     * @return array{own: T|null, others: list<T>, hidden: int}
     */
    public static function visibleRatings(array $ratings, int|string $viewerId): array
    {
        $own = null;
        $others = [];
        foreach ($ratings as $r) {
            if ((string) $r['assessorId'] === (string) $viewerId) {
                $own = $r;
            } else {
                $others[] = $r;
            }
        }

        return $own === null ? ['own' => null, 'others' => [], 'hidden' => count($others)] : ['own' => $own, 'others' => $others, 'hidden' => 0];
    }

    /**
     * Setiap karakteristik dinilai paling sedikit dua asesor berbeda (syarat two_assessor_ratings).
     *
     * @param  list<string>  $characteristicIds
     * @param  list<array{characteristicId: string, assessorId: int|string}>  $ratings
     */
    public static function twoAssessorsComplete(array $characteristicIds, array $ratings): bool
    {
        if ($characteristicIds === []) {
            return false;
        }
        $by = [];
        foreach ($ratings as $r) {
            $by[$r['characteristicId']][(string) $r['assessorId']] = true;
        }
        foreach ($characteristicIds as $id) {
            if (count($by[$id] ?? []) < 2) {
                return false;
            }
        }

        return true;
    }

    /**
     * Kode karakteristik pada hasil mesin yang wajib diputuskan rapat panel.
     *
     * @param  list<array{code: string, flags: list<string>}>  $characteristics  dari EngineResult::toArray()
     * @return list<string>
     */
    public static function needsDecision(array $characteristics): array
    {
        $attention = array_map(fn (Flag $f) => $f->value, self::ATTENTION_FLAGS);

        return array_values(array_map(
            fn (array $c) => $c['code'],
            array_filter($characteristics, fn (array $c) => array_intersect($attention, $c['flags']) !== []),
        ));
    }

    /**
     * Semua karakteristik bertanda sudah diputuskan (disesuaikan atau dikukuhkan) dengan alasan tertulis (syarat
     * panel_adjustments_justified).
     *
     * @param  list<string>  $needed
     * @param  array<string, string>  $rationales  kode karakteristik ke alasan keputusan
     */
    public static function decisionsComplete(array $needed, array $rationales): bool
    {
        foreach ($needed as $code) {
            if (mb_strlen(trim($rationales[$code] ?? '')) < self::RATIONALE_MIN) {
                return false;
            }
        }

        return true;
    }

    /**
     * Pemenuhan jalur setara dari baris tersimpan: hanya bila setiap aspek bertingkat memiliki keempat tangga.
     *
     * @param  list<array{aspectCode: string, step: int, percent: float}>  $rows
     * @param  list<string>  $aspectCodes
     * @return array<string, array<int, float>>|null
     */
    public static function sclFulfilment(array $rows, array $aspectCodes): ?array
    {
        if ($aspectCodes === []) {
            return null;
        }
        $out = [];
        foreach ($aspectCodes as $code) {
            foreach (self::SCL_STEPS as $step) {
                $match = array_values(array_filter($rows, fn (array $r) => $r['aspectCode'] === $code && $r['step'] === $step));
                if ($match === []) {
                    return null;
                }
                $out[$code][$step] = $match[0]['percent'] / 100;
            }
        }

        return $out;
    }

    /**
     * Masukan mesin dalam bentuk yang disimpan pada eksekusi: nilai lapisan dan tanda per karakteristik, tanpa
     * jawaban mentah, agar eksekusi final yang disimpan melewati masa retensi tidak memuat data responden.
     *
     * @return array<string, mixed>
     */
    public static function serializeInput(EngineInput $input): array
    {
        return [
            'targetLevel' => $input->targetLevel,
            'sclFulfillment' => $input->sclFulfillment,
            'characteristics' => array_map(fn (CharacteristicInput $c) => [
                'code' => $c->code,
                'aspectCode' => $c->aspectCode,
                'isContextual' => $c->isContextual,
                'perception' => $c->perception,
                'evidence' => $c->evidence,
                'validation' => $c->validation,
                'flags' => Flag::values($c->flags),
            ], $input->characteristics),
        ];
    }

    /**
     * Masukan mesin dari bentuk tersimpan, dengan nilai panel per kode karakteristik.
     *
     * @param  array<string, mixed>  $stored
     * @param  array<string, float>  $panel
     */
    public static function restoreInput(array $stored, array $panel = []): EngineInput
    {
        return new EngineInput(
            characteristics: array_map(fn (array $c) => new CharacteristicInput(
                code: $c['code'],
                aspectCode: $c['aspectCode'],
                isContextual: (bool) $c['isContextual'],
                perception: $c['perception'] === null ? null : (float) $c['perception'],
                evidence: $c['evidence'] === null ? null : (float) $c['evidence'],
                validation: $c['validation'] === null ? null : (float) $c['validation'],
                panelAdjusted: isset($panel[$c['code']]) ? (float) $panel[$c['code']] : null,
                flags: array_map(fn (string $f) => Flag::from($f), $c['flags']),
            ), $stored['characteristics']),
            targetLevel: (float) $stored['targetLevel'],
            sclFulfillment: $stored['sclFulfillment'] ?? null,
        );
    }
}
