<?php

namespace App\Services\Quality;

use App\Domain\Access\Role;
use App\Domain\Quality\QualityReport;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\AssessmentReview;
use App\Models\StratumJustification;
use App\Models\SurveyResponse;
use App\Models\Unit;
use App\Models\User;
use App\Services\Findings\SurveyDataLoader;
use App\Services\Respondents\ParticipationReport;
use App\Support\Audit;
use App\Support\RuleViolation;
use Illuminate\Support\Facades\DB;

/**
 * Tinjauan mutu data sebelum validasi (docs/12 temuan T3, docs/03 bagian 8): partisipasi per strata dengan alasan
 * tertulis bila di bawah batas, alfa Cronbach per dimensi, rwg(J) per unit, dan jawaban bertanda yang dapat dikeluarkan
 * dari analisis dengan alasan (dibawa dari v1 src/lib/dashboard/service.ts setResponseExclusion).
 */
class DataQualityService
{
    public const REVIEW_KINDS = ['PARTICIPATION', 'DATA_QUALITY'];

    public const FLAGGED_LIMIT = 200;

    /** Tinjauan dan alasan dicatat selama pengumpulan data dan validasi. */
    public static function reviewOpen(AssessmentStatus $status): bool
    {
        return $status === AssessmentStatus::DataCollection || $status === AssessmentStatus::Validation;
    }

    /** Jawaban dapat dikeluarkan atau dipulihkan sampai penilaian; terkunci sejak rapat panel. */
    public static function exclusionOpen(AssessmentStatus $status): bool
    {
        return in_array($status, [AssessmentStatus::DataCollection, AssessmentStatus::Validation, AssessmentStatus::Scoring], true);
    }

    /** @return array<string, mixed> */
    public function report(Assessment $assessment, bool $includeResponses): array
    {
        $t = SurveyDataLoader::thresholds($assessment);
        $responses = SurveyDataLoader::responses($assessment);
        $dimensions = SurveyDataLoader::dimensions($assessment);
        $units = Unit::where('assessment_id', $assessment->id)->orderBy('name')->get(['id', 'name'])
            ->map(fn (Unit $u) => ['id' => $u->id, 'name' => $u->name])->all();
        $participation = ParticipationReport::for($assessment, null);
        $justifications = StratumJustification::where('assessment_id', $assessment->id)->pluck('justification', 'stratum_id');
        $reviews = AssessmentReview::where('assessment_id', $assessment->id)->with('reviewer:id,name')->get()->keyBy('kind');

        return [
            'minCell' => $t['minCell'],
            'alphaMin' => $t['alpha'],
            'rwgMin' => $t['rwg'],
            'minParticipation' => $participation['minParticipation'],
            'strata' => array_map(fn (array $s) => [...$s, 'justification' => $justifications[$s['stratumId']] ?? null], $participation['summary']['strata']),
            'alpha' => QualityReport::alphaByDimension($dimensions, $responses, $t['minCell'], $t['alpha']),
            'rwg' => QualityReport::rwgByUnit($units, $dimensions, $responses, $t['minCell'], $t['rwg']),
            'counts' => [
                'analysed' => count($responses),
                'excluded' => SurveyResponse::where('assessment_id', $assessment->id)->where('excluded', true)->count(),
                'flagged' => SurveyResponse::where('assessment_id', $assessment->id)->whereRaw("quality_flags <> '[]'::jsonb")->count(),
            ],
            'flagged' => $includeResponses ? $this->flagged($assessment) : [],
            'reviews' => collect(self::REVIEW_KINDS)->mapWithKeys(fn (string $k) => [$k => $reviews->has($k) ? [
                'note' => $reviews[$k]->note,
                'by' => $reviews[$k]->reviewer?->name,
                'at' => $reviews[$k]->reviewed_at->toIso8601String(),
            ] : null])->all(),
        ];
    }

