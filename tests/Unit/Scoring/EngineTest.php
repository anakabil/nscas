<?php

declare(strict_types=1);

namespace Tests\Unit\Scoring;

use App\Domain\Scoring\AspectParameter;
use App\Domain\Scoring\CharacteristicDefinition;
use App\Domain\Scoring\CharacteristicInput;
use App\Domain\Scoring\EngineInput;
use App\Domain\Scoring\EngineInputError;
use App\Domain\Scoring\EvidenceRatingInput;
use App\Domain\Scoring\Flag;
use App\Domain\Scoring\RawAssessmentInput;
use App\Domain\Scoring\ScoringEngine;
use App\Domain\Scoring\SelfAssessmentInput;
use App\Domain\Scoring\SelfAssessmentStatus;
use App\Domain\Scoring\StratumGroup;
use App\Domain\Scoring\StratumInput;
use App\Domain\Scoring\SurveyResponseInput;
use App\Domain\Scoring\ValidationRatingInput;
use PHPUnit\Framework\TestCase;

/** Tes mesin penilaian untuk bagian yang tidak tercakup fixture, dengan nilai yang dihitung tangan. */
final class EngineTest extends TestCase
{
    use ScoringTestSupport;

    /** @return list<StratumInput> */
    private static function strata(): array
    {
        return [
            new StratumInput('S1', StratumGroup::Management, 15),
            new StratumInput('S2', StratumGroup::Management, 120),
            new StratumInput('S3', StratumGroup::Supervisory, 300),
            new StratumInput('S4', StratumGroup::Field, 1800),
            new StratumInput('S5', StratumGroup::Field, 765),
        ];
    }

    /** @param  array<string, int|float|null>  $answers */
    private static function response(string $stratumCode, array $answers, bool $excluded = false): SurveyResponseInput
    {
        return new SurveyResponseInput($stratumCode, $answers, $excluded);
    }

    private static function evidence(string $assessorId, float $level, string $code = 'K1.1'): EvidenceRatingInput
    {
        return new EvidenceRatingInput($code, $assessorId, $level);
    }

    private static function validation(string $sessionId, float $level, string $assessorId = 'a', string $code = 'K1.1'): ValidationRatingInput
    {
        return new ValidationRatingInput($sessionId, $code, $assessorId, $level);
    }

    /** Data mentah satu karakteristik yang persepsinya sama dengan fixture persepsiPembobotanStrata. */
    private static function singleCharacteristicRaw(): RawAssessmentInput
    {
        $answersByStratum = self::fixture('kasus-tepi')['persepsiPembobotanStrata']['input']['answersByStratum'];
        $responses = [];
        foreach ($answersByStratum as $stratum => $answers) {
            foreach ($answers as $answer) {
                $responses[] = self::response($stratum, ['K1.1' => $answer]);
            }
        }

        return new RawAssessmentInput(
            characteristics: [new CharacteristicDefinition('K1.1', 'A1', false)],
            strata: self::strata(),
            surveyResponses: [
                ...$responses,
                // Respons yang dikeluarkan setelah ditinjau asesor tidak dihitung.
                self::response('S4', ['K1.1' => 5], true),
            ],
            selfAssessments: [
                new SelfAssessmentInput(SelfAssessmentStatus::Submitted, ['K1.1' => 4]),
                new SelfAssessmentInput(SelfAssessmentStatus::Submitted, ['K1.1' => 4]),
                // Draf tidak dihitung.
                new SelfAssessmentInput(SelfAssessmentStatus::Draft, ['K1.1' => 1]),
            ],
            evidenceRatings: [self::evidence('a', 3), self::evidence('b', 2.5)],
            validationRatings: [
                self::validation('s1', 3, 'a'),
                self::validation('s1', 3.5, 'b'),
                self::validation('s2', 2.5, 'a'),
            ],
            targetLevel: 4,
        );
    }

    // ---------------------------------------------------------------------------------------------
    // Lapisan bukti
    // ---------------------------------------------------------------------------------------------

    public function test_evidence_is_mean_of_assessors_without_flags_when_two_assessors_agree(): void
    {
        // (3,0 + 2,5) / 2 = 2,75; selisih 0,5 tidak lebih dari 1,00
        $result = ScoringEngine::evidenceLayer([self::evidence('a', 3), self::evidence('b', 2.5)], 1);

        $this->assertSame(['value' => 2.75, 'flags' => []], $result->toArray());
    }

