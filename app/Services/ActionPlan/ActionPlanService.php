<?php

namespace App\Services\ActionPlan;

use App\Domain\Access\Role;
use App\Domain\ActionPlan\ActionPlanRules;
use App\Domain\Scoring\EngineParameters;
use App\Domain\Scoring\ScoringEngine;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\ActionItem;
use App\Models\ActionUpdate;
use App\Models\Assessment;
use App\Models\Characteristic;
use App\Models\GapItem;
use App\Models\MonitoringReview;
use App\Models\ScoreRun;
use App\Models\Unit;
use App\Models\User;
use App\Support\Audit;
use App\Support\RuleViolation;
use DateTimeInterface;
use Illuminate\Support\Facades\DB;

/**
 * Daftar kesenjangan, rencana aksi, dan pemantauan (docs/01 M10), dibawa dari v1 src/lib/action-plan/service.ts.
 * Daftar kesenjangan dibentuk dari hasil final rapat panel; koordinator unit hanya mengelola tindakan unitnya.
 */
class ActionPlanService
{
    /** Membentuk daftar kesenjangan dari hasil final bila belum ada. Mengembalikan banyak butir yang dibuat. */
    public function ensureGaps(Assessment $assessment, ?Role $actorRole = null): int
    {
        if (GapItem::where('assessment_id', $assessment->id)->exists()) {
            return 0;
        }
        $run = ScoreRun::where('assessment_id', $assessment->id)->where('is_final', true)->first();
        if ($run === null) {
            return 0;
        }
        $target = (float) ($run->input_snapshot['targetLevel'] ?? $assessment->target_level);
        $list = ActionPlanRules::gapList(
            array_map(fn (array $c) => [
                'code' => $c['code'], 'aspectCode' => $c['aspectCode'], 'isContextual' => (bool) $c['isContextual'],
                'final' => $c['final'] === null ? null : (float) $c['final'], 'panelAdjusted' => $c['panelAdjusted'] === null ? null : (float) $c['panelAdjusted'],
            ], $run->final_result['characteristics']),
            ScoringEngine::aspectWeights(EngineParameters::fromSnapshot($run->parameter_snapshot)),
            $target,
        );
        $ids = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->pluck('id', 'code');
        foreach ($list as $g) {
            GapItem::create([
                'assessment_id' => $assessment->id,
                'characteristic_id' => $ids[$g['code']],
                'characteristic_code' => $g['code'],
                'score_run_id' => $run->id,
                'current_index' => $g['currentIndex'],
                'target_level' => $target,
                'gap' => $g['gap'],
                'priority_score' => $g['priorityScore'],
                'rank' => $g['rank'],
                'is_contextual' => $g['isContextual'],
            ]);
        }
        Audit::record('gap.generate', $assessment, ['after' => ['items' => count($list), 'scoreRun' => $run->id]], $assessment, $actorRole);

        return count($list);
    }

    /**
     * @param  list<string>|null  $scope  unit koordinator; null berarti semua unit
     * @return array<string, mixed>
     */
    public function plan(Assessment $assessment, ?array $scope, DateTimeInterface $now): array
    {
        $names = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->get(['code', 'name_id', 'name_en'])->keyBy('code');
        $gaps = GapItem::where('assessment_id', $assessment->id)->orderBy('rank')
            ->with(['actions' => fn ($q) => $q->with('unit:id,name')->orderBy('due_date')])->get();

        return [
            'publishedAt' => $assessment->action_plan_published_at?->toIso8601String(),
            'incomplete' => ActionPlanRules::incomplete($gaps->map(fn (GapItem $g) => [
                'code' => $g->characteristic_code, 'rootCause' => $g->root_cause,
                'activeActions' => $g->actions->where('status', '!=', 'CANCELLED')->count(),
            ])->all()),
            'gaps' => $gaps->map(fn (GapItem $g) => [
                'id' => $g->id,
                'code' => $g->characteristic_code,
                'name' => $names[$g->characteristic_code]->name_id ?? $g->characteristic_code,
                'nameEn' => $names[$g->characteristic_code]->name_en ?? null,
                'currentIndex' => $g->current_index,
                'targetLevel' => $g->target_level,
                'gap' => $g->gap,
                'priorityScore' => $g->priority_score,
                'rank' => $g->rank,
                'contextual' => $g->is_contextual,
                'rootCause' => $g->root_cause,
                'priority' => $g->priority,
                'actions' => $g->actions->map(fn (ActionItem $a) => $this->actionRow($a, $scope, $now))->values()->all(),
            ])->all(),
        ];
    }

