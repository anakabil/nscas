<?php

namespace App\Http\Controllers\Results;

use App\Domain\Access\Role;
use App\Models\Assessment;
use App\Models\Report;
use App\Services\Reports\ReportService;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/**
 * Laporan (docs/01 M11): laporan lengkap, ringkasan eksekutif, pernyataan hasil, dan ringkasan untuk pekerja sebagai
 * HTML siap cetak dan PDF, dengan versi bernomor dan tanda tangan asesor utama. Dibaca asesor, administrator klien,
 * dan peninjau eksekutif; versi dibuat dan ditandatangani asesor utama.
 */
class ReportController extends ReportingStageController
{
    public function index(Request $request, Assessment $assessment, ReportService $reports): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'report');
        $lead = in_array(Role::LeadAssessor, $roles, true);
        $open = ReportService::open($assessment->status);

        return Inertia::render('results/report', [
            ...$this->collectionCommon($assessment, $roles),
            'ready' => $open && $reports->content($assessment, 'STATEMENT', 'id') !== null,
            'canCreate' => $lead && $open,
            'canSign' => $lead && $open,
            'pdfAvailable' => $reports->pdfAvailable(),
            'kinds' => ReportService::KINDS,
            'versions' => $reports->versions($assessment),
        ]);
    }

    /** Pratinjau draf dari data terkini; tidak disimpan. */
    public function preview(Request $request, Assessment $assessment, string $kind, ReportService $reports): HttpResponse
    {
        $this->pageRoles($request, $assessment, 'report');
        $locale = $request->query('locale') === 'en' ? 'en' : 'id';
        $content = $reports->content($assessment, $kind, $locale);
        abort_if($content === null, 404);

        return response($reports->html($content, null))->header('Cache-Control', 'private, no-store');
    }

    public function store(Request $request, Assessment $assessment, ReportService $reports): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'report');
        abort_unless(in_array(Role::LeadAssessor, $roles, true), 403);
        $data = $request->validate([
            'kind' => ['required', Rule::in(ReportService::KINDS)],
            'locale' => ['required', Rule::in(['id', 'en'])],
        ]);
        $reports->createVersion($assessment, $request->user(), Role::LeadAssessor, $data['kind'], $data['locale']);

        return back()->with('status', 'saved');
    }

    public function show(Request $request, Assessment $assessment, string $report, ReportService $reports): HttpResponse
    {
        $this->pageRoles($request, $assessment, 'report');
        $row = Report::where('assessment_id', $assessment->id)->findOrFail($report);

        return response($reports->html($row->content, $row))->header('Cache-Control', 'private, no-store');
    }

    public function sign(Request $request, Assessment $assessment, string $report, ReportService $reports): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'report');
        abort_unless(in_array(Role::LeadAssessor, $roles, true), 403);
        $data = $request->validate(['position' => ['required', 'string', 'min:2', 'max:200']]);
        $reports->sign($assessment, $request->user(), Role::LeadAssessor, $report, trim($data['position']));

        return back()->with('status', 'signed');
    }

    public function pdf(Request $request, Assessment $assessment, string $report, ReportService $reports): SymfonyResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'report');
        $row = Report::where('assessment_id', $assessment->id)->findOrFail($report);
        $response = $reports->pdfResponse($assessment, $row, $roles[0] ?? null);
        Audit::record('report.download', $row, ['after' => ['kind' => $row->kind, 'version' => $row->version, 'format' => 'pdf']], $assessment, $roles[0] ?? null);

        return $response;
    }
}