    public function test_evidence_single_assessor_is_flagged(): void
    {
        $result = ScoringEngine::evidenceLayer([self::evidence('a', 3.5)], 1);

        $this->assertSame(3.5, $result->value);
        $this->assertSame([Flag::PenilaiTunggal], $result->flags);
        $this->assertSame(['value' => 3.5, 'flags' => ['PENILAI_TUNGGAL']], $result->toArray());
    }

    public function test_evidence_needs_reconciliation_above_one_but_not_at_exactly_one(): void
    {
        // 4,5 - 3,0 = 1,5 > 1,00
        $this->assertSame(
            [Flag::PerluRekonsiliasi],
            ScoringEngine::evidenceLayer([self::evidence('a', 3), self::evidence('b', 4.5)], 1)->flags,
        );
        // 4,0 - 3,0 = 1,00, bukan "lebih dari"
        $this->assertSame([], ScoringEngine::evidenceLayer([self::evidence('a', 3), self::evidence('b', 4)], 1)->flags);
    }

    public function test_evidence_is_empty_without_ratings(): void
    {
        $this->assertSame(['value' => null, 'flags' => []], ScoringEngine::evidenceLayer([], 1)->toArray());
    }

    // ---------------------------------------------------------------------------------------------
    // Lapisan validasi
    // ---------------------------------------------------------------------------------------------

    public function test_validation_averages_per_session_then_across_sessions(): void
    {
        // Sesi 1: (3,0 + 3,5) / 2 = 3,25; sesi 2: 2,5; V = (3,25 + 2,5) / 2 = 2,875
        // Bukan rata-rata seluruh nilai (3 + 3,5 + 2,5) / 3 = 3,0
        $this->assertSame(2.875, ScoringEngine::validationLayer([
            self::validation('s1', 3, 'a'),
            self::validation('s1', 3.5, 'b'),
            self::validation('s2', 2.5, 'a'),
        ]));
    }

    public function test_validation_is_empty_when_no_session_rated(): void
    {
        $this->assertNull(ScoringEngine::validationLayer([]));
    }

    // ---------------------------------------------------------------------------------------------
    // Gabungan lapisan
    // ---------------------------------------------------------------------------------------------

    public function test_combine_flags_all_layers_empty(): void
    {
        $result = ScoringEngine::combineLayers(null, null, null, self::params()->layerWeights);

        $this->assertSame(['combined' => null, 'flags' => ['SEMUA_LAPISAN_KOSONG']], $result->toArray());
    }

    public function test_combine_evidence_only_normalizes_weight_to_one(): void
    {
        // 0,40 x 3,2 / 0,40 = 3,2 (dibandingkan dengan toleransi karena galat floating point)
        $result = ScoringEngine::combineLayers(null, 3.2, null, self::params()->layerWeights);

        self::assertCloseTo(3.2, $result->combined, 12);
        $this->assertSame([Flag::LapisanTidakLengkap], $result->flags);
    }

    // ---------------------------------------------------------------------------------------------
    // Skor survei berbobot populasi
    // ---------------------------------------------------------------------------------------------

    public function test_survey_score_rejects_stratum_without_population(): void
    {
        self::assertEngineInputError(static fn () => ScoringEngine::surveyScore(['S9' => [3]], ['S1' => 15]), '/S9/');
    }

    public function test_survey_score_is_null_when_every_answer_is_dont_know(): void
    {
        $this->assertNull(ScoringEngine::surveyScore(['S1' => [null, null]], ['S1' => 15]));
    }

    // ---------------------------------------------------------------------------------------------
    // Pembangun lapisan dari data mentah
    // ---------------------------------------------------------------------------------------------

    public function test_build_inputs_perception_matches_fixture_evidence_and_validation_are_exact(): void
    {
        $expected = self::fixture('kasus-tepi')['persepsiPembobotanStrata']['expected'];

        $inputs = ScoringEngine::buildCharacteristicInputs(self::singleCharacteristicRaw(), self::params());

        $this->assertCount(1, $inputs);
        $c = $inputs[0];
        self::assertCloseTo($expected['perception'], $c->perception, 6);
        $this->assertSame(2.75, $c->evidence);
        $this->assertSame(2.875, $c->validation);
        $this->assertNull($c->panelAdjusted);
        $this->assertSame([], $c->flags);
    }