    /** @return array<string, mixed> */
    private function actionRow(ActionItem $a, ?array $scope, DateTimeInterface $now): array
    {
        $due = $a->due_date->toDateString();

        return [
            'id' => $a->id,
            'title' => $a->title,
            'description' => $a->description,
            'ownerName' => $a->owner_name,
            'ownerPosition' => $a->owner_position,
            'hasEmail' => $a->owner_email !== null,
            'unitId' => $a->unit_id,
            'unit' => $a->unit?->name,
            'dueDate' => $due,
            'quarter' => ActionPlanRules::quarterOf($due),
            'successIndicator' => $a->success_indicator,
            'status' => $a->status,
            'progress' => $a->progress_percent,
            'dueState' => ActionPlanRules::dueState($a->status, $due, $now),
            'editable' => $scope === null || ($a->unit_id !== null && in_array($a->unit_id, $scope, true)),
        ];
    }

    public function updateGap(Assessment $assessment, Role $actorRole, string $gapId, ?string $rootCause, ?string $priority): void
    {
        DB::transaction(function () use ($assessment, $actorRole, $gapId, $rootCause, $priority) {
            $locked = $this->lock($assessment);
            $gap = GapItem::where('assessment_id', $locked->id)->lockForUpdate()->find($gapId);
            if ($gap === null) {
                throw new RuleViolation(404, 'NOT_FOUND');
            }
            $before = ['rootCause' => $gap->root_cause, 'priority' => $gap->priority];
            $gap->forceFill(['root_cause' => $rootCause, 'priority' => $priority])->save();
            Audit::record('gap.analysis', $gap, ['before' => $before, 'after' => ['characteristic' => $gap->characteristic_code, 'rootCause' => $rootCause, 'priority' => $priority]], $locked, $actorRole);
        });
    }

    /**
     * @param  array{title: string, description: ?string, ownerName: string, ownerPosition: string, ownerEmail: ?string, unitId: ?string, dueDate: string, successIndicator: string}  $input
     * @param  list<string>|null  $scope
     */
    public function createAction(Assessment $assessment, User $user, Role $actorRole, ?array $scope, string $gapId, array $input): ActionItem
    {
        return DB::transaction(function () use ($assessment, $user, $actorRole, $scope, $gapId, $input) {
            $locked = $this->lock($assessment);
            $gap = GapItem::where('assessment_id', $locked->id)->find($gapId);
            if ($gap === null) {
                throw new RuleViolation(404, 'NOT_FOUND');
            }
            $this->assertUnit($locked, $scope, $input['unitId']);
            $action = $gap->actions()->create([...$this->fields($input), 'created_by' => $user->id]);
            Audit::record('action.create', $action, ['after' => $this->auditFields($action, $gap->characteristic_code)], $locked, $actorRole);

            return $action;
        });
    }

    /** @param  array{title: string, description: ?string, ownerName: string, ownerPosition: string, ownerEmail: ?string, unitId: ?string, dueDate: string, successIndicator: string}  $input */
    public function updateAction(Assessment $assessment, Role $actorRole, ?array $scope, string $actionId, array $input): void
    {
        DB::transaction(function () use ($assessment, $actorRole, $scope, $actionId, $input) {
            $locked = $this->lock($assessment);
            $action = $this->action($locked, $actionId);
            $this->assertUnit($locked, $scope, $action->unit_id);
            $this->assertUnit($locked, $scope, $input['unitId']);
            if ($action->status === 'VERIFIED') {
                throw RuleViolation::locked('ACTION_VERIFIED');
            }
            $before = $this->auditFields($action, $action->gap->characteristic_code);
            $fields = $this->fields($input);
            // Alamat surel tersimpan tidak ditampilkan kembali; isian kosong berarti alamat lama dipertahankan.
            if ($input['ownerEmail'] === null) {
                unset($fields['owner_email']);
            }
            $action->forceFill($fields)->save();
            Audit::record('action.update', $action, ['before' => $before, 'after' => $this->auditFields($action, $action->gap->characteristic_code)], $locked, $actorRole);
        });
    }

