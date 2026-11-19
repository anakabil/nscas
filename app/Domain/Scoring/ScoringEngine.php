<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/**
 * Mesin penilaian NSCAS sesuai docs/03 bagian 2 sampai 6.
 * Implementasi rujukan: seed/fixtures/referensi_skoring.py. Kelas ini murni: tanpa kerangka kerja,
 * basis data, maupun I/O, dan tanpa pembulatan (pembulatan hanya saat ditampilkan).
 * Semua parameter berasal dari EngineParameters, yaitu snapshot parameter asesmen yang terkunci.
 */
final class ScoringEngine
{
    public const string ENGINE_VERSION = '1.0.0';

    /** @var list<int> */
    private const array SCL_STEPS = [2, 3, 4, 5];

    // ---------------------------------------------------------------------------------------------
    // 2.1 Persepsi
    // ---------------------------------------------------------------------------------------------

    /**
     * Skor survei berbobot populasi strata: jumlah(w_s x m_s) / jumlah(w_s), hanya untuk strata
     * yang memiliki minimal satu jawaban selain "Tidak tahu" (null). Null bila tidak ada jawaban.
     *
     * @param  array<string, array<array-key, int|float|null>>  $answersByStratum  Kode strata ke daftar jawaban.
     * @param  array<string, int|float>  $populationByStratum  Kode strata ke populasi.
     */
    public static function surveyScore(array $answersByStratum, array $populationByStratum): ?float
    {
        $num = 0.0;
        $den = 0.0;
        foreach ($answersByStratum as $code => $answers) {
            $valid = [];
            foreach ($answers as $answer) {
                if ($answer !== null) {
                    $valid[] = $answer;
                }
            }
            if ($valid === []) {
                continue;
            }
            $w = $populationByStratum[$code] ?? null;
            if (! Numeric::isFiniteNumber($w) || $w <= 0) {
                throw new EngineInputError("Populasi strata {$code} tidak tersedia atau tidak valid");
            }
            $num += $w * Numeric::mean($valid);
            $den += $w;
        }

        return $den > 0 ? $num / $den : null;
    }

    /**
     * P_c = (1 - alfa) x S_c + alfa x A_c; bila tidak ada penilaian mandiri, P_c = S_c.
     * Bila skor survei kosong, P_c kosong walaupun ada penilaian mandiri (sama dengan rujukan).
     *
     * @param  array<string, array<array-key, int|float|null>>  $answersByStratum
     * @param  array<string, int|float>  $populationByStratum
     * @param  array<array-key, int|float|null>  $selfAssessmentLevels  Tingkat dari penilaian mandiri berstatus Submitted.
     */
    public static function perception(
        array $answersByStratum,
        array $populationByStratum,
        array $selfAssessmentLevels,
        float $alpha,
    ): PerceptionResult {
        $survey = self::surveyScore($answersByStratum, $populationByStratum);
        $levels = [];
        foreach ($selfAssessmentLevels as $level) {
            if ($level !== null) {
                $levels[] = $level;
            }
        }
        $selfAssessment = $levels === [] ? null : Numeric::mean($levels);

        if ($survey === null) {
            return new PerceptionResult(null, $selfAssessment, null);
        }
        if ($selfAssessment === null) {
            return new PerceptionResult($survey, null, $survey);
        }

        return new PerceptionResult($survey, $selfAssessment, (1 - $alpha) * $survey + $alpha * $selfAssessment);
    }

    // ---------------------------------------------------------------------------------------------
    // 2.2 Bukti objektif dan 2.3 Validasi
    // ---------------------------------------------------------------------------------------------

    /**
     * E_c = rata-rata nilai asesor. PenilaiTunggal bila hanya satu asesor;
     * PerluRekonsiliasi bila selisih nilai terbesar dan terkecil lebih dari ambang.
     *
     * @param  list<EvidenceRatingInput>  $ratings  Nilai untuk satu karakteristik.
     */
    public static function evidenceLayer(array $ratings, float $disagreementThreshold): EvidenceLayerResult
    {
        if ($ratings === []) {
            return new EvidenceLayerResult(null, []);
        }
        $levels = [];
        $assessors = [];
        foreach ($ratings as $rating) {
            $levels[] = $rating->level;
            $assessors[(string) $rating->assessorId] = true;
        }
        $flags = [];
        if (count($assessors) === 1) {
            $flags[] = Flag::PenilaiTunggal;
        }
        if (max($levels) - min($levels) > $disagreementThreshold + Numeric::EPS) {
            $flags[] = Flag::PerluRekonsiliasi;
        }

        return new EvidenceLayerResult(Numeric::mean($levels), $flags);
    }