    public function test_characteristic_index_from_raw_data(): void
    {
        // P = 0,7 x 2,669251 + 0,3 x 4 = 3,068475; E = 2,75; V = 2,875
        // G = 0,35 x 3,068475 + 0,40 x 2,75 + 0,25 x 2,875 = 1,073966 + 1,1 + 0,71875 = 2,892716
        // |P - E| = 0,318 < 1,00, sehingga F = G
        $params = self::params();
        $result = ScoringEngine::runEngine(
            new EngineInput(ScoringEngine::buildCharacteristicInputs(self::singleCharacteristicRaw(), $params), 4),
            self::with($params, ['aspects' => [new AspectParameter('A1', 4800, false)]]),
        );

        self::assertCloseTo(2.8927164, $result->characteristics[0]->combined, 6);
        self::assertCloseTo(2.8927164, $result->characteristics[0]->final, 6);
    }

    public function test_build_inputs_rejects_values_outside_one_to_five(): void
    {
        $raw = self::singleCharacteristicRaw();
        $params = self::params();

        self::assertEngineInputError(static fn () => ScoringEngine::buildCharacteristicInputs(
            self::with($raw, ['evidenceRatings' => [self::evidence('a', 6)]]),
            $params,
        ), '/Nilai bukti K1\.1/');
        self::assertEngineInputError(static fn () => ScoringEngine::buildCharacteristicInputs(
            self::with($raw, ['surveyResponses' => [self::response('S1', ['K1.1' => 0])]]),
            $params,
        ), '/Jawaban survei K1\.1/');
        self::assertEngineInputError(static fn () => ScoringEngine::buildCharacteristicInputs(
            self::with($raw, ['panelAdjustments' => ['K1.1' => 5.5]]),
            $params,
        ), '/Penyesuaian panel K1\.1/');
    }

    public function test_build_inputs_distinguishes_dont_know_from_unanswered_and_rejects_non_numeric_answers(): void
    {
        // Khusus PHP: null berarti "Tidak tahu" (kunci ada), kunci yang hilang berarti tidak dijawab, dan
        // string angka dari basis data tidak boleh diam-diam diperlakukan sebagai angka.
        $raw = self::with(self::singleCharacteristicRaw(), [
            'surveyResponses' => [
                self::response('S4', ['K1.1' => 3]),
                self::response('S4', ['K1.1' => null]),
                self::response('S4', []),
                self::response('S5', ['K1.1' => null]),
            ],
            'selfAssessments' => [],
        ]);
        $params = self::params();

        // Hanya satu jawaban sah (3) di S4; S5 tanpa jawaban sah tidak ikut dibobot.
        $this->assertSame(3.0, ScoringEngine::buildCharacteristicInputs($raw, $params)[0]->perception);

        self::assertEngineInputError(static fn () => ScoringEngine::buildCharacteristicInputs(
            self::with($raw, ['surveyResponses' => [self::response('S4', ['K1.1' => '3'])]]),
            $params,
        ), '/Jawaban survei K1\.1/');
    }

    // ---------------------------------------------------------------------------------------------
    // scoreAssessment dari data mentah
    // ---------------------------------------------------------------------------------------------

    public function test_score_assessment_from_raw_data_reproduces_simulation_fixture(): void
    {
        // Data mentah yang menghasilkan nilai P, E, V simulasi: dua responden strata S4 yang rata-ratanya P,
        // dua asesor memberi nilai E, dan satu sesi validasi memberi nilai V.
        $fixture = self::fixture('skoring-simulasi');
        $defs = $fixture['input']['characteristics'];
        $low = [];
        $high = [];
        $evidenceRatings = [];
        $validationRatings = [];
        foreach ($defs as $c) {
            $low[$c['code']] = $c['p'] - 0.2;
            $high[$c['code']] = $c['p'] + 0.2;
            $evidenceRatings[] = self::evidence('a', $c['e'], $c['code']);
            $evidenceRatings[] = self::evidence('b', $c['e'], $c['code']);
            $validationRatings[] = self::validation('s1', $c['v'], 'a', $c['code']);
        }
        $raw = new RawAssessmentInput(
            characteristics: array_map(
                static fn (array $c): CharacteristicDefinition => new CharacteristicDefinition($c['code'], $c['aspectCode'], $c['isContextual']),
                $defs,
            ),
            strata: self::strata(),
            surveyResponses: [self::response('S4', $low), self::response('S4', $high)],
            selfAssessments: [],
            evidenceRatings: $evidenceRatings,
            validationRatings: $validationRatings,
            targetLevel: 4,
            sclFulfillment: $fixture['input']['sclFulfillment'],
        );

        $result = ScoringEngine::scoreAssessment($raw, self::params());

        $this->assertSame(ScoringEngine::ENGINE_VERSION, $result->engineVersion);
        self::assertCloseTo($fixture['expected']['organization']['index'], $result->organization->index, 6);
        $this->assertSame(3, $result->organization->indicativeLevel);
        $this->assertSame(3, $result->sclTrack?->indicativeLevel);
        // Seluruh keluaran, bukan hanya indeks organisasi, sama dengan fixture.
        $this->assertSame(
            self::countLeaves($fixture['expected']),
            self::assertMatchesFixture($result->toArray(), $fixture['expected']),
        );
    }