    public function addProgress(Assessment $assessment, User $user, Role $actorRole, ?array $scope, string $actionId, string $note, int $percent, string $status): void
    {
        DB::transaction(function () use ($assessment, $user, $actorRole, $scope, $actionId, $note, $percent, $status) {
            $locked = $this->lock($assessment);
            $action = $this->action($locked, $actionId);
            $this->assertUnit($locked, $scope, $action->unit_id);
            if ($action->status === 'VERIFIED') {
                throw RuleViolation::locked('ACTION_VERIFIED');
            }
            $percent = $status === 'DONE' ? 100 : $percent;
            $before = ['status' => $action->status, 'progress' => $action->progress_percent];
            ActionUpdate::create(['action_item_id' => $action->id, 'kind' => 'PROGRESS', 'note' => $note, 'progress_percent' => $percent, 'status' => $status, 'created_by' => $user->id]);
            $action->forceFill(['status' => $status, 'progress_percent' => $percent])->save();
            Audit::record('action.progress', $action, ['before' => $before, 'after' => ['status' => $status, 'progress' => $percent, 'note' => $note]], $locked, $actorRole);
        });
    }

    /** Verifikasi asesor atas tindakan selesai: disetujui menjadi VERIFIED, ditolak kembali ke IN_PROGRESS. */
    public function verify(Assessment $assessment, User $user, Role $actorRole, string $actionId, bool $approve, string $note): void
    {
        DB::transaction(function () use ($assessment, $user, $actorRole, $actionId, $approve, $note) {
            $locked = $this->lock($assessment);
            $action = $this->action($locked, $actionId);
            if ($action->status !== 'DONE') {
                throw RuleViolation::locked('ACTION_NOT_DONE');
            }
            $status = $approve ? 'VERIFIED' : 'IN_PROGRESS';
            ActionUpdate::create(['action_item_id' => $action->id, 'kind' => 'VERIFICATION', 'note' => $note, 'progress_percent' => $approve ? 100 : $action->progress_percent, 'status' => $status, 'created_by' => $user->id]);
            $action->forceFill(['status' => $status, 'verified_by' => $approve ? $user->id : null, 'verified_at' => $approve ? now() : null])->save();
            Audit::record($approve ? 'action.verify' : 'action.reject', $action, ['after' => ['status' => $status, 'note' => $note]], $locked, $actorRole);
        });
    }

    public function publish(Assessment $assessment, Role $actorRole): void
    {
        DB::transaction(function () use ($assessment, $actorRole) {
            $locked = Assessment::whereKey($assessment->id)->lockForUpdate()->firstOrFail();
            if (! ActionPlanRules::publishOpen($locked->status)) {
                throw RuleViolation::locked('PLAN_CLOSED');
            }
            $gaps = GapItem::where('assessment_id', $locked->id)->withCount(['actions as active_actions' => fn ($q) => $q->where('status', '!=', 'CANCELLED')])->get();
            if ($gaps->isEmpty()) {
                throw RuleViolation::invalid('form', 'GAP_LIST_MISSING');
            }
            $incomplete = ActionPlanRules::incomplete($gaps->map(fn (GapItem $g) => ['code' => $g->characteristic_code, 'rootCause' => $g->root_cause, 'activeActions' => (int) $g->active_actions])->all());
            if ($incomplete !== []) {
                throw RuleViolation::invalid('form', 'ACTION_PLAN_INCOMPLETE');
            }
            $locked->forceFill(['action_plan_published_at' => now()])->save();
            Audit::record('action_plan.publish', $locked, ['after' => ['gapItems' => $gaps->count()]], $locked, $actorRole);
        });
    }

