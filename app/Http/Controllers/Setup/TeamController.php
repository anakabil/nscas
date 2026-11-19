<?php

namespace App\Http\Controllers\Setup;

use App\Domain\Access\Role;
use App\Models\Assessment;
use App\Models\AssessmentTeamMember;
use App\Models\User;
use App\Services\AssessmentSetup;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Tim asesor per asesmen. Diubah oleh asesor utama asesmen itu atau pengelola sistem, sampai asesmen ditutup. */
class TeamController extends SetupController
{
    public function index(Request $request, Assessment $assessment): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'team');
        $assessment->load('team.user');
        $assigned = $assessment->team->pluck('user_id')->all();
        $canEdit = $this->writerRole($roles) !== null && ! $assessment->status->isClosed();

        $staff = $canEdit ? User::query()
            ->where('is_active', true)
            ->whereNotIn('id', $assigned)
            ->whereHas('memberships', fn ($q) => $q
                ->whereIn('role', [Role::LeadAssessor->value, Role::Assessor->value])
                ->whereHas('organization', fn ($o) => $o->where('is_operator', true)))
            ->with('memberships')
            ->orderBy('name')
            ->get()
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'canLead' => $u->memberships->contains(fn ($m) => $m->role === Role::LeadAssessor),
            ])->all() : [];

        return Inertia::render('setup/team', [
            ...$this->common($assessment, $roles),
            'canEdit' => $canEdit,
            'members' => $assessment->team->sortBy(fn (AssessmentTeamMember $m) => [$m->role->value, $m->user->name])->values()
                ->map(fn (AssessmentTeamMember $m) => [
                    'id' => $m->id,
                    'userId' => $m->user_id,
                    'name' => $m->user->name,
                    'email' => $m->user->email,
                    'role' => $m->role->value,
                    'active' => $m->user->is_active,
                ])->all(),
            'staff' => $staff,
        ]);
    }

    public function store(Request $request, Assessment $assessment, AssessmentSetup $setup): RedirectResponse
    {
        $actor = $this->requireWriter($this->pageRoles($request, $assessment, 'team'));
        $data = $request->validate([
            'user_id' => ['required', 'integer'],
            'role' => ['required', Rule::in([Role::LeadAssessor->value, Role::Assessor->value])],
        ]);
        $setup->addTeamMember($assessment, (int) $data['user_id'], Role::from($data['role']), $actor);

        return back()->with('status', 'saved');
    }

    public function destroy(Request $request, Assessment $assessment, AssessmentTeamMember $member, AssessmentSetup $setup): RedirectResponse
    {
        $actor = $this->requireWriter($this->pageRoles($request, $assessment, 'team'));
        abort_unless($member->assessment_id === $assessment->id, 404);
        $setup->removeTeamMember($assessment, $member, $actor);

        return back()->with('status', 'saved');
    }

    /** @param  list<Role>  $roles */
    private function writerRole(array $roles): ?Role
    {
        foreach ([Role::LeadAssessor, Role::SuperAdmin] as $role) {
            if (in_array($role, $roles, true)) {
                return $role;
            }
        }

        return null;
    }

    /** @param  list<Role>  $roles */
    private function requireWriter(array $roles): Role
    {
        $role = $this->writerRole($roles);
        abort_if($role === null, 403);

        return $role;
    }
}