    // ---------------------------------------------------------------------------------------------
    // Penyesuaian panel
    // ---------------------------------------------------------------------------------------------

    public function test_panel_value_drives_aggregation_while_engine_value_is_kept(): void
    {
        // K1.3 F = 2,0 (aturan selisih). Panel menetapkan 2,6:
        // I_A1 = (3,26 + 3,14 + 2,6) / 3 = 3,0, naik 0,2 dari 2,8
        // O naik 0,2 x 4800/18000 = 0,053333, menjadi 3,143463 + 0,053333 = 3,196796
        $characteristics = array_map(
            static fn (CharacteristicInput $c): CharacteristicInput => $c->code === 'K1.3' ? self::with($c, ['panelAdjusted' => 2.6]) : $c,
            self::simulationCharacteristics(),
        );

        $result = ScoringEngine::runEngine(new EngineInput($characteristics, 4), self::params());

        $k13 = array_values(array_filter($result->characteristics, static fn ($c): bool => $c->code === 'K1.3'))[0];
        self::assertCloseTo(2.0, $k13->final, 12);
        $this->assertSame(2.6, $k13->panelAdjusted);
        $this->assertSame(2.6, ScoringEngine::effectiveValue($k13));
        self::assertCloseTo(3.0, $result->aspects['A1']->index, 12);
        self::assertCloseTo(3.143463 + 0.2 * (4800 / 18000), $result->organization->index, 6);
        $this->assertNull($result->sclTrack);
        $this->assertArrayNotHasKey('sclTrack', $result->toArray());
    }

    // ---------------------------------------------------------------------------------------------
    // Kemantapan tingkat
    // ---------------------------------------------------------------------------------------------

    public function test_consolidated_at_exact_boundary_and_not_when_lowest_aspect_is_below_level_minus_half(): void
    {
        $rule = self::params()->consolidation;

        $this->assertTrue(ScoringEngine::consolidation(3, 2.5, 2.0, $rule));
        $this->assertFalse(ScoringEngine::consolidation(3, 2.49, 2.5, $rule));
    }

    public function test_not_consolidated_when_lowest_characteristic_is_below_level_minus_one(): void
    {
        $this->assertFalse(ScoringEngine::consolidation(3, 2.8, 1.99, self::params()->consolidation));
    }

    // ---------------------------------------------------------------------------------------------
    // Tingkat indikatif dan aspek prioritas
    // ---------------------------------------------------------------------------------------------

    public function test_indicative_level_is_an_integer_clamped_between_one_and_five(): void
    {
        $this->assertSame(1, ScoringEngine::indicativeLevel(0.4));
        $this->assertSame(1, ScoringEngine::indicativeLevel(1.999999));
        $this->assertSame(2, ScoringEngine::indicativeLevel(2.0));
        $this->assertSame(3, ScoringEngine::indicativeLevel(3.143463));
        $this->assertSame(4, ScoringEngine::indicativeLevel(4.999999));
        $this->assertSame(5, ScoringEngine::indicativeLevel(1e30));
        self::assertEngineInputError(static fn () => ScoringEngine::indicativeLevel(NAN));
    }

