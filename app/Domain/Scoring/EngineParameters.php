<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/**
 * Parameter mesin penilaian. Selalu dibentuk dari Assessment.parameterSnapshot asesmen yang terkunci
 * (berbentuk seed/aspek-dan-parameter.json) melalui fromSnapshot(), bukan dari berkas seed.
 */
final readonly class EngineParameters
{
    /**
     * @param  list<AspectParameter>  $aspects  Urutan daftar ini menentukan urutan agregasi dan aturan seri aspek prioritas.
     * @param  list<SclThreshold>  $sclThresholds
     * @param  int  $minRespondentsPerReportCell  Sel laporan dengan responden di bawah angka ini disembunyikan (bawaan 5).
     */
    public function __construct(
        public LayerWeights $layerWeights,
        public float $selfAssessmentWeightInPerception,
        public float $divergenceThreshold,
        public ConsolidationRule $consolidation,
        public float $perceptionGapAttention,
        public float $assessorDisagreementFlag,
        public array $aspects,
        public array $sclThresholds,
        public int $minRespondentsPerReportCell,
    ) {}

    /**
     * Memetakan snapshot parameter (larik hasil dekode JSON) ke parameter mesin.
     * Padanan toEngineParameters() pada mesin TypeScript lama.
     *
     * @param  array<string, mixed>  $snapshot
     */
    public static function fromSnapshot(array $snapshot): self
    {
        $layerWeights = self::section($snapshot, 'layerWeights');
        $consolidation = self::section($snapshot, 'consolidation');
        $quality = self::section($snapshot, 'quality');

        $aspects = [];
        foreach (self::section($snapshot, 'aspects') as $aspect) {
            if (! is_array($aspect) || ! is_string($aspect['code'] ?? null) || $aspect['code'] === '') {
                throw new EngineInputError('Parameter aspects memuat aspek tanpa kode');
            }
            // Kunci JSON "5" menjadi kunci int 5 setelah dekode; keduanya merujuk elemen yang sama.
            $points = $aspect['maxPoints'][5] ?? null;
            if ($points !== null && ! Numeric::isFiniteNumber($points)) {
                throw new EngineInputError("Poin maksimum tingkat 5 aspek {$aspect['code']} harus berupa angka");
            }
            $excluded = $aspect['excludedFromLevel'] ?? false;
            if (! is_bool($excluded)) {
                throw new EngineInputError("Parameter excludedFromLevel aspek {$aspect['code']} harus benar atau salah");
            }
            $aspects[] = new AspectParameter($aspect['code'], $points === null ? null : (float) $points, $excluded);
        }

        $thresholds = [];
        foreach (self::section($snapshot, 'sclThresholds') as $threshold) {
            $step = is_array($threshold) ? ($threshold['step'] ?? null) : null;
            if (is_float($step) && is_finite($step) && floor($step) === $step) {
                $step = (int) $step;
            }
            if (! in_array($step, [2, 3, 4, 5], true)) {
                $shown = is_scalar($step) ? (string) $step : '?';
                throw new EngineInputError("Tingkat ambang jalur setara {$shown} tidak dikenal");
            }
            $thresholds[] = new SclThreshold(
                $step,
                self::number($threshold, 'minWeightedAverage', "sclThresholds tingkat {$step}"),
                self::number($threshold, 'minPerAspect', "sclThresholds tingkat {$step}"),
            );
        }

        $minRespondents = self::number($quality, 'minRespondentsPerReportCell', 'quality');
        if (floor($minRespondents) !== $minRespondents || $minRespondents < 0) {
            throw new EngineInputError('Parameter quality.minRespondentsPerReportCell harus bilangan bulat tak negatif');
        }

        return new self(
            layerWeights: new LayerWeights(
                self::number($layerWeights, 'perception', 'layerWeights'),
                self::number($layerWeights, 'evidence', 'layerWeights'),
                self::number($layerWeights, 'validation', 'layerWeights'),
            ),
            selfAssessmentWeightInPerception: self::number($snapshot, 'selfAssessmentWeightInPerception'),
            divergenceThreshold: self::number($snapshot, 'divergenceThreshold'),
            consolidation: new ConsolidationRule(
                self::number($consolidation, 'maxAspectBelowLevel', 'consolidation'),
                self::number($consolidation, 'maxCharacteristicBelowLevel', 'consolidation'),
            ),
            perceptionGapAttention: self::number($snapshot, 'perceptionGapAttention'),
            assessorDisagreementFlag: self::number($snapshot, 'assessorDisagreementFlag'),
            aspects: $aspects,
            sclThresholds: $thresholds,
            minRespondentsPerReportCell: (int) $minRespondents,
        );
    }

    /**
     * @param  array<array-key, mixed>  $source
     * @return array<array-key, mixed>
     */
    private static function section(array $source, string $key): array
    {
        $value = $source[$key] ?? null;
        if (! is_array($value)) {
            throw new EngineInputError("Parameter {$key} tidak tersedia pada snapshot");
        }

        return $value;
    }

    /** @param  array<array-key, mixed>  $source */
    private static function number(array $source, string $key, string $parent = ''): float
    {
        $value = $source[$key] ?? null;
        if (! Numeric::isFiniteNumber($value)) {
            $path = $parent === '' ? $key : "{$parent}.{$key}";
            throw new EngineInputError("Parameter {$path} tidak tersedia atau bukan angka");
        }

        return (float) $value;
    }
}
