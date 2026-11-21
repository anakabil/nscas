<?php

namespace App\Http\Controllers\Results;

use App\Domain\Access\Permissions;
use App\Domain\Access\Resource;
use App\Domain\Access\Role;
use App\Domain\ActionPlan\ActionPlanRules;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Services\ActionPlan\ActionPlanService;
use App\Services\Respondents\RespondentScope;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Pemantauan rencana aksi (docs/01 M10): pembaruan kemajuan oleh pelaksana, verifikasi asesor atas tindakan selesai,
 * dan tinjauan triwulan oleh asesor dengan tinjauan penutup sebagai akhir pemantauan.
 */
class MonitoringController extends MonitoringStageController
{
    public function index(Request $request, Assessment $assessment, ActionPlanService $plans): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'monitoring');
        $open = ActionPlanRules::planOpen($assessment->status);

        return Inertia::render('results/monitoring', [
            ...$this->collectionCommon($assessment, $roles),
            'canUpdate' => $open && Permissions::canWrite($roles, Resource::ActionPlans),
            'canVerify' => $open && $this->assessor($roles) !== null,
            'canReview' => $assessment->status === AssessmentStatus::Monitoring && $this->assessor($roles) !== null,
            'open' => $open,
            'monitoring' => $plans->monitoring($assessment, RespondentScope::units($request->user(), $assessment, $roles, Resource::ActionPlans), now()),
        ]);
    }

    public function progress(Request $request, Assessment $assessment, string $action, ActionPlanService $plans): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'monitoring');
        $actor = $this->writerFor($roles, Resource::ActionPlans);
        $data = $request->validate([
            'note' => ['required', 'string', 'min:10', 'max:4000'],
            'progress' => ['required', 'integer', 'between:0,100'],
            'status' => ['required', Rule::in(ActionPlanRules::UPDATE_STATUSES)],
        ]);
        $plans->addProgress($assessment, $request->user(), $actor, RespondentScope::units($request->user(), $assessment, $roles, Resource::ActionPlans, write: true), $action, trim($data['note']), (int) $data['progress'], $data['status']);

        return back()->with('status', 'saved');
    }

    public function verify(Request $request, Assessment $assessment, string $action, ActionPlanService $plans): RedirectResponse
    {
        $actor = $this->assessor($this->pageRoles($request, $assessment, 'monitoring'));
        abort_if($actor === null, 403);
        $data = $request->validate([
            'approve' => ['required', 'boolean'],
            'note' => ['required', 'string', 'min:10', 'max:4000'],
        ]);
        $plans->verify($assessment, $request->user(), $actor, $action, (bool) $data['approve'], trim($data['note']));

        return back()->with('status', 'saved');
    }

    public function review(Request $request, Assessment $assessment, ActionPlanService $plans): RedirectResponse
    {
        $actor = $this->assessor($this->pageRoles($request, $assessment, 'monitoring'));
        abort_if($actor === null, 403);
        $data = $request->validate([
            'quarter' => ['required', 'regex:/^\d{4}-Q[1-4]$/'],
            'summary' => ['required', 'string', 'min:20', 'max:4000'],
            'closing' => ['required', 'boolean'],
        ]);
        $plans->review($assessment, $request->user(), $actor, $data['quarter'], trim($data['summary']), (bool) $data['closing']);

        return back()->with('status', 'saved');
    }

    /** @param list<Role> $roles */
    private function assessor(array $roles): ?Role
    {
        foreach ([Role::LeadAssessor, Role::Assessor] as $role) {
            if (in_array($role, $roles, true)) {
                return $role;
            }
        }

        return null;
    }
}