    public function test_priority_aspect_tie_goes_to_the_earliest_aspect_in_parameter_order(): void
    {
        // Nilai panel 3,0 pada semua karakteristik membuat semua I_a tepat 3,0 (tanpa galat floating point),
        // sehingga yang menentukan adalah urutan aspek pada parameter, bukan urutan masukan.
        $flat = array_map(
            static fn (CharacteristicInput $c): CharacteristicInput => self::with($c, ['panelAdjusted' => 3.0]),
            self::simulationCharacteristics(),
        );
        $params = self::params();

        $result = ScoringEngine::runEngine(new EngineInput($flat, 4), $params);
        $this->assertSame(3.0, $result->organization->minAspectIndex);
        $this->assertSame('A1', $result->organization->priorityAspect);
        $this->assertSame(['A1', 'A2', 'A3', 'A4', 'A5', 'A6'], array_keys($result->aspects));

        // Urutan masukan dibalik: tetap A1.
        $result = ScoringEngine::runEngine(new EngineInput(array_reverse($flat), 4), $params);
        $this->assertSame('A1', $result->organization->priorityAspect);

        // Urutan aspek pada parameter dibalik: A6 menjadi yang paling awal.
        $reversed = self::with($params, ['aspects' => array_reverse($params->aspects)]);
        $result = ScoringEngine::runEngine(new EngineInput($flat, 4), $reversed);
        $this->assertSame('A6', $result->organization->priorityAspect);
        $this->assertSame(['A6', 'A5', 'A4', 'A3', 'A2', 'A1'], array_keys($result->aspects));
    }

    // ---------------------------------------------------------------------------------------------
    // Agregasi menolak masukan tidak lengkap
    // ---------------------------------------------------------------------------------------------

    public function test_aggregate_rejects_characteristic_without_final_value(): void
    {
        $characteristics = array_map(
            static fn (CharacteristicInput $c): CharacteristicInput => $c->code === 'K2.1'
                ? self::with($c, ['perception' => null, 'evidence' => null, 'validation' => null])
                : $c,
            self::simulationCharacteristics(),
        );

        self::assertEngineInputError(
            static fn () => ScoringEngine::runEngine(new EngineInput($characteristics, 4), self::params()),
            '/K2\.1/',
        );
    }

    public function test_aggregate_rejects_aspect_without_characteristics(): void
    {
        $characteristics = array_values(array_filter(
            self::simulationCharacteristics(),
            static fn (CharacteristicInput $c): bool => $c->aspectCode !== 'A6',
        ));

        self::assertEngineInputError(
            static fn () => ScoringEngine::runEngine(new EngineInput($characteristics, 4), self::params()),
            '/A6/',
        );
    }

    public function test_aggregate_rejects_unknown_aspect(): void
    {
        $characteristics = [
            ...self::simulationCharacteristics(),
            new CharacteristicInput('K9.1', 'A9', false, 3, 3, 3),
        ];

        self::assertEngineInputError(
            static fn () => ScoringEngine::runEngine(new EngineInput($characteristics, 4), self::params()),
            '/A9/',
        );
    }

    public function test_aggregate_rejects_aspect_without_max_points(): void
    {
        $params = self::params();
        $broken = self::with($params, ['aspects' => array_map(
            static fn (AspectParameter $a): AspectParameter => $a->code === 'A2' ? self::with($a, ['maxPointsStep5' => null]) : $a,
            $params->aspects,
        )]);

        self::assertEngineInputError(static fn () => ScoringEngine::aggregate([], $broken, 4), '/A2/');
    }

    public function test_contextual_index_is_null_without_contextual_characteristics(): void
    {
        $characteristics = array_values(array_filter(
            self::simulationCharacteristics(),
            static fn (CharacteristicInput $c): bool => ! $c->isContextual,
        ));

        $result = ScoringEngine::runEngine(new EngineInput($characteristics, 4), self::params());

        $this->assertNull($result->organization->contextualIndex);
    }

    public function test_contextual_characteristics_do_not_change_organization_index_or_level(): void
    {
        // docs/03 bagian 1: aspek KT dihitung dan dilaporkan, tetapi tidak masuk indeks organisasi.
        $withContextual = ScoringEngine::runEngine(new EngineInput(self::simulationCharacteristics(), 4), self::params());
        $extreme = array_map(
            static fn (CharacteristicInput $c): CharacteristicInput => $c->isContextual
                ? self::with($c, ['perception' => 1.0, 'evidence' => 1.0, 'validation' => 1.0])
                : $c,
            self::simulationCharacteristics(),
        );
        $result = ScoringEngine::runEngine(new EngineInput($extreme, 4), self::params());

        $this->assertSame($withContextual->organization->index, $result->organization->index);
        $this->assertSame(3, $result->organization->indicativeLevel);
        $this->assertTrue($result->organization->consolidated);
        $this->assertSame(1.0, $result->organization->contextualIndex);
        $this->assertArrayNotHasKey('KT', $result->aspects);
    }

