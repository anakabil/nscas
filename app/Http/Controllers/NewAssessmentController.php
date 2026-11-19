<?php

namespace App\Http\Controllers;

use App\Domain\Access\Role;
use App\Http\Controllers\Setup\DetailsController;
use App\Models\Organization;
use App\Models\User;
use App\Services\AssessmentSetup;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Asesmen baru oleh asesor utama Nusa Safety, yang otomatis menjadi asesor utama asesmen itu (PROMPTS.md R1). */
class NewAssessmentController extends Controller
{
    public function create(Request $request): Response
    {
        $this->authorizeLead($request->user());

        return Inertia::render('assessments/create', [
            'organizations' => Organization::query()->where('is_operator', false)->where('is_active', true)->orderBy('name')
                ->get(['id', 'name'])->map(fn (Organization $o) => ['id' => $o->id, 'name' => $o->name])->all(),
            'instrumentVersions' => DetailsController::versionOptions(),
            'canManageOrganizations' => $request->user()->is_super_admin,
        ]);
    }

    public function store(Request $request, AssessmentSetup $setup): RedirectResponse
    {
        $user = $this->authorizeLead($request->user());
        $data = DetailsController::validated($request);
        $data += $request->validate(['organization_id' => ['required', 'string', 'max:64']]);
        $assessment = $setup->create($user, $data);

        return redirect()->route('setup.details', $assessment)->with('status', 'created');
    }

    private function authorizeLead(User $user): User
    {
        $user->loadMissing('memberships.organization');
        $isLead = $user->memberships->contains(fn ($m) => $m->role === Role::LeadAssessor && $m->organization->is_operator);
        abort_unless($isLead, 403);

        return $user;
    }
}
