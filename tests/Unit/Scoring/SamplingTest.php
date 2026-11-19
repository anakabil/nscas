<?php

declare(strict_types=1);

namespace Tests\Unit\Scoring;

use App\Domain\Scoring\EngineParameters;
use App\Domain\Scoring\Numeric;
use App\Domain\Scoring\SampleCalculator;
use PHPUnit\Framework\TestCase;

/** Tes kalkulator sampel di luar fixture: validasi masukan, pembulatan kebal floating point, dan pemetaan parameter. */
final class SamplingTest extends TestCase
{
    use ScoringTestSupport;

    // ---------------------------------------------------------------------------------------------
    // ceilSafe
    // ---------------------------------------------------------------------------------------------

    public function test_ceil_safe_matches_excel_roundup_and_is_immune_to_floating_point_error(): void
    {
        // 0,07 x 100 = 7,000000000000001 dalam IEEE 754; ceil memberi 8, ceilSafe memberi 7
        $this->assertSame(8.0, ceil(0.07 * 100));
        $this->assertSame(7, Numeric::ceilSafe(0.07 * 100));
        // 0,1 x 3 x 120 = 36,00000000000001; ceil memberi 37, ceilSafe memberi 36
        $this->assertSame(36, Numeric::ceilSafe(0.1 * 3 * 120));
        $this->assertSame(37, Numeric::ceilSafe(36.000001));
        $this->assertSame(36, Numeric::ceilSafe(36));
        // Contoh pada docs/03 bagian 1: 0,3 x 120 tepat 36.
        $this->assertSame(36, Numeric::ceilSafe(0.3 * 120));
        $this->assertSame(0, Numeric::ceilSafe(0.0));
        $this->assertSame(1e-9, Numeric::EPS);
    }

    // ---------------------------------------------------------------------------------------------
    // samplePlan
    // ---------------------------------------------------------------------------------------------

    public function test_stratum_target_never_exceeds_its_population(): void
    {
        // Strata 3 orang dari 3.000 pekerja: ceilSafe(0,001 x 353) = 1, ceilSafe(0,3 x 3) = 1, min(3, 1) = 1
        // Strata 2.997: ceilSafe(0,999 x 353) = 353, ceilSafe(0,3 x 2997) = 900, min(2997, 900) = 900
        $plan = SampleCalculator::samplePlan(
            workers: 3000,
            projects: 1,
            locations: 1,
            strata: [
                ['code' => 'S1', 'population' => 3],
                ['code' => 'S2', 'population' => 2997],
            ],
        );

        $this->assertSame([1, 900], array_column($plan->strata, 'surveyTarget'));
        $this->assertSame(1, $plan->projectsToVisit);
        $this->assertSame(1, $plan->locationsToVisit);
    }

    public function test_small_stratum_is_surveyed_in_full_and_whole_population_stratum_has_float_proportion(): void
    {
        // Satu strata berisi seluruh 2 pekerja: Slovin ceilSafe(2 / 1,005) = 2; sasaran min(2, max(2, 1)) = 2.
        // Khusus PHP: 2 / 2 menghasilkan int 1, sedangkan proporsi wajib float 1,0.
        $plan = SampleCalculator::samplePlan(workers: 2, projects: 1, locations: 1, strata: [['code' => 'S1', 'population' => 2]]);

        $this->assertSame(1.0, $plan->strata[0]['proportion']);
        $this->assertSame(2, $plan->strata[0]['surveyTarget']);
        $this->assertSame(2, $plan->surveyTargetTotal);
    }

    public function test_at_least_one_project_is_visited_even_without_running_projects(): void
    {
        $plan = SampleCalculator::samplePlan(workers: 50, projects: 0, locations: 0, strata: []);

        $this->assertSame(1, $plan->projectsToVisit);
        $this->assertSame(0, $plan->locationsToVisit);
        $this->assertSame([], $plan->strata);
        $this->assertSame(0, $plan->surveyTargetTotal);
    }