    /**
     * V_c = rata-rata antarsesi dari rata-rata nilai asesor per sesi; null bila tidak ada sesi.
     *
     * @param  list<ValidationRatingInput>  $ratings  Nilai untuk satu karakteristik.
     */
    public static function validationLayer(array $ratings): ?float
    {
        $bySession = [];
        foreach ($ratings as $rating) {
            $bySession[$rating->sessionId][] = $rating->level;
        }
        if ($bySession === []) {
            return null;
        }
        $sessionMeans = [];
        foreach ($bySession as $levels) {
            $sessionMeans[] = Numeric::mean($levels);
        }

        return Numeric::mean($sessionMeans);
    }

    // ---------------------------------------------------------------------------------------------
    // 3. Indeks karakteristik
    // ---------------------------------------------------------------------------------------------

    /** G_c dengan lapisan kosong dikeluarkan dan bobot sisanya dinormalisasi. */
    public static function combineLayers(?float $p, ?float $e, ?float $v, LayerWeights $weights): LayerCombination
    {
        $num = 0.0;
        $den = 0.0;
        $available = 0;
        foreach ([[$p, $weights->perception], [$e, $weights->evidence], [$v, $weights->validation]] as [$value, $w]) {
            if ($value === null) {
                continue;
            }
            $num += $value * $w;
            $den += $w;
            $available++;
        }
        if ($available === 0) {
            return new LayerCombination(null, [Flag::SemuaLapisanKosong]);
        }
        if (! ($den > 0)) {
            throw new EngineInputError('Jumlah bobot lapisan yang tersedia harus lebih dari nol');
        }

        return new LayerCombination($num / $den, $available === 3 ? [] : [Flag::LapisanTidakLengkap]);
    }

    /**
     * Aturan selisih persepsi dan bukti: bila |P_c - E_c| >= ambang, F_c = min(G_c, E_c) dan diberi
     * tanda. Bila bukti lebih tinggi daripada persepsi, tanda tetap muncul tetapi nilai tidak berubah.
     */
    public static function scoreCharacteristic(
        ?float $p,
        ?float $e,
        ?float $v,
        LayerWeights $weights,
        float $divergenceThreshold,
    ): CharacteristicScore {
        $combination = self::combineLayers($p, $e, $v, $weights);
        $combined = $combination->combined;
        $flags = $combination->flags;
        $divergence = ($p !== null && $e !== null) ? abs($p - $e) : null;
        $final = $combined;
        // $combined tidak mungkin null di dalam cabang ini karena p dan e tersedia.
        if ($divergence !== null && $e !== null && $combined !== null && $divergence >= $divergenceThreshold - Numeric::EPS) {
            $final = min($combined, $e);
            $flags[] = Flag::SelisihPersepsiBukti;
        }

        return new CharacteristicScore($combined, $divergence, $final, $flags);
    }

    // ---------------------------------------------------------------------------------------------
    // 4. Agregasi
    // ---------------------------------------------------------------------------------------------

    /** L = min(5, max(1, floor(O + EPS))). Hasil bertipe int. */
    public static function indicativeLevel(float $orgIndex): int
    {
        if (! is_finite($orgIndex)) {
            throw new EngineInputError('Indeks organisasi harus bilangan terhingga');
        }

        // Dijepit selagi masih float agar konversi ke int selalu berada dalam rentang.
        return (int) max(1.0, min(5.0, floor($orgIndex + Numeric::EPS)));
    }

    /** Tingkat L mantap bila min(I_a) >= L - 0,50 dan min(F_c non-kontekstual) >= L - 1,00. */
    public static function consolidation(
        float $level,
        float $minAspectIndex,
        float $minCharacteristicIndex,
        ConsolidationRule $rule,
    ): bool {
        return $minAspectIndex >= $level - $rule->maxAspectBelowLevel - Numeric::EPS
            && $minCharacteristicIndex >= $level - $rule->maxCharacteristicBelowLevel - Numeric::EPS;
    }

