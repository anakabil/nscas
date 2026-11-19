<?php

declare(strict_types=1);

namespace App\Domain\Results;

use App\Domain\Scoring\EngineInput;
use App\Domain\Scoring\EngineParameters;
use App\Domain\Scoring\LayerWeights;
use App\Domain\Scoring\ScoringEngine;

/**
 * Analisis kepekaan bobot lapisan (docs/12 bagian 6, rekomendasi 2): indeks organisasi dihitung ulang dengan bobot
 * satu lapisan dinaikkan 0,05 dan satu lapisan lain diturunkan 0,05, untuk keenam pasangan, lalu dilaporkan bila
 * tingkat berubah. Nilai panel tetap dipakai karena merupakan keputusan, bukan hasil pembobotan. Murni.
 */
final class Sensitivity
{
    public const STEP = 0.05;

    public const LAYERS = ['perception', 'evidence', 'validation'];

    /**
     * @return array{base: array{weights: array<string, float>, index: float, level: int}, scenarios: list<array{up: string, down: string, weights: array<string, float>, index: float, level: int, delta: float, levelChanged: bool}>, stable: bool}
     */
    public static function analyse(EngineInput $input, EngineParameters $params, float $step = self::STEP): array
    {
        $base = ScoringEngine::runEngine($input, $params)->organization;
        $weights = $params->layerWeights->toArray();
        $scenarios = [];
        foreach (self::LAYERS as $up) {
            foreach (self::LAYERS as $down) {
                if ($up === $down || $weights[$down] - $step < -1e-9) {
                    continue;
                }
                $shifted = $weights;
                $shifted[$up] += $step;
                $shifted[$down] -= $step;
                $variant = new EngineParameters(
                    layerWeights: new LayerWeights($shifted['perception'], $shifted['evidence'], $shifted['validation']),
                    selfAssessmentWeightInPerception: $params->selfAssessmentWeightInPerception,
                    divergenceThreshold: $params->divergenceThreshold,
                    consolidation: $params->consolidation,
                    perceptionGapAttention: $params->perceptionGapAttention,
                    assessorDisagreementFlag: $params->assessorDisagreementFlag,
                    aspects: $params->aspects,
                    sclThresholds: $params->sclThresholds,
                    minRespondentsPerReportCell: $params->minRespondentsPerReportCell,
                );
                $org = ScoringEngine::runEngine($input, $variant)->organization;
                $scenarios[] = [
                    'up' => $up,
                    'down' => $down,
                    'weights' => array_map(fn (float $w) => round($w, 10), $shifted),
                    'index' => $org->index,
                    'level' => $org->indicativeLevel,
                    'delta' => $org->index - $base->index,
                    'levelChanged' => $org->indicativeLevel !== $base->indicativeLevel,
                ];
            }
        }

        return [
            'base' => ['weights' => $weights, 'index' => $base->index, 'level' => $base->indicativeLevel],
            'scenarios' => $scenarios,
            'stable' => array_filter($scenarios, fn (array $s) => $s['levelChanged']) === [],
        ];
    }
}