    public function test_rejects_counts_that_are_not_non_negative_integers(): void
    {
        self::assertEngineInputError(static fn () => SampleCalculator::samplePlan(workers: 0, projects: 1, locations: 1, strata: []));
        self::assertEngineInputError(static fn () => SampleCalculator::samplePlan(workers: 10.5, projects: 1, locations: 1, strata: []));
        self::assertEngineInputError(static fn () => SampleCalculator::samplePlan(workers: 10, projects: -1, locations: 1, strata: []));
        self::assertEngineInputError(
            static fn () => SampleCalculator::samplePlan(workers: 10, projects: 1, locations: 1, strata: [['code' => 'S1', 'population' => -5]]),
            '/S1/',
        );
    }

    public function test_accepts_whole_number_floats_like_the_typescript_engine(): void
    {
        // Number.isInteger(3000.0) benar di JavaScript; angka dari JSON dapat tiba sebagai float.
        $plan = SampleCalculator::samplePlan(workers: 3000.0, projects: 40.0, locations: 12.0, strata: [['code' => 'S1', 'population' => 15.0]]);

        $this->assertSame(3000, $plan->inputs['M']);
        $this->assertSame(353, $plan->recommendedSurvey);
        $this->assertSame(5, $plan->strata[0]['surveyTarget']);
    }

    // ---------------------------------------------------------------------------------------------
    // EngineParameters::fromSnapshot (toEngineParameters pada mesin lama)
    // ---------------------------------------------------------------------------------------------

    public function test_from_snapshot_rejects_unknown_scl_threshold_step(): void
    {
        $snapshot = self::seedParameters();
        $snapshot['sclThresholds'][] = ['step' => 6, 'criteria' => 0, 'minWeightedAverage' => 0.9, 'minPerAspect' => 0.8];

        self::assertEngineInputError(static fn () => EngineParameters::fromSnapshot($snapshot), '/6/');
    }

    public function test_from_snapshot_maps_contextual_aspect_without_points_as_excluded_from_level(): void
    {
        $params = self::params();
        $byCode = [];
        foreach ($params->aspects as $aspect) {
            $byCode[$aspect->code] = $aspect;
        }

        $this->assertSame(['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'KT'], array_keys($byCode));
        $this->assertSame(['code' => 'KT', 'maxPointsStep5' => null, 'excludedFromLevel' => true], $byCode['KT']->toArray());
        $this->assertSame(4800.0, $byCode['A1']->maxPointsStep5);
        $this->assertFalse($byCode['A1']->excludedFromLevel);
    }

    public function test_from_snapshot_reads_every_engine_parameter_from_the_seed_shape(): void
    {
        $params = self::params();

        $this->assertSame(['perception' => 0.35, 'evidence' => 0.4, 'validation' => 0.25], $params->layerWeights->toArray());
        $this->assertSame(0.3, $params->selfAssessmentWeightInPerception);
        $this->assertSame(1.0, $params->divergenceThreshold);
        $this->assertSame(0.5, $params->consolidation->maxAspectBelowLevel);
        $this->assertSame(1.0, $params->consolidation->maxCharacteristicBelowLevel);
        $this->assertSame(0.5, $params->perceptionGapAttention);
        $this->assertSame(1.0, $params->assessorDisagreementFlag);
        $this->assertSame(5, $params->minRespondentsPerReportCell);
        // docs/03 bagian 5: ambang rata-rata tertimbang dan ambang minimum setiap aspek.
        $this->assertSame(
            [[2, 0.75, 0.70], [3, 0.80, 0.70], [4, 0.80, 0.75], [5, 0.85, 0.75]],
            array_map(static fn ($t): array => [$t->step, $t->minWeightedAverage, $t->minPerAspect], $params->sclThresholds),
        );
    }

    public function test_from_snapshot_rejects_missing_or_non_numeric_parameters(): void
    {
        $seed = self::seedParameters();

        $missing = $seed;
        unset($missing['divergenceThreshold']);
        self::assertEngineInputError(static fn () => EngineParameters::fromSnapshot($missing), '/divergenceThreshold/');

        $asString = $seed;
        $asString['layerWeights']['evidence'] = '0.4';
        self::assertEngineInputError(static fn () => EngineParameters::fromSnapshot($asString), '/layerWeights\.evidence/');

        $noQuality = $seed;
        unset($noQuality['quality']);
        self::assertEngineInputError(static fn () => EngineParameters::fromSnapshot($noQuality), '/quality/');
    }
}