    /**
     * Jawaban bertanda atau yang sudah dikeluarkan, tanpa unit dan strata agar tidak dapat ditelusuri ke orang.
     *
     * @return list<array<string, mixed>>
     */
    private function flagged(Assessment $assessment): array
    {
        return SurveyResponse::where('assessment_id', $assessment->id)
            ->where(fn ($q) => $q->whereRaw("quality_flags <> '[]'::jsonb")->orWhere('excluded', true))
            ->orderByDesc('submitted_on')->orderBy('id')->limit(self::FLAGGED_LIMIT)
            ->get(['id', 'quality_flags', 'submitted_on', 'duration_bucket', 'excluded', 'excluded_reason'])
            ->map(fn (SurveyResponse $r) => [
                'id' => $r->id,
                'flags' => $r->quality_flags,
                'submittedOn' => $r->submitted_on->toDateString(),
                'durationBucket' => $r->duration_bucket,
                'excluded' => (bool) $r->excluded,
                'reason' => $r->excluded_reason,
            ])->all();
    }

    public function setExclusion(Assessment $assessment, User $user, Role $actorRole, string $responseId, bool $excluded, string $reason): void
    {
        DB::transaction(function () use ($assessment, $user, $actorRole, $responseId, $excluded, $reason) {
            $locked = Assessment::whereKey($assessment->id)->lockForUpdate()->firstOrFail();
            if (! self::exclusionOpen($locked->status)) {
                throw RuleViolation::locked('EXCLUSION_CLOSED');
            }
            $response = SurveyResponse::where('assessment_id', $locked->id)->lockForUpdate()->find($responseId);
            if ($response === null) {
                throw new RuleViolation(404, 'NOT_FOUND');
            }
            if ((bool) $response->excluded === $excluded) {
                return;
            }
            $before = ['excluded' => (bool) $response->excluded, 'reason' => $response->excluded_reason];
            $response->forceFill($excluded
                ? ['excluded' => true, 'excluded_reason' => $reason, 'excluded_by' => $user->id]
                : ['excluded' => false, 'excluded_reason' => null, 'excluded_by' => null])->save();
            Audit::record($excluded ? 'survey.exclude' : 'survey.restore', $response, [
                'before' => $before,
                'after' => ['excluded' => $excluded, 'reason' => $excluded ? $reason : null],
            ], $locked, $actorRole);
        });
    }

    public function justify(Assessment $assessment, User $user, Role $actorRole, string $stratumId, string $text): void
    {
        DB::transaction(function () use ($assessment, $user, $actorRole, $stratumId, $text) {
            $locked = $this->lockOpen($assessment);
            if (! $locked->strata()->whereKey($stratumId)->exists()) {
                throw RuleViolation::invalid('stratumId', 'NOT_FOUND');
            }
            $row = StratumJustification::firstOrNew(['stratum_id' => $stratumId], ['assessment_id' => $locked->id]);
            $before = $row->exists ? $row->justification : null;
            $row->forceFill(['justification' => $text, 'written_by' => $user->id])->save();
            Audit::record('participation.justify', $row, ['before' => $before, 'after' => $text], $locked, $actorRole);
        });
    }

    public function review(Assessment $assessment, User $user, Role $actorRole, string $kind, ?string $note): void
    {
        DB::transaction(function () use ($assessment, $user, $actorRole, $kind, $note) {
            $locked = $this->lockOpen($assessment);
            $row = AssessmentReview::firstOrNew(['assessment_id' => $locked->id, 'kind' => $kind]);
            $row->forceFill(['note' => $note, 'reviewed_by' => $user->id, 'reviewed_at' => now()])->save();
            Audit::record('quality.review', $row, ['after' => ['kind' => $kind, 'note' => $note]], $locked, $actorRole);
        });
    }

    private function lockOpen(Assessment $assessment): Assessment
    {
        $locked = Assessment::whereKey($assessment->id)->lockForUpdate()->firstOrFail();
        if (! self::reviewOpen($locked->status)) {
            throw RuleViolation::locked('REVIEW_CLOSED');
        }

        return $locked;
    }
}
