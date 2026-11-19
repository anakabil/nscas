<?php

namespace App\Http\Controllers\Results;

use App\Domain\Access\Permissions;
use App\Domain\Access\Resource;
use App\Domain\Access\Role;
use App\Domain\ActionPlan\ActionPlanRules;
use App\Models\Assessment;
use App\Models\Unit;
use App\Services\ActionPlan\ActionPlanService;
use App\Services\Respondents\RespondentScope;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Daftar kesenjangan dan rencana aksi (docs/01 M10). Analisis penyebab oleh asesor dan administrator klien;
 * tindakan oleh administrator klien, asesor, dan koordinator unit (unitnya saja); diterbitkan asesor utama atau
 * administrator klien.
 */
class GapsController extends ReportingStageController
{
    public function index(Request $request, Assessment $assessment, ActionPlanService $plans): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'gaps');
        $scope = RespondentScope::units($request->user(), $assessment, $roles);
        $open = ActionPlanRules::planOpen($assessment->status);
        if ($open) {
            $plans->ensureGaps($assessment);
        }

        return Inertia::render('results/gaps', [
            ...$this->collectionCommon($assessment, $roles),
            'canAnalyse' => $open && $this->analyst($roles) !== null,
            'canAct' => $open && Permissions::canWrite($roles, Resource::ActionPlans),
            'canPublish' => ActionPlanRules::publishOpen($assessment->status) && $this->publisher($roles) !== null,
            'open' => $open,
            'scoped' => $scope !== null,
            'units' => Unit::where('assessment_id', $assessment->id)->orderBy('name')->get(['id', 'name'])
                ->filter(fn (Unit $u) => $scope === null || in_array($u->id, $scope, true))
                ->map(fn (Unit $u) => ['id' => $u->id, 'name' => $u->name])->values()->all(),
            'plan' => $plans->plan($assessment, $scope, now()),
        ]);
    }

    public function analyse(Request $request, Assessment $assessment, string $gap, ActionPlanService $plans): RedirectResponse
    {
        $actor = $this->analyst($this->pageRoles($request, $assessment, 'gaps'));
        abort_if($actor === null, 403);
        $data = $request->validate([
            'rootCause' => ['nullable', 'string', 'max:4000'],
            'priority' => ['nullable', Rule::in(ActionPlanRules::PRIORITIES)],
        ]);
        $root = trim((string) ($data['rootCause'] ?? ''));
        $plans->updateGap($assessment, $actor, $gap, $root === '' ? null : $root, $data['priority'] ?? null);

        return back()->with('status', 'saved');
    }

    public function store(Request $request, Assessment $assessment, string $gap, ActionPlanService $plans): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'gaps');
        $actor = $this->writerFor($roles, Resource::ActionPlans);
        $plans->createAction($assessment, $request->user(), $actor, RespondentScope::units($request->user(), $assessment, $roles), $gap, $this->actionInput($request));

        return back()->with('status', 'saved');
    }

    public function update(Request $request, Assessment $assessment, string $action, ActionPlanService $plans): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'gaps');
        $actor = $this->writerFor($roles, Resource::ActionPlans);
        $plans->updateAction($assessment, $actor, RespondentScope::units($request->user(), $assessment, $roles), $action, $this->actionInput($request));

        return back()->with('status', 'saved');
    }

    public function publish(Request $request, Assessment $assessment, ActionPlanService $plans): RedirectResponse
    {
        $actor = $this->publisher($this->pageRoles($request, $assessment, 'gaps'));
        abort_if($actor === null, 403);
        $plans->publish($assessment, $actor);

        return back()->with('status', 'published');
    }

    /** @return array{title: string, description: ?string, ownerName: string, ownerPosition: string, ownerEmail: ?string, unitId: ?string, dueDate: string, successIndicator: string} */
    private function actionInput(Request $request): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'min:5', 'max:300'],
            'description' => ['nullable', 'string', 'max:4000'],
            'ownerName' => ['required', 'string', 'min:2', 'max:200'],
            'ownerPosition' => ['required', 'string', 'min:2', 'max:200'],
            'ownerEmail' => ['nullable', 'string', 'email:rfc', 'max:254'],
            'unitId' => ['nullable', 'string', 'max:26'],
            'dueDate' => ['required', 'date_format:Y-m-d'],
            'successIndicator' => ['required', 'string', 'min:5', 'max:1000'],
        ]);
        $blank = fn ($v) => ($v = trim((string) $v)) === '' ? null : $v;

        return [
            'title' => trim($data['title']),
            'description' => $blank($data['description'] ?? null),
            'ownerName' => trim($data['ownerName']),
            'ownerPosition' => trim($data['ownerPosition']),
            'ownerEmail' => ($e = $blank($data['ownerEmail'] ?? null)) === null ? null : mb_strtolower($e),
            'unitId' => $blank($data['unitId'] ?? null),
            'dueDate' => $data['dueDate'],
            'successIndicator' => trim($data['successIndicator']),
        ];
    }

    /** @param list<Role> $roles */
    private function analyst(array $roles): ?Role
    {
        foreach ([Role::LeadAssessor, Role::Assessor, Role::ClientAdmin] as $role) {
            if (in_array($role, $roles, true)) {
                return $role;
            }
        }

        return null;
    }

    /** @param list<Role> $roles */
    private function publisher(array $roles): ?Role
    {
        foreach ([Role::LeadAssessor, Role::ClientAdmin] as $role) {
            if (in_array($role, $roles, true)) {
                return $role;
            }
        }

        return null;
    }
}
