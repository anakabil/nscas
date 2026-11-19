<?php

namespace App\Http\Controllers\Results;

use App\Models\Assessment;
use App\Services\Respondents\RespondentScope;
use App\Services\Results\ResultsExport;
use App\Services\Results\ResultsService;
use App\Support\Audit;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Dasbor hasil (docs/01 M9). Dibaca asesor, administrator klien, koordinator unit (peta unit sebatas unitnya), dan
 * peninjau eksekutif. Selain asesor hanya melihat hasil yang sudah ditetapkan rapat panel.
 */
class ResultsController extends ReportingStageController
{
    public function index(Request $request, Assessment $assessment, ResultsService $results): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'dashboard');

        return Inertia::render('results/dashboard', [
            ...$this->collectionCommon($assessment, $roles),
            'results' => $results->dashboard($assessment, $this->isAssessor($roles), RespondentScope::units($request->user(), $assessment, $roles)),
        ]);
    }

    public function export(Request $request, Assessment $assessment, ResultsService $results): BinaryFileResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'dashboard');
        $data = $results->dashboard($assessment, $this->isAssessor($roles), RespondentScope::units($request->user(), $assessment, $roles));
        abort_if($data === null, 404);
        $assessment->loadMissing('organization');
        $locale = app()->getLocale();
        $path = ResultsExport::build($assessment, $data, $locale);
        Audit::record('results.export', $assessment, ['after' => ['provisional' => $data['provisional'], 'format' => 'xlsx']], $assessment, $roles[0] ?? null);
        $name = preg_replace('/[^\pL\pN ._-]+/u', '', __('results.fileName', ['name' => $assessment->name], $locale));

        return response()->download($path, $name, ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])->deleteFileAfterSend();
    }
}
