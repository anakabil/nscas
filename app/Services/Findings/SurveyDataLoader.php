<?php

namespace App\Services\Findings;

use App\Models\Assessment;
use Illuminate\Support\Facades\DB;

/**
 * Memuat jawaban survei yang tidak dikeluarkan dalam bentuk ringkas untuk analisis deskriptif dan mutu data (fase R6).
 * Hanya kolom unit, strata, dan jawaban; tidak ada yang merujuk token atau daftar responden (CLAUDE.md aturan 2).
 */
final class SurveyDataLoader
{
    /**
     * @return list<array{unitId: string, stratumId: string, levels: array<string, int|null>, climate: array<string, int>}>
     */
    public static function responses(Assessment $assessment): array
    {
        $rows = [];
        foreach (DB::table('survey_responses')->where('assessment_id', $assessment->id)->where('excluded', false)->get(['id', 'unit_id', 'stratum_id']) as $r) {
            $rows[$r->id] = ['unitId' => $r->unit_id, 'stratumId' => $r->stratum_id, 'levels' => [], 'climate' => []];
        }
        if ($rows === []) {
            return [];
        }
        DB::table('characteristic_answers')
            ->join('survey_responses', 'survey_responses.id', '=', 'characteristic_answers.survey_response_id')
            ->where('survey_responses.assessment_id', $assessment->id)->where('survey_responses.excluded', false)
            ->select('characteristic_answers.id', 'characteristic_answers.survey_response_id', 'characteristic_answers.characteristic_id', 'characteristic_answers.level')
            // Paging dengan kunci, bukan offset, agar tidak makin lambat pada ribuan responden.
            ->chunkById(5000, function ($chunk) use (&$rows) {
                foreach ($chunk as $a) {
                    $rows[$a->survey_response_id]['levels'][$a->characteristic_id] = $a->level === null ? null : (int) $a->level;
                }
            }, 'characteristic_answers.id', 'id');
        DB::table('climate_answers')
            ->join('survey_responses', 'survey_responses.id', '=', 'climate_answers.survey_response_id')
            ->where('survey_responses.assessment_id', $assessment->id)->where('survey_responses.excluded', false)
            ->select('climate_answers.id', 'climate_answers.survey_response_id', 'climate_answers.climate_item_id', 'climate_answers.value')
            ->chunkById(5000, function ($chunk) use (&$rows) {
                foreach ($chunk as $a) {
                    $rows[$a->survey_response_id]['climate'][$a->climate_item_id] = (int) $a->value;
                }
            }, 'climate_answers.id', 'id');

        return array_values($rows);
    }

    /**
     * Dimensi iklim versi instrumen asesmen beserta butirnya.
     *
     * @return list<array{code: string, name: string, items: list<array{id: string, reverse: bool}>}>
     */
    public static function dimensions(Assessment $assessment): array
    {
        $items = DB::table('climate_items')
            ->join('climate_dimensions', 'climate_dimensions.id', '=', 'climate_items.climate_dimension_id')
            ->where('climate_dimensions.instrument_version_id', $assessment->instrument_version_id)
            ->orderBy('climate_dimensions.position')->orderBy('climate_items.position')
            ->get(['climate_dimensions.code as dim', 'climate_dimensions.name_id as name', 'climate_items.id', 'climate_items.reverse_coded']);
        $out = [];
        foreach ($items as $i) {
            $out[$i->dim] ??= ['code' => $i->dim, 'name' => $i->name, 'items' => []];
            $out[$i->dim]['items'][] = ['id' => $i->id, 'reverse' => (bool) $i->reverse_coded];
        }

        return array_values($out);
    }

    /** Ambang sel laporan, ambang selisih persepsi, alfa, dan rwg dari parameter terkunci. @return array{minCell: int, gap: float, alpha: float, rwg: float} */
    public static function thresholds(Assessment $assessment): array
    {
        $p = $assessment->parameter_snapshot['parameters'] ?? $assessment->parameter_draft ?? [];
        $q = $p['quality'] ?? [];

        return [
            'minCell' => (int) ($q['minRespondentsPerReportCell'] ?? 5),
            'gap' => (float) ($p['perceptionGapAttention'] ?? 0.5),
            'alpha' => (float) ($q['cronbachAlphaMin'] ?? 0.7),
            'rwg' => (float) ($q['rwgMin'] ?? 0.7),
        ];
    }
}