    /**
     * Bobot aspek W_a = maxPointsStep5_a / jumlah poin aspek non-kontekstual (18.000).
     *
     * @return array<string, float> Kode aspek ke bobot, dalam urutan parameter.
     */
    public static function aspectWeights(EngineParameters $params): array
    {
        $points = [];
        $total = 0.0;
        foreach ($params->aspects as $aspect) {
            if ($aspect->excludedFromLevel) {
                continue;
            }
            if ($aspect->maxPointsStep5 === null || ! ($aspect->maxPointsStep5 > 0)) {
                throw new EngineInputError("Aspek {$aspect->code} tidak memiliki poin maksimum tingkat 5");
            }
            $points[$aspect->code] = $aspect->maxPointsStep5;
            $total += $aspect->maxPointsStep5;
        }
        if ($points === []) {
            throw new EngineInputError('Parameter tidak memuat aspek yang masuk indeks organisasi');
        }
        $weights = [];
        foreach ($points as $code => $value) {
            $weights[$code] = $value / $total;
        }

        return $weights;
    }

    /** Nilai yang dipakai agregasi: penyesuaian panel bila ada, selain itu F_c. */
    public static function effectiveValue(CharacteristicResult $characteristic): ?float
    {
        return $characteristic->panelAdjusted ?? $characteristic->final;
    }

    /**
     * I_a, O, L, kemantapan, aspek prioritas, dan indeks kontekstual.
     *
     * @param  list<CharacteristicResult>  $characteristics
     */
    public static function aggregate(array $characteristics, EngineParameters $params, float $targetLevel): AggregateResult
    {
        $weights = self::aspectWeights($params);

        $valuesByAspect = array_fill_keys(array_keys($weights), []);
        $contextual = [];
        $missing = [];

        foreach ($characteristics as $c) {
            $value = self::effectiveValue($c);
            if ($c->isContextual) {
                if ($value !== null) {
                    $contextual[] = $value;
                }

                continue;
            }
            if (! array_key_exists($c->aspectCode, $valuesByAspect)) {
                throw new EngineInputError("Karakteristik {$c->code} merujuk aspek {$c->aspectCode} yang tidak dikenal");
            }
            if ($value === null) {
                $missing[] = $c->code;
            } else {
                $valuesByAspect[$c->aspectCode][] = $value;
            }
        }
        if ($missing !== []) {
            throw new EngineInputError('Karakteristik tanpa nilai akhir: '.implode(', ', $missing));
        }

        $aspects = [];
        $orgIndex = 0.0;
        foreach ($weights as $code => $weight) {
            $values = $valuesByAspect[$code];
            if ($values === []) {
                throw new EngineInputError("Aspek {$code} tidak memiliki karakteristik untuk dinilai");
            }
            $index = Numeric::mean($values);
            $aspects[$code] = new AspectResult($index, min($values), $weight, $targetLevel - $index);
            $orgIndex += $weight * $index;
        }

        $level = self::indicativeLevel($orgIndex);
        $minAspectIndex = INF;
        $minCharacteristicIndex = INF;
        $priorityAspect = null;
        foreach ($aspects as $code => $aspect) {
            // Pembanding ketat: bila ada nilai sama, aspek yang lebih awal dalam urutan parameter dipilih.
            if ($priorityAspect === null || $aspect->index < $minAspectIndex) {
                $priorityAspect = (string) $code;
                $minAspectIndex = $aspect->index;
            }
            $minCharacteristicIndex = min($minCharacteristicIndex, $aspect->min);
        }

        return new AggregateResult(
            $aspects,
            new OrganizationResult(
                index: $orgIndex,
                indicativeLevel: $level,
                consolidated: self::consolidation($level, $minAspectIndex, $minCharacteristicIndex, $params->consolidation),
                minAspectIndex: $minAspectIndex,
                minCharacteristicIndex: $minCharacteristicIndex,
                gapToTarget: $targetLevel - $orgIndex,
                priorityAspect: (string) $priorityAspect,
                contextualIndex: $contextual === [] ? null : Numeric::mean($contextual),
            ),
        );
    }