    /**
     * Pemantauan: tindakan per triwulan tenggat dengan keadaan tenggat dan riwayat, serta tinjauan triwulan.
     *
     * @param  list<string>|null  $scope
     * @return array<string, mixed>
     */
    public function monitoring(Assessment $assessment, ?array $scope, DateTimeInterface $now): array
    {
        $actions = ActionItem::whereIn('gap_item_id', GapItem::where('assessment_id', $assessment->id)->select('id'))
            ->with(['gap:id,characteristic_code', 'unit:id,name', 'updates' => fn ($q) => $q->with('author:id,name')->orderByDesc('created_at')])
            ->orderBy('due_date')->get();
        $rows = $actions->map(fn (ActionItem $a) => [
            ...$this->actionRow($a, $scope, $now),
            'code' => $a->gap?->characteristic_code,
            'updates' => $a->updates->take(5)->map(fn (ActionUpdate $u) => [
                'kind' => $u->kind, 'note' => $u->note, 'progress' => $u->progress_percent, 'status' => $u->status,
                'by' => $u->author?->name, 'at' => $u->created_at->toIso8601String(),
            ])->values()->all(),
        ])->values()->all();
        $count = fn (string $state) => count(array_filter($rows, fn (array $r) => $r['dueState'] === $state));

        return [
            'actions' => $rows,
            'summary' => [
                'total' => count($rows),
                'verified' => count(array_filter($rows, fn (array $r) => $r['status'] === 'VERIFIED')),
                'done' => count(array_filter($rows, fn (array $r) => $r['status'] === 'DONE')),
                'overdue' => $count('overdue'),
                'dueSoon' => $count('dueSoon'),
            ],
            'currentQuarter' => ActionPlanRules::quarterOf(ActionPlanRules::wibDay($now)),
            'reviews' => MonitoringReview::where('assessment_id', $assessment->id)->with('reviewer:id,name')->orderByDesc('quarter')->get()
                ->map(fn (MonitoringReview $r) => ['quarter' => $r->quarter, 'summary' => $r->summary, 'closing' => $r->closing, 'by' => $r->reviewer?->name, 'at' => $r->updated_at->toIso8601String()])->all(),
        ];
    }

    public function review(Assessment $assessment, User $user, Role $actorRole, string $quarter, string $summary, bool $closing): void
    {
        DB::transaction(function () use ($assessment, $user, $actorRole, $quarter, $summary, $closing) {
            $locked = Assessment::whereKey($assessment->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== AssessmentStatus::Monitoring) {
                throw RuleViolation::locked('MONITORING_CLOSED');
            }
            $row = MonitoringReview::firstOrNew(['assessment_id' => $locked->id, 'quarter' => $quarter]);
            $before = $row->exists ? ['summary' => $row->summary, 'closing' => $row->closing] : null;
            $row->forceFill(['summary' => $summary, 'closing' => $closing, 'reviewed_by' => $user->id])->save();
            Audit::record('monitoring.review', $row, ['before' => $before, 'after' => ['quarter' => $quarter, 'summary' => $summary, 'closing' => $closing]], $locked, $actorRole);
        });
    }

    /** @return array<string, mixed> */
    private function fields(array $input): array
    {
        return [
            'title' => $input['title'],
            'description' => $input['description'],
            'owner_name' => $input['ownerName'],
            'owner_position' => $input['ownerPosition'],
            'owner_email' => $input['ownerEmail'],
            'unit_id' => $input['unitId'],
            'due_date' => $input['dueDate'],
            'success_indicator' => $input['successIndicator'],
        ];
    }

    /** Alamat surel tidak ditulis ke jejak audit. @return array<string, mixed> */
    private function auditFields(ActionItem $a, string $code): array
    {
        return [
            'characteristic' => $code, 'title' => $a->title, 'ownerName' => $a->owner_name, 'ownerPosition' => $a->owner_position,
            'unitId' => $a->unit_id, 'dueDate' => $a->due_date->toDateString(), 'successIndicator' => $a->success_indicator, 'status' => $a->status,
        ];
    }

    private function action(Assessment $assessment, string $id): ActionItem
    {
        $action = ActionItem::whereIn('gap_item_id', GapItem::where('assessment_id', $assessment->id)->select('id'))->with('gap')->lockForUpdate()->find($id);
        if ($action === null) {
            throw new RuleViolation(404, 'NOT_FOUND');
        }

        return $action;
    }

    /** Koordinator unit hanya mengelola tindakan unitnya; unit harus milik asesmen ini. */
    private function assertUnit(Assessment $assessment, ?array $scope, ?string $unitId): void
    {
        if ($unitId !== null && ! Unit::where('assessment_id', $assessment->id)->whereKey($unitId)->exists()) {
            throw RuleViolation::invalid('unitId', 'NOT_FOUND');
        }
        if ($scope !== null && ($unitId === null || ! in_array($unitId, $scope, true))) {
            throw RuleViolation::invalid('unitId', 'UNIT_OUT_OF_SCOPE');
        }
    }

    private function lock(Assessment $assessment): Assessment
    {
        $locked = Assessment::whereKey($assessment->id)->lockForUpdate()->firstOrFail();
        if (! ActionPlanRules::planOpen($locked->status)) {
            throw RuleViolation::locked('PLAN_CLOSED');
        }

        return $locked;
    }
}
