<?php

namespace App\Services;

use App\Domain\Access\Role;
use App\Domain\Setup\DpaStatus;
use App\Domain\Setup\Kickoff;
use App\Domain\Setup\SetupFacts;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Services\Respondents\ParticipationReport;
use Illuminate\Database\Eloquent\Collection;

/**
 * Mengumpulkan fakta perencanaan dari basis data untuk pemeriksa syarat dan dasbor progres. Untuk banyak asesmen
 * sekaligus (dasbor), hitungan dimuat dengan satu kueri per jenis, bukan per asesmen.
 */
final class SetupFactsCollector
{
    public static function for(Assessment $assessment): SetupFacts
    {
        return self::forMany(new Collection([$assessment]))[$assessment->id];
    }

    /**
     * @param  Collection<int, Assessment>  $assessments
     * @return array<string, SetupFacts>
     */
    public static function forMany(Collection $assessments): array
    {
        if ($assessments->isEmpty()) {
            return [];
        }
        $assessments->loadCount([
            'units',
            'strata',
            'strata as strata_without_population_count' => fn ($q) => $q->where('population', '<=', 0),
            'roster',
            // Hanya hitungan dari token, tidak pernah dari tabel jawaban (docs/02 bagian 4).
            'tokens as active_survey_tokens_count' => fn ($q) => $q->where('kind', 'SURVEY')->whereNull('revoked_at'),
            'tokens as completed_surveys_count' => fn ($q) => $q->where('kind', 'SURVEY')->whereNotNull('completed_at'),
        ]);
        $assessments->loadSum('strata as strata_population_sum', 'population');
        $assessments->loadMissing(['team', 'instrumentVersion', 'strata']);
        // Survei selesai per strata untuk semua asesmen sekaligus, dari token (bukan dari jawaban).
        $completedByStratum = AccessToken::whereIn('assessment_id', $assessments->modelKeys())
            ->where('kind', 'SURVEY')->whereNotNull('completed_at')->whereNotNull('stratum_id')
            ->selectRaw('stratum_id, count(*) as n')->groupBy('stratum_id')->pluck('n', 'stratum_id');

        $facts = [];
        foreach ($assessments as $assessment) {
            $team = $assessment->team;
            $draft = $assessment->parameter_draft ?? [];
            $facts[$assessment->id] = new SetupFacts(
                unitCount: (int) $assessment->units_count,
                strataCount: (int) $assessment->strata_count,
                strataWithoutPopulation: (int) $assessment->strata_without_population_count,
                instrumentPublished: (bool) $assessment->instrumentVersion?->isPublished(),
                leadAssessorCount: $team->where('role', Role::LeadAssessor)->count(),
                teamSize: $team->count(),
                consentFilled: trim((string) $assessment->consent_text_id) !== '',
                dpaSigned: $assessment->dpa_status === DpaStatus::Signed,
                samplePlanSaved: ! empty($draft['samplePlan']) || ! empty($assessment->parameter_snapshot['samplePlan'] ?? null),
                kickoffComplete: Kickoff::isComplete($assessment->kickoff),
                calibrationComplete: Kickoff::calibrationComplete(
                    $assessment->calibration,
                    $team->pluck('user_id')->map(fn ($id) => (int) $id)->values()->all(),
                ),
                workers: (int) $assessment->strata_population_sum,
                rosterCount: (int) $assessment->roster_count,
                activeSurveyTokens: (int) $assessment->active_survey_tokens_count,
                completedSurveys: (int) $assessment->completed_surveys_count,
                strataBelowMinimum: $assessment->strata->filter(fn ($s) => $s->population > 0
                    && ((int) ($completedByStratum[$s->id] ?? 0)) / $s->population < ParticipationReport::thresholds($assessment)[1])->count(),
            );
        }

        return $facts;
    }
}