    // ---------------------------------------------------------------------------------------------
    // Jalur setara Safety Culture Ladder
    // ---------------------------------------------------------------------------------------------

    /** @return array<string, array<int, float>> */
    private static function full(float $value): array
    {
        return array_fill_keys(['A1', 'A2', 'A3', 'A4', 'A5', 'A6'], [2 => $value, 3 => $value, 4 => $value, 5 => $value]);
    }

    public function test_scl_all_aspects_fully_met_gives_level_five(): void
    {
        $this->assertSame(5, ScoringEngine::sclTrack(self::full(1), self::params())->indicativeLevel);
    }

    public function test_scl_failing_step_two_gives_level_one(): void
    {
        $this->assertSame(1, ScoringEngine::sclTrack(self::full(0.5), self::params())->indicativeLevel);
    }

    public function test_scl_steps_must_pass_in_sequence(): void
    {
        // Tingkat 3 gagal tetapi tingkat 4 lulus: tetap tingkat 2.
        $fulfillment = self::full(0.9);
        foreach (array_keys($fulfillment) as $aspect) {
            $fulfillment[$aspect][3] = 0.6;
        }

        $result = ScoringEngine::sclTrack($fulfillment, self::params());

        $this->assertFalse($result->steps[3]->passed);
        $this->assertTrue($result->steps[4]->passed);
        $this->assertSame(2, $result->indicativeLevel);
    }

    public function test_scl_exact_threshold_passes(): void
    {
        // Semua aspek 0,75 pada tingkat 2: rata-rata tertimbang 0,75 >= 0,75 dan minimum 0,75 >= 0,70
        $this->assertTrue(ScoringEngine::sclTrack(self::full(0.75), self::params())->steps[2]->passed);
    }

    public function test_scl_rejects_missing_or_out_of_range_fulfillment_and_missing_threshold(): void
    {
        $params = self::params();
        $missing = self::full(0.9);
        unset($missing['A3']);

        self::assertEngineInputError(static fn () => ScoringEngine::sclTrack($missing, $params), '/A3/');
        self::assertEngineInputError(static fn () => ScoringEngine::sclTrack(self::full(80), $params));
        self::assertEngineInputError(
            static fn () => ScoringEngine::sclTrack(
                self::full(0.9),
                self::with($params, ['sclThresholds' => array_slice($params->sclThresholds, 0, 2)]),
            ),
            '/tingkat 4/',
        );
    }

    public function test_scl_accepts_fulfillment_keyed_by_json_string_steps(): void
    {
        // Khusus PHP: kunci JSON "2" sampai "5" menjadi kunci int setelah dekode; keduanya harus terbaca.
        $decoded = json_decode('{"A1":{"2":1,"3":1,"4":1,"5":1},"A2":{"2":1,"3":1,"4":1,"5":1},"A3":{"2":1,"3":1,"4":1,"5":1},'
            .'"A4":{"2":1,"3":1,"4":1,"5":1},"A5":{"2":1,"3":1,"4":1,"5":1},"A6":{"2":1,"3":1,"4":1,"5":1}}', true);

        $result = ScoringEngine::sclTrack($decoded, self::params());

        $this->assertSame(5, $result->indicativeLevel);
        $this->assertSame([2, 3, 4, 5], array_keys($result->steps));
        $this->assertSame(1.0, $result->steps[5]->minimum);
    }

    // ---------------------------------------------------------------------------------------------
    // Kesenjangan persepsi manajemen dan pelaksana
    // ---------------------------------------------------------------------------------------------

    /** @return list<CharacteristicDefinition> */
    private static function gapCharacteristics(): array
    {
        return [
            new CharacteristicDefinition('K1.1', 'A1', false),
            new CharacteristicDefinition('K1.2', 'A1', false),
            new CharacteristicDefinition('KT.1', 'KT', true),
        ];
    }

    /** @return list<SurveyResponseInput> */
    private static function gapResponses(): array
    {
        $r = static fn (string $s, int $k11, int $k12): SurveyResponseInput => self::response($s, ['K1.1' => $k11, 'K1.2' => $k12, 'KT.1' => 1]);

        return [
            $r('S1', 4, 4),
            $r('S1', 5, 4),
            $r('S2', 4, 4),
            $r('S2', 4, 4),
            $r('S2', 3, 4),
            // Strata Supervisory tidak masuk kedua kelompok.
            $r('S3', 1, 1),
            $r('S4', 3, 3),
            $r('S4', 2, 3),
            $r('S4', 3, 3),
            $r('S5', 2, 3),
            $r('S5', 3, 3),
        ];
    }

