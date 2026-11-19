<?php

namespace App\Services\Findings;

use App\Domain\Findings\PreliminaryFindings;
use App\Models\Assessment;
use App\Models\Characteristic;
use App\Models\Stratum;
use App\Services\Evidence\EvidenceService;
use Illuminate\Support\Facades\DB;

/**
 * Temuan awal untuk halaman tahap 3 dan usulan karakteristik fokus validasi (docs/12 temuan T1 dan T4). Menyajikan data
 * tanpa tingkat; tingkat baru muncul di tahap 4.
 */
class FindingsService
{
    public function __construct(private readonly EvidenceService $evidence) {}

    /** @return array<string, mixed> */
    public function build(Assessment $assessment): array
    {
        $thresholds = SurveyDataLoader::thresholds($assessment);
        $characteristics = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->orderBy('position')
            ->get(['id', 'code', 'name_id', 'aspect_code', 'is_contextual']);
        $strata = Stratum::where('assessment_id', $assessment->id)->get(['id', 'group', 'population']);
        $selfAssessment = [];
        foreach (DB::table('self_assessment_answers')
            ->join('self_assessments', 'self_assessments.id', '=', 'self_assessment_answers.self_assessment_id')
            ->where('self_assessments.assessment_id', $assessment->id)->where('self_assessments.status', 'SUBMITTED')
            ->whereNotNull('self_assessment_answers.level')
            ->get(['self_assessment_answers.characteristic_id', 'self_assessment_answers.level']) as $a) {
            $selfAssessment[$a->characteristic_id][] = (int) $a->level;
        }
        $evidence = [];
        foreach ($this->evidence->checklist($assessment, null)['rows'] as $row) {
            $evidence[$row['characteristicId']] = ['types' => $row['types'], 'belowMinimum' => $row['belowMinimum']];
        }
        $responses = SurveyDataLoader::responses($assessment);

        return [
            'responses' => count($responses),
            'minCell' => $thresholds['minCell'],
            'gapAttention' => $thresholds['gap'],
            ...PreliminaryFindings::build(
                $characteristics->map(fn (Characteristic $c) => [
                    'id' => $c->id, 'code' => $c->code, 'name' => $c->name_id, 'aspectCode' => $c->aspect_code, 'contextual' => $c->is_contextual,
                ])->all(),
                $strata->map(fn (Stratum $s) => ['id' => $s->id, 'group' => $s->group->value, 'population' => (int) $s->population])->all(),
                $responses,
                $selfAssessment,
                $evidence,
                SurveyDataLoader::dimensions($assessment),
                $thresholds['minCell'],
                $thresholds['gap'],
            ),
        ];
    }
}