    // ---------------------------------------------------------------------------------------------
    // 5. Jalur setara Safety Culture Ladder (diagnosis internal, bukan sertifikasi)
    // ---------------------------------------------------------------------------------------------

    /**
     * @param  array<string, array<int, int|float>>  $fulfillment  Kode aspek ke [tingkat 2..5 => pemenuhan 0 sampai 1].
     */
    public static function sclTrack(array $fulfillment, EngineParameters $params): SclTrackResult
    {
        $weights = self::aspectWeights($params);
        $thresholds = [];
        foreach ($params->sclThresholds as $threshold) {
            $thresholds[$threshold->step] = $threshold;
        }

        $steps = [];
        $level = 1;
        $chainOk = true;
        foreach (self::SCL_STEPS as $step) {
            $threshold = $thresholds[$step] ?? null;
            if ($threshold === null) {
                throw new EngineInputError("Ambang jalur setara tingkat {$step} tidak tersedia");
            }

            $weightedAverage = 0.0;
            $minimum = INF;
            foreach ($weights as $code => $w) {
                $f = $fulfillment[$code][$step] ?? null;
                if (! Numeric::isFiniteNumber($f) || $f < 0 || $f > 1) {
                    throw new EngineInputError("Pemenuhan aspek {$code} tingkat {$step} harus bernilai 0 sampai 1");
                }
                $weightedAverage += $w * $f;
                $minimum = min($minimum, (float) $f);
            }

            $passed = $weightedAverage >= $threshold->minWeightedAverage - Numeric::EPS
                && $minimum >= $threshold->minPerAspect - Numeric::EPS;
            $steps[$step] = new SclStepResult(
                weightedAverage: $weightedAverage,
                minimum: $minimum,
                thresholdAverage: $threshold->minWeightedAverage,
                thresholdMinimum: $threshold->minPerAspect,
                passed: $passed,
            );
            // Harus lulus berurutan sejak tingkat 2.
            if ($chainOk && $passed) {
                $level = $step;
            } else {
                $chainOk = false;
            }
        }

        return new SclTrackResult($steps, $level);
    }

    // ---------------------------------------------------------------------------------------------
    // Penyusunan lapisan dari data mentah
    // ---------------------------------------------------------------------------------------------

    /**
     * Menghitung P_c, E_c, V_c, dan penyesuaian panel per karakteristik dari data mentah.
     *
     * @return list<CharacteristicInput>
     */
    public static function buildCharacteristicInputs(RawAssessmentInput $raw, EngineParameters $params): array
    {
        $population = self::populationMap($raw->strata);
        $submitted = [];
        foreach ($raw->selfAssessments as $selfAssessment) {
            if ($selfAssessment->status === SelfAssessmentStatus::Submitted) {
                $submitted[] = $selfAssessment;
            }
        }

        $inputs = [];
        foreach ($raw->characteristics as $def) {
            $code = $def->code;

            $selfAssessmentLevels = [];
            foreach ($submitted as $selfAssessment) {
                $level = $selfAssessment->answers[$code] ?? null;
                if ($level !== null) {
                    self::assertLevel($level, "Penilaian mandiri {$code}");
                }
                $selfAssessmentLevels[] = $level;
            }

            $perception = self::perception(
                self::answersByStratumFor($raw->surveyResponses, $code),
                $population,
                $selfAssessmentLevels,
                $params->selfAssessmentWeightInPerception,
            );

            $evidenceRatings = [];
            foreach ($raw->evidenceRatings as $rating) {
                if ($rating->characteristicCode === $code) {
                    self::assertLevel($rating->level, "Nilai bukti {$code}");
                    $evidenceRatings[] = $rating;
                }
            }
            $evidence = self::evidenceLayer($evidenceRatings, $params->assessorDisagreementFlag);

            $validationRatings = [];
            foreach ($raw->validationRatings as $rating) {
                if ($rating->characteristicCode === $code) {
                    self::assertLevel($rating->level, "Nilai validasi {$code}");
                    $validationRatings[] = $rating;
                }
            }

            $panelAdjusted = $raw->panelAdjustments[$code] ?? null;
            if ($panelAdjusted !== null) {
                self::assertLevel($panelAdjusted, "Penyesuaian panel {$code}");
            }

            $inputs[] = new CharacteristicInput(
                code: $code,
                aspectCode: $def->aspectCode,
                isContextual: $def->isContextual,
                perception: $perception->perception,
                evidence: $evidence->value,
                validation: self::validationLayer($validationRatings),
                panelAdjusted: $panelAdjusted === null ? null : (float) $panelAdjusted,
                flags: $evidence->flags,
            );
        }

        return $inputs;
    }

