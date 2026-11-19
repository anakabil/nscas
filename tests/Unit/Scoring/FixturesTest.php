<?php

declare(strict_types=1);

namespace Tests\Unit\Scoring;

use App\Domain\Scoring\DataQuality;
use App\Domain\Scoring\EngineInput;
use App\Domain\Scoring\EngineResult;
use App\Domain\Scoring\Flag;
use App\Domain\Scoring\SampleCalculator;
use App\Domain\Scoring\SamplePlan;
use App\Domain\Scoring\ScoringEngine;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Tes fixture mesin penilaian. Fixture di seed/fixtures/ adalah sumber kebenaran
 * (dibuat oleh seed/fixtures/referensi_skoring.py). Bila hasil berbeda, yang salah adalah kode.
 */
final class FixturesTest extends TestCase
{
    use ScoringTestSupport;

    // ---------------------------------------------------------------------------------------------
    // Parameter seed selaras dengan rujukan Python
    // ---------------------------------------------------------------------------------------------

    public function test_seed_layer_weights_and_divergence_threshold_match_simulation_fixture(): void
    {
        $params = self::params();
        $fixture = self::fixture('skoring-simulasi');

        $checked = self::assertMatchesFixture(
            ['layerWeights' => $params->layerWeights->toArray(), 'divergenceThreshold' => $params->divergenceThreshold],
            [
                'layerWeights' => $fixture['parameters']['layerWeights'],
                'divergenceThreshold' => $fixture['parameters']['divergenceThreshold'],
            ],
        );
        $this->assertSame(4, $checked);
    }

    // ---------------------------------------------------------------------------------------------
    // skoring-simulasi.json (lembar 08 Simulasi Skoring)
    // ---------------------------------------------------------------------------------------------

    private static function simulationResult(): EngineResult
    {
        $fixture = self::fixture('skoring-simulasi');

        return ScoringEngine::runEngine(
            new EngineInput(
                characteristics: self::simulationCharacteristics(),
                targetLevel: $fixture['parameters']['targetLevel'],
                sclFulfillment: $fixture['input']['sclFulfillment'],
            ),
            self::params(),
        );
    }

    public function test_simulation_every_characteristic_aspect_organization_and_scl_value_matches_fixture(): void
    {
        $expected = self::fixture('skoring-simulasi')['expected'];

        $checked = self::assertMatchesFixture(self::simulationResult()->toArray(), $expected);

        $this->assertSame(self::countLeaves($expected), $checked);
        // 18 karakteristik x 6 nilai skalar + 1 tanda, 6 aspek x 4, organisasi 8, jalur setara 4 x 5 + 1.
        $this->assertSame(162, $checked);
    }

    public function test_simulation_organization_index_level_consolidation_priority_and_contextual_index(): void
    {
        $result = self::simulationResult();

        self::assertCloseTo(3.143463, $result->organization->index, 6);
        $this->assertSame(3, $result->organization->indicativeLevel);
        $this->assertTrue($result->organization->consolidated);
        $this->assertSame('A1', $result->organization->priorityAspect);
        self::assertCloseTo(3.165, $result->organization->contextualIndex, 6);
        $this->assertNotNull($result->sclTrack);
        $this->assertSame(3, $result->sclTrack->indicativeLevel);
        $this->assertSame(ScoringEngine::ENGINE_VERSION, $result->engineVersion);
    }

    public function test_simulation_aspect_weights_follow_points_over_eighteen_thousand(): void
    {
        // docs/03 bagian 4: A1 26,67 persen; A2 10,00; A3 19,17; A4 17,78; A5 21,94; A6 4,44.
        $weights = ScoringEngine::aspectWeights(self::params());

        $this->assertSame(['A1', 'A2', 'A3', 'A4', 'A5', 'A6'], array_keys($weights));
        self::assertCloseTo(4800 / 18000, $weights['A1'], 12);
        self::assertCloseTo(1800 / 18000, $weights['A2'], 12);
        self::assertCloseTo(3450 / 18000, $weights['A3'], 12);
        self::assertCloseTo(3200 / 18000, $weights['A4'], 12);
        self::assertCloseTo(3950 / 18000, $weights['A5'], 12);
        self::assertCloseTo(800 / 18000, $weights['A6'], 12);
        self::assertCloseTo(1.0, array_sum($weights), 12);
    }

