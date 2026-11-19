<?php

namespace App\Services;

use App\Domain\Access\Role;
use App\Domain\Setup\DpaStatus;
use App\Domain\Setup\Kickoff;
use App\Domain\Setup\SetupFacts;
use App\Models\Assessment;
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
        ]);
        $assessments->loadSum('strata as strata_population_sum', 'population');
        $assessments->loadMissing(['team', 'instrumentVersion']);

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
            );
        }

        return $facts;
    }
}
