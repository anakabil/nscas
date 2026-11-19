<?php

namespace App\Http\Controllers;

use App\Domain\Access\Role;
use App\Domain\Navigation\MenuBuilder;
use App\Http\Presenters\AssessmentPresenter;
use App\Models\Assessment;
use App\Support\AssessmentAccess;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Beranda: menu utama menurut tahap penilaian (untuk asesmen yang dipilih) dan menurut jenis akun.
 */
class HomeController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user()->load(['memberships.organization', 'teamAssignments']);
        $allRoles = $user->allRoles();

        // Kueri selalu berangkat dari visibleTo agar asesmen organisasi lain tidak pernah termuat (aturan 4).
        $assessments = AssessmentAccess::visibleTo($user)->with('organization')->latest()->limit(50)->get();

        $requested = $request->string('assessment')->toString();
        /** @var Assessment|null $selected */
        $selected = $assessments->firstWhere('id', $requested)
            ?? $assessments->first(fn (Assessment $a) => ! $a->status->isClosed())
            ?? $assessments->first();

        return Inertia::render('home', [
            'persona' => [
                'primaryRole' => Role::primary($allRoles)?->value,
                'roles' => array_map(fn (Role $r) => $r->value, $allRoles),
                'organizations' => $user->memberships->map(fn ($m) => $m->organization->name)->unique()->values()->all(),
            ],
            'accountMenu' => MenuBuilder::account($allRoles),
            'assessments' => $assessments
                ->map(fn (Assessment $a) => AssessmentPresenter::summary($a, AssessmentAccess::rolesFor($user, $a)))
                ->all(),
            'selected' => $selected
                ? AssessmentPresenter::menu($selected, AssessmentAccess::rolesFor($user, $selected))
                : null,
        ]);
    }
}