    // ---------------------------------------------------------------------------------------------
    // sampel-3000.json (lembar 09 Kalkulator Sampel)
    // ---------------------------------------------------------------------------------------------

    private static function samplePlanFromFixture(): SamplePlan
    {
        $expected = self::fixture('sampel-3000')['expected'];
        $sampling = self::seedParameters()['sampling'];

        return SampleCalculator::samplePlan(
            workers: $expected['inputs']['M'],
            projects: $expected['inputs']['projects'],
            locations: $expected['inputs']['locations'],
            strata: array_map(
                static fn (array $s): array => ['code' => $s['code'], 'name' => $s['name'], 'population' => $s['population']],
                $expected['strata'],
            ),
            z: $expected['inputs']['z'],
            marginOfError: $expected['inputs']['e'],
            proportion: $expected['inputs']['p'],
            minParticipation: $expected['inputs']['minParticipation'],
            interviewFactorManagement: $sampling['sclInterviewFactorManagement'],
            interviewFactorOperational: $sampling['sclInterviewFactorOperational'],
            projectFactor: $sampling['sclProjectFactor'],
        );
    }

    public function test_sample_every_calculator_value_matches_fixture(): void
    {
        $expected = self::fixture('sampel-3000')['expected'];

        $checked = self::assertMatchesFixture(self::samplePlanFromFixture()->toArray(), $expected);

        $this->assertSame(self::countLeaves($expected), $checked);
        // 7 masukan, 10 angka ringkasan, 5 strata x 5 nilai.
        $this->assertSame(42, $checked);
    }

    public function test_sample_headline_numbers_for_three_thousand_workers(): void
    {
        $plan = self::samplePlanFromFixture();

        $this->assertSame(33, $plan->sclMinimumInterviewManagement);
        $this->assertSame(66, $plan->sclMinimumInterviewOperational);
        $this->assertSame(353, $plan->slovin);
        $this->assertSame(341, $plan->cochranCorrected);
        $this->assertSame(901, $plan->surveyTargetTotal);
        // Sisa angka pada docs/03 bagian 7.
        $this->assertSame(99, $plan->sclMinimumInterviewTotal);
        $this->assertSame(353, $plan->recommendedSurvey);
        $this->assertSame(4, $plan->projectsToVisit);
        $this->assertSame(4, $plan->locationsToVisit);
        $this->assertSame([5, 36, 90, 540, 230], array_column($plan->strata, 'surveyTarget'));
    }

    public function test_sample_defaults_equal_seed_sampling_parameters(): void
    {
        // Nilai bawaan argumen harus sama dengan seed, sehingga pemanggilan tanpa parameter opsional memberi hasil fixture.
        $expected = self::fixture('sampel-3000')['expected'];
        $plan = SampleCalculator::samplePlan(
            workers: 3000,
            projects: 40,
            locations: 12,
            strata: array_map(
                static fn (array $s): array => ['code' => $s['code'], 'name' => $s['name'], 'population' => $s['population']],
                $expected['strata'],
            ),
        );

        $this->assertSame(self::countLeaves($expected), self::assertMatchesFixture($plan->toArray(), $expected));
    }

    // ---------------------------------------------------------------------------------------------
    // kasus-tepi.json
    // ---------------------------------------------------------------------------------------------

    /** @return array<string, array{string}> */
    public static function characteristicCases(): array
    {
        return [
            'contohDeck' => ['contohDeck'],
            'selisihTepatSatu' => ['selisihTepatSatu'],
            'selisihDiBawahSatu' => ['selisihDiBawahSatu'],
            'buktiLebihTinggiDariPersepsi' => ['buktiLebihTinggiDariPersepsi'],
            'validasiKosong' => ['validasiKosong'],
        ];
    }

