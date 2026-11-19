<?php

declare(strict_types=1);

namespace App\Domain\Setup;

/**
 * Parameter asesmen yang boleh disesuaikan asesor utama sebelum dikunci (docs/01 M1), dibawa dari v1
 * src/lib/assessments/parameters.ts. Bobot aspek tidak termasuk: bobot itu mengikuti struktur Safety Culture Ladder.
 *
 * Draf parameter adalah salinan parameter bawaan versi instrumen (tanpa kunci catatan berawalan garis bawah)
 * ditambah hasil kalkulator sampel terakhir (samplePlan). Batas nilai tiap isian diperiksa Form Request; kelas ini
 * memeriksa aturan antarisian dan menggabungkan perubahan ke draf.
 */
final class EditableParameters
{
    /** Batas bawah sel laporan; komitmen pelindungan data, tidak boleh diturunkan (CLAUDE.md aturan 3). */
    public const MIN_REPORT_CELL = 5;

    /** Urutan tingkat pada ambang jalur setara Safety Culture Ladder. */
    public const SCL_STEPS = [2, 3, 4, 5];

    private const SAMPLING_KEYS = ['z', 'marginOfError', 'proportion', 'minParticipationPerStratum'];

    private const QUALITY_KEYS = ['cronbachAlphaMin', 'rwgMin', 'minRespondentsPerReportCell'];

    /**
     * Draf awal dari parameter bawaan versi instrumen.
     *
     * @param  array<string, mixed>  $defaults
     * @return array<string, mixed>
     */
    public static function draftFromDefaults(array $defaults): array
    {
        $clean = array_filter($defaults, static fn (string $key): bool => ! str_starts_with($key, '_'), ARRAY_FILTER_USE_KEY);

        return [...$clean, 'samplePlan' => null];
    }

    /**
     * Hanya bagian yang dapat diubah, untuk formulir.
     *
     * @param  array<string, mixed>  $draft
     * @return array<string, mixed>
     */
    public static function editablePart(array $draft): array
    {
        return [
            'layerWeights' => [
                'perception' => (float) $draft['layerWeights']['perception'],
                'evidence' => (float) $draft['layerWeights']['evidence'],
                'validation' => (float) $draft['layerWeights']['validation'],
            ],
            'selfAssessmentWeightInPerception' => (float) $draft['selfAssessmentWeightInPerception'],
            'divergenceThreshold' => (float) $draft['divergenceThreshold'],
            'consolidation' => [
                'maxAspectBelowLevel' => (float) $draft['consolidation']['maxAspectBelowLevel'],
                'maxCharacteristicBelowLevel' => (float) $draft['consolidation']['maxCharacteristicBelowLevel'],
            ],
            'perceptionGapAttention' => (float) $draft['perceptionGapAttention'],
            'assessorDisagreementFlag' => (float) $draft['assessorDisagreementFlag'],
            'sclThresholds' => array_map(static fn (array $row): array => [
                'step' => (int) $row['step'],
                'minWeightedAverage' => (float) $row['minWeightedAverage'],
                'minPerAspect' => (float) $row['minPerAspect'],
            ], $draft['sclThresholds']),
            'quality' => [
                'cronbachAlphaMin' => (float) $draft['quality']['cronbachAlphaMin'],
                'rwgMin' => (float) $draft['quality']['rwgMin'],
                'minRespondentsPerReportCell' => (int) $draft['quality']['minRespondentsPerReportCell'],
            ],
            'sampling' => [
                'z' => (float) $draft['sampling']['z'],
                'marginOfError' => (float) $draft['sampling']['marginOfError'],
                'proportion' => (float) $draft['sampling']['proportion'],
                'minParticipationPerStratum' => (float) $draft['sampling']['minParticipationPerStratum'],
            ],
        ];
    }

