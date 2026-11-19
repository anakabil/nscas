<?php

namespace App\Http\Controllers;

use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Services\AssessmentSetup;
use App\Support\AssessmentAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Perubahan status asesmen satu langkah maju, setelah semua syarat terpenuhi (docs/01 bagian 3). */
class AssessmentTransitionController extends Controller
{
    public function __invoke(Request $request, Assessment $assessment, AssessmentSetup $setup): RedirectResponse
    {
        $user = $request->user()->load(['memberships', 'teamAssignments']);
        $roles = AssessmentAccess::requireMember($user, $assessment);
        $data = $request->validate(['to' => ['required', Rule::enum(AssessmentStatus::class)]]);
        $setup->transition($assessment, AssessmentStatus::from($data['to']), $roles);

        return back()->with('status', 'transitioned');
    }
}