    #[DataProvider('characteristicCases')]
    public function test_edge_case_characteristic_score(string $name): void
    {
        $case = self::fixture('kasus-tepi')[$name];
        $params = self::params();

        $score = ScoringEngine::scoreCharacteristic(
            $case['input']['p'],
            $case['input']['e'],
            $case['input']['v'],
            $params->layerWeights,
            $params->divergenceThreshold,
        );

        $checked = self::assertMatchesFixture($score->toArray(), $case['expected']);
        $this->assertSame(self::countLeaves($case['expected']), $checked);
        $this->assertSame($case['expected']['flags'], Flag::values($score->flags));
    }

    public function test_edge_case_deck_example_drops_from_two_ninety_two_to_two_forty(): void
    {
        // Contoh pada paparan: G = 2,92 tetapi |P - E| = 1,2 >= 1,00, sehingga F = min(2,92; 2,40) = 2,40.
        $params = self::params();
        $score = ScoringEngine::scoreCharacteristic(3.60, 2.40, 2.80, $params->layerWeights, $params->divergenceThreshold);

        self::assertCloseTo(2.92, $score->combined, 12);
        $this->assertSame(2.40, $score->final);
    }

    public function test_edge_case_level_is_capped_at_five(): void
    {
        $case = self::fixture('kasus-tepi')['tingkatDibatasiLima'];

        $this->assertSame($case['expected'], ScoringEngine::indicativeLevel($case['input']['orgIndex']));
        $this->assertSame(5, ScoringEngine::indicativeLevel(7.3));
    }

    public function test_edge_case_level_survives_floating_point_rounding(): void
    {
        $case = self::fixture('kasus-tepi')['tingkatPembulatanFloatingPoint'];

        $this->assertSame($case['expected'], ScoringEngine::indicativeLevel($case['input']['orgIndex']));
        // Nilai asli sebelum fixture dibulatkan ke enam desimal oleh referensi_skoring.py.
        $this->assertSame($case['expected'], ScoringEngine::indicativeLevel(2.9999999999999996));
        // Tanpa EPS, floor memberi 2.
        $this->assertSame(2.0, floor(2.9999999999999996));
    }

    /** @return array<string, array{string}> */
    public static function perceptionCases(): array
    {
        return [
            'persepsiPembobotanStrata' => ['persepsiPembobotanStrata'],
            'persepsiTanpaPenilaianMandiri' => ['persepsiTanpaPenilaianMandiri'],
        ];
    }

    #[DataProvider('perceptionCases')]
    public function test_edge_case_perception(string $name): void
    {
        $case = self::fixture('kasus-tepi')[$name];

        $result = ScoringEngine::perception(
            $case['input']['answersByStratum'],
            $case['input']['populationByStratum'],
            $case['input']['selfAssessmentLevels'],
            $case['input']['alpha'],
        );

        $this->assertSame(3, self::assertMatchesFixture($result->toArray(), $case['expected']));
    }

    /** @return array<string, array{string}> */
    public static function rwgCases(): array
    {
        return [
            'rwgSatuButir' => ['rwgSatuButir'],
            'rwgSebaranLebar' => ['rwgSebaranLebar'],
        ];
    }

    #[DataProvider('rwgCases')]
    public function test_edge_case_rwg_single_item(string $name): void
    {
        $case = self::fixture('kasus-tepi')[$name];

        $this->assertSame(1, self::assertMatchesFixture(DataQuality::rwgSingle($case['input']['values']), $case['expected']));
    }

    public function test_edge_case_cronbach_alpha(): void
    {
        $case = self::fixture('kasus-tepi')['alphaCronbach'];

        $this->assertSame(1, self::assertMatchesFixture(DataQuality::cronbachAlpha($case['input']['matrix']), $case['expected']));
    }

    public function test_every_edge_case_in_fixture_has_a_test(): void
    {
        // Menjaga agar kasus baru di kasus-tepi.json tidak terlewat tanpa tes.
        $names = array_values(array_filter(
            array_keys(self::fixture('kasus-tepi')),
            static fn (string $key): bool => ! str_starts_with($key, '_'),
        ));
        $covered = [
            ...array_keys(self::characteristicCases()),
            'tingkatDibatasiLima',
            'tingkatPembulatanFloatingPoint',
            ...array_keys(self::perceptionCases()),
            ...array_keys(self::rwgCases()),
            'alphaCronbach',
        ];

        $this->assertSame($names, $covered);
    }
}