    /**
     * Aturan antarisian. Mengembalikan pasangan isian dan kunci galat (setup.errors.*).
     *
     * @param  array<string, mixed>  $edits
     * @return array<string, string>
     */
    public static function errors(array $edits): array
    {
        $errors = [];
        $weights = $edits['layerWeights'];
        $sum = (float) $weights['perception'] + (float) $weights['evidence'] + (float) $weights['validation'];
        if (abs($sum - 1.0) > 1e-6) {
            $errors['layerWeights'] = 'LAYER_WEIGHTS_SUM';
        }
        $steps = array_map(static fn (array $row): int => (int) $row['step'], $edits['sclThresholds']);
        if ($steps !== self::SCL_STEPS) {
            $errors['sclThresholds'] = 'SCL_STEPS';
        }
        if ((int) $edits['quality']['minRespondentsPerReportCell'] < self::MIN_REPORT_CELL) {
            $errors['quality.minRespondentsPerReportCell'] = 'MIN_REPORT_CELL';
        }

        return $errors;
    }

    /**
     * Menggabungkan perubahan ke draf. Hasil kalkulator sampel dibatalkan bila parameter sampel berubah, karena
     * hasil lama tidak lagi sesuai.
     *
     * @param  array<string, mixed>  $draft
     * @param  array<string, mixed>  $edits  Sudah lolos errors().
     * @return array<string, mixed>
     */
    public static function apply(array $draft, array $edits): array
    {
        $samplingChanged = false;
        foreach (self::SAMPLING_KEYS as $key) {
            if ((float) $edits['sampling'][$key] !== (float) $draft['sampling'][$key]) {
                $samplingChanged = true;
            }
        }

        $thresholds = [];
        foreach ($draft['sclThresholds'] as $row) {
            foreach ($edits['sclThresholds'] as $edited) {
                if ((int) $edited['step'] === (int) $row['step']) {
                    $row['minWeightedAverage'] = (float) $edited['minWeightedAverage'];
                    $row['minPerAspect'] = (float) $edited['minPerAspect'];
                }
            }
            $thresholds[] = $row;
        }

        $quality = $draft['quality'];
        foreach (self::QUALITY_KEYS as $key) {
            $quality[$key] = $key === 'minRespondentsPerReportCell' ? (int) $edits['quality'][$key] : (float) $edits['quality'][$key];
        }
        $sampling = $draft['sampling'];
        foreach (self::SAMPLING_KEYS as $key) {
            $sampling[$key] = (float) $edits['sampling'][$key];
        }

        return [
            ...$draft,
            'layerWeights' => array_map('floatval', $edits['layerWeights']),
            'selfAssessmentWeightInPerception' => (float) $edits['selfAssessmentWeightInPerception'],
            'divergenceThreshold' => (float) $edits['divergenceThreshold'],
            'consolidation' => array_map('floatval', $edits['consolidation']),
            'perceptionGapAttention' => (float) $edits['perceptionGapAttention'],
            'assessorDisagreementFlag' => (float) $edits['assessorDisagreementFlag'],
            'sclThresholds' => $thresholds,
            'quality' => $quality,
            'sampling' => $sampling,
            'samplePlan' => $samplingChanged ? null : ($draft['samplePlan'] ?? null),
        ];
    }

    /**
     * Bobot aspek turunan dari poin maksimum tingkat 5. Tidak dapat diubah; aspek yang dikecualikan dari penetapan
     * tingkat (dimensi kontekstual) tidak ikut.
     *
     * @param  array<string, mixed>  $draft
     * @return list<array{code: string, name: string, weight: float}>
     */
    public static function aspectWeights(array $draft): array
    {
        $aspects = array_values(array_filter(
            $draft['aspects'] ?? [],
            static fn (array $a): bool => empty($a['excludedFromLevel']) && is_array($a['maxPoints'] ?? null),
        ));
        $total = array_sum(array_map(static fn (array $a): float => (float) ($a['maxPoints']['5'] ?? 0), $aspects));
        if ($total <= 0) {
            return [];
        }

        return array_map(static fn (array $a): array => [
            'code' => (string) $a['code'],
            'name' => (string) $a['name'],
            'weight' => (float) ($a['maxPoints']['5'] ?? 0) / $total,
        ], $aspects);
    }
}
