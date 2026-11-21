<?php

namespace App\Http\Presenters;

use App\Domain\Access\Role;
use App\Domain\Navigation\Module;
use App\Domain\Navigation\ModuleCatalog;
use App\Domain\Progress\ProgressCalculator;
use App\Domain\Respondents\Participation;
use App\Domain\Setup\ConditionEvaluator;
use App\Domain\Setup\ConditionResult;
use App\Domain\Setup\PlanningChecklist;
use App\Domain\Setup\SetupFacts;
use App\Domain\Workflow\Stage;
use App\Domain\Workflow\Workflow;
use App\Models\Assessment;
use App\Services\Respondents\ParticipationReport;
use DateTimeImmutable;

/**
 * Bentuk data progres pengukuran untuk pusat asesmen dan dasbor beranda. Hanya kunci dan angka; teks diterjemahkan di
 * peramban. Perhitungan ada di App\Domain\Progress dan App\Domain\Setup.
 */
final class ProgressPresenter
{
    /**
     * @param  list<Role>  $roles
     * @return array<string, mixed>
     */
    public static function for(Assessment $assessment, array $roles, SetupFacts $facts, DateTimeImmutable $today): array
    {
        $status = $assessment->status;
        $next = Workflow::next($status);
        $results = $next === null ? [] : ConditionEvaluator::evaluate($next, $facts);
        $readiness = ProgressCalculator::readiness($results);
        $schedule = ProgressCalculator::schedule(
            DateTimeImmutable::createFromInterface($assessment->period_start),
            DateTimeImmutable::createFromInterface($assessment->period_end),
            $today,
        );
        $planning = PlanningChecklist::items($facts, $status->parametersLocked());
        // Tautan hanya ke halaman yang boleh dibuka peran ini (sama dengan menu); syarat lain tampil tanpa tautan.
        $modules = [];
        foreach (ModuleCatalog::all($status) as $module) {
            if ($module->ready && $module->visibleTo($roles)) {
                $modules[$module->key] = $module;
            }
        }
        $moduleHref = static fn (?string $key): ?string => $key === null || ! isset($modules[$key]) ? null : self::moduleHref($assessment, $modules[$key]);
        $surveyTarget = $assessment->parameter_snapshot['samplePlan']['result']['surveyTargetTotal']
            ?? $assessment->parameter_draft['samplePlan']['result']['surveyTargetTotal']
            ?? null;
        // Jumlah selesai dari token, disembunyikan bila di bawah ambang sel (aturan 3).
        $minCell = ParticipationReport::thresholds($assessment)[0];
        $completed = Participation::maskCount($facts->completedSurveys, $minCell);

        return [
            'id' => $assessment->id,
            'stage' => Stage::of($status)?->number(),
            'status' => $status->value,
            'next' => $next === null ? null : [
                'to' => $next->to->value,
                'toStage' => Stage::of($next->to)?->number(),
                'actor' => $next->actor->value,
                'canTransition' => in_array($next->actor, $roles, true) && ConditionEvaluator::allowed($results),
                'conditions' => array_map(static fn (ConditionResult $r): array => [
                    'key' => $r->key,
                    'met' => $r->met,
                    'href' => $moduleHref($r->module),
                ], $results),
            ],
            'readiness' => $readiness,
            'planning' => [
                'items' => array_map(static fn (array $item): array => [...$item, 'href' => $moduleHref($item['key'])], $planning),
                'done' => PlanningChecklist::doneCount($planning),
                'total' => count($planning),
            ],
            'schedule' => [
                'phase' => $schedule->phase,
                'elapsed' => $schedule->elapsed,
                'daysRemaining' => $schedule->daysRemaining,
                'totalDays' => $schedule->totalDays,
            ],
            'attention' => ProgressCalculator::attention($status, $schedule, $readiness),
            'teamSize' => $facts->teamSize,
            'units' => $facts->unitCount,
            'workers' => $facts->workers,
            'surveyTarget' => $surveyTarget,
            'participation' => [
                'roster' => $facts->rosterCount,
                'tokens' => $facts->activeSurveyTokens,
                'completed' => $completed,
                'minCell' => $minCell,
                'strataBelowMinimum' => $facts->strataBelowMinimum,
                'minParticipation' => ParticipationReport::thresholds($assessment)[1],
                'selfAssessments' => ['issued' => $facts->selfAssessmentsIssued, 'submitted' => $facts->selfAssessmentsSubmitted],
                'evidence' => ['complete' => $facts->characteristicsWithEvidence, 'total' => $facts->characteristicCount],
                'observations' => ['observed' => $facts->projectsObserved, 'projects' => $facts->projectCount],
                'rateOfTarget' => $completed['suppressed'] || ! $surveyTarget ? null : $facts->completedSurveys / $surveyTarget,
            ],
        ];
    }

    /** Alamat halaman modul dari ModuleCatalog. */
    private static function moduleHref(Assessment $assessment, Module $module): string
    {
        return route('assessments.module', ['assessment' => $assessment, 'path' => $module->path]);
    }
}