    // ---------------------------------------------------------------------------------------------
    // Pintu masuk
    // ---------------------------------------------------------------------------------------------

    /** Menghitung hasil dari nilai lapisan yang sudah jadi. */
    public static function runEngine(EngineInput $input, EngineParameters $params): EngineResult
    {
        $characteristics = [];
        foreach ($input->characteristics as $c) {
            $score = self::scoreCharacteristic(
                $c->perception,
                $c->evidence,
                $c->validation,
                $params->layerWeights,
                $params->divergenceThreshold,
            );
            $characteristics[] = new CharacteristicResult(
                code: $c->code,
                aspectCode: $c->aspectCode,
                isContextual: $c->isContextual,
                perception: $c->perception,
                evidence: $c->evidence,
                validation: $c->validation,
                combined: $score->combined,
                divergence: $score->divergence,
                final: $score->final,
                panelAdjusted: $c->panelAdjusted,
                flags: [...$score->flags, ...array_values($c->flags)],
            );
        }

        $aggregate = self::aggregate($characteristics, $params, $input->targetLevel);

        return new EngineResult(
            engineVersion: self::ENGINE_VERSION,
            characteristics: $characteristics,
            aspects: $aggregate->aspects,
            organization: $aggregate->organization,
            sclTrack: $input->sclFulfillment === null ? null : self::sclTrack($input->sclFulfillment, $params),
        );
    }

    /** Menghitung hasil langsung dari data mentah satu asesmen. */
    public static function scoreAssessment(RawAssessmentInput $raw, EngineParameters $params): EngineResult
    {
        return self::runEngine(
            new EngineInput(
                characteristics: self::buildCharacteristicInputs($raw, $params),
                targetLevel: $raw->targetLevel,
                sclFulfillment: $raw->sclFulfillment,
            ),
            $params,
        );
    }

    // ---------------------------------------------------------------------------------------------
    // 6. Kesenjangan persepsi antarlapisan
    // ---------------------------------------------------------------------------------------------

    /**
     * Per aspek: rata-rata skor survei kelompok Management dikurangi kelompok Field, dengan pembobotan
     * populasi dalam kelompok. Skor aspek suatu kelompok adalah rata-rata skor karakteristik
     * non-kontekstualnya, sejalan dengan I_a. Jumlah respons kelompok dihitung sebagai jumlah jawaban
     * selain "Tidak tahu" yang paling sedikit di antara karakteristik aspek itu; hasil disembunyikan
     * bila salah satu kelompok di bawah batas minimum (bawaan 5, CLAUDE.md aturan 3).
     *
     * @param  list<CharacteristicDefinition>  $characteristics
     * @param  list<StratumInput>  $strata
     * @param  list<SurveyResponseInput>  $surveyResponses
     * @return array<string, PerceptionGapResult> Berkunci kode aspek non-kontekstual, dalam urutan parameter.
     */
    public static function perceptionGap(
        array $characteristics,
        array $strata,
        array $surveyResponses,
        EngineParameters $params,
    ): array {
        $population = self::populationMap($strata);
        $managementStrata = self::strataCodesOf($strata, StratumGroup::Management);
        $fieldStrata = self::strataCodesOf($strata, StratumGroup::Field);

        $out = [];
        foreach ($params->aspects as $aspect) {
            if ($aspect->excludedFromLevel) {
                continue;
            }
            $codes = [];
            foreach ($characteristics as $c) {
                if ($c->aspectCode === $aspect->code && ! $c->isContextual) {
                    $codes[] = $c->code;
                }
            }
            $m = self::groupScore($surveyResponses, $codes, $managementStrata, $population);
            $f = self::groupScore($surveyResponses, $codes, $fieldStrata, $population);
            $suppressed = $m['responses'] < $params->minRespondentsPerReportCell
                || $f['responses'] < $params->minRespondentsPerReportCell;

            if ($suppressed || $m['value'] === null || $f['value'] === null) {
                $out[$aspect->code] = new PerceptionGapResult(
                    management: null,
                    field: null,
                    gap: null,
                    attention: false,
                    suppressed: true,
                    managementResponses: $m['responses'],
                    fieldResponses: $f['responses'],
                );

                continue;
            }
            $gap = $m['value'] - $f['value'];
            $out[$aspect->code] = new PerceptionGapResult(
                management: $m['value'],
                field: $f['value'],
                gap: $gap,
                attention: $gap >= $params->perceptionGapAttention - Numeric::EPS,
                suppressed: false,
                managementResponses: $m['responses'],
                fieldResponses: $f['responses'],
            );
        }

        return $out;
    }

