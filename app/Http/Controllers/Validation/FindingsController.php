<?php

namespace App\Http\Controllers\Validation;

use App\Models\Assessment;
use App\Services\Findings\FindingsService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Temuan awal tanpa tingkat untuk mengarahkan validasi (docs/12 temuan T4). Hanya dibaca asesor. */
class FindingsController extends ValidationStageController
{
    public function index(Request $request, Assessment $assessment, FindingsService $findings): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'findings');
        $built = $findings->build($assessment);

        return Inertia::render('validation/findings', [
            ...$this->collectionCommon($assessment, $roles),
            'findings' => $built,
        ]);
    }
}