    public function test_perception_gap_is_population_weighted_and_flagged_at_half_point_or_more(): void
    {
        // K1.1 manajemen: S1 rata-rata 4,5 (populasi 15), S2 rata-rata 11/3 (populasi 120)
        //   (15 x 4,5 + 120 x 11/3) / 135 = (67,5 + 440) / 135 = 3,759259
        // K1.1 pelaksana: S4 rata-rata 8/3 (1800), S5 rata-rata 2,5 (765)
        //   (1800 x 8/3 + 765 x 2,5) / 2565 = (4800 + 1912,5) / 2565 = 2,616959
        // K1.2: manajemen 4, pelaksana 3
        // A1 manajemen (3,759259 + 4) / 2 = 3,879630; pelaksana (2,616959 + 3) / 2 = 2,808480
        // Selisih 1,071150 >= 0,50, ditandai
        $gap = ScoringEngine::perceptionGap(self::gapCharacteristics(), self::strata(), self::gapResponses(), self::params());

        $this->assertFalse($gap['A1']->suppressed);
        self::assertCloseTo(3.8796296, $gap['A1']->management, 6);
        self::assertCloseTo(2.8084795, $gap['A1']->field, 6);
        self::assertCloseTo(1.0711501, $gap['A1']->gap, 6);
        $this->assertTrue($gap['A1']->attention);
        $this->assertSame(5, $gap['A1']->managementResponses);
        $this->assertSame(5, $gap['A1']->fieldResponses);
        $this->assertArrayNotHasKey('KT', $gap);
        $this->assertSame(['A1', 'A2', 'A3', 'A4', 'A5', 'A6'], array_keys($gap));
    }

    public function test_perception_gap_is_suppressed_when_a_group_has_fewer_than_five_responses(): void
    {
        $gap = ScoringEngine::perceptionGap(
            self::gapCharacteristics(),
            self::strata(),
            array_slice(self::gapResponses(), 0, -1),
            self::params(),
        );

        $this->assertSame([
            'management' => null,
            'field' => null,
            'gap' => null,
            'attention' => false,
            'suppressed' => true,
            'managementResponses' => 5,
            'fieldResponses' => 4,
        ], $gap['A1']->toArray());
        // Aspek tanpa karakteristik dalam data juga disembunyikan.
        $this->assertTrue($gap['A2']->suppressed);
        $this->assertSame(0, $gap['A2']->managementResponses);
    }

    public function test_perception_gap_is_not_flagged_below_half_point(): void
    {
        $flat = array_map(
            static fn (SurveyResponseInput $x): SurveyResponseInput => self::with($x, ['characteristicAnswers' => ['K1.1' => 3, 'K1.2' => 3]]),
            self::gapResponses(),
        );

        $gap = ScoringEngine::perceptionGap(self::gapCharacteristics(), self::strata(), $flat, self::params());

        self::assertCloseTo(0.0, $gap['A1']->gap, 12);
        $this->assertFalse($gap['A1']->attention);
        $this->assertFalse($gap['A1']->suppressed);
    }

    public function test_perception_gap_counts_dont_know_as_no_response_for_the_minimum_cell_rule(): void
    {
        // Lima responden pelaksana, tetapi satu menjawab "Tidak tahu" pada K1.2: jawaban sah paling sedikit 4,
        // di bawah batas 5, sehingga disembunyikan (CLAUDE.md aturan 3).
        $responses = self::gapResponses();
        $last = array_key_last($responses);
        $responses[$last] = self::with($responses[$last], ['characteristicAnswers' => ['K1.1' => 3, 'K1.2' => null]]);

        $gap = ScoringEngine::perceptionGap(self::gapCharacteristics(), self::strata(), $responses, self::params());

        $this->assertTrue($gap['A1']->suppressed);
        $this->assertNull($gap['A1']->gap);
        $this->assertSame(5, $gap['A1']->managementResponses);
        $this->assertSame(4, $gap['A1']->fieldResponses);
    }

    public function test_engine_input_error_is_an_invalid_argument_exception(): void
    {
        $this->assertInstanceOf(\InvalidArgumentException::class, new EngineInputError('x'));
    }
}