    // ---------------------------------------------------------------------------------------------
    // Pembantu
    // ---------------------------------------------------------------------------------------------

    /**
     * Skor satu kelompok strata untuk sekumpulan karakteristik dalam satu aspek.
     *
     * @param  list<SurveyResponseInput>  $responses
     * @param  list<string>  $characteristicCodes
     * @param  array<string, true>  $strataCodes
     * @param  array<string, int>  $population
     * @return array{responses: int, value: float|null}
     */
    private static function groupScore(array $responses, array $characteristicCodes, array $strataCodes, array $population): array
    {
        $minResponses = null;
        $scores = [];
        foreach ($characteristicCodes as $code) {
            $answers = self::answersByStratumFor($responses, $code, $strataCodes);
            $valid = 0;
            foreach ($answers as $list) {
                foreach ($list as $answer) {
                    if ($answer !== null) {
                        $valid++;
                    }
                }
            }
            $minResponses = $minResponses === null ? $valid : min($minResponses, $valid);
            $score = self::surveyScore($answers, $population);
            if ($score !== null) {
                $scores[] = $score;
            }
        }
        $complete = $scores !== [] && count($scores) === count($characteristicCodes);

        return ['responses' => $minResponses ?? 0, 'value' => $complete ? Numeric::mean($scores) : null];
    }

    /**
     * Jawaban satu karakteristik dikelompokkan per strata. Respons yang dikeluarkan dilewati. Jawaban null
     * ("Tidak tahu") tetap dicatat, sedangkan karakteristik yang kuncinya tidak ada pada respons dilewati.
     *
     * @param  list<SurveyResponseInput>  $responses
     * @param  array<string, true>|null  $stratumFilter
     * @return array<string, list<int|float|null>>
     */
    private static function answersByStratumFor(array $responses, string $characteristicCode, ?array $stratumFilter = null): array
    {
        $out = [];
        foreach ($responses as $response) {
            if ($response->excluded) {
                continue;
            }
            if ($stratumFilter !== null && ! isset($stratumFilter[$response->stratumCode])) {
                continue;
            }
            // array_key_exists, bukan isset: nilai null adalah jawaban "Tidak tahu", bukan kunci yang hilang.
            if (! array_key_exists($characteristicCode, $response->characteristicAnswers)) {
                continue;
            }
            $answer = $response->characteristicAnswers[$characteristicCode];
            if ($answer !== null) {
                self::assertLevel($answer, "Jawaban survei {$characteristicCode}");
            }
            $out[$response->stratumCode][] = $answer;
        }

        return $out;
    }

    /**
     * @param  list<StratumInput>  $strata
     * @return array<string, int>
     */
    private static function populationMap(array $strata): array
    {
        $map = [];
        foreach ($strata as $stratum) {
            $map[$stratum->code] = $stratum->population;
        }

        return $map;
    }

    /**
     * @param  list<StratumInput>  $strata
     * @return array<string, true>
     */
    private static function strataCodesOf(array $strata, StratumGroup $group): array
    {
        $codes = [];
        foreach ($strata as $stratum) {
            if ($stratum->group === $group) {
                $codes[$stratum->code] = true;
            }
        }

        return $codes;
    }

    private static function assertLevel(mixed $value, string $context): void
    {
        if (! Numeric::isFiniteNumber($value) || $value < 1 - Numeric::EPS || $value > 5 + Numeric::EPS) {
            $shown = is_int($value) || is_float($value) ? (string) $value : get_debug_type($value);
            throw new EngineInputError("{$context}: nilai {$shown} di luar rentang 1 sampai 5");
        }
    }
}
