<?php

namespace App\Http\Controllers\Results;

use App\Domain\Access\Role;
use App\Models\Assessment;
use App\Models\Report;
use App\Services\Reports\ReportService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Komunikasi hasil kepada pekerja (docs/12 temuan T5): ringkasan untuk pekerja dan catatan penyampaiannya. Dikelola
 * asesor utama dan administrator klien.
 */
class CommunicationController extends ReportingStageController
{
    public function index(Request $request, Assessment $assessment, ReportService $reports): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'communication');
        $summary = Report::where('assessment_id', $assessment->id)->where('kind', 'WORKER_SUMMARY')->orderByDesc('version')->first(['id', 'version', 'status']);

        return Inertia::render('results/communication', [
            ...$this->collectionCommon($assessment, $roles),
            'canRecord' => ReportService::open($assessment->status),
            'channels' => ReportService::CHANNELS,
            'summary' => $summary ? ['id' => $summary->id, 'version' => $summary->version, 'status' => $summary->status] : null,
            'records' => $reports->communications($assessment),
        ]);
    }

    public function store(Request $request, Assessment $assessment, ReportService $reports): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'communication');
        $actor = in_array(Role::LeadAssessor, $roles, true) ? Role::LeadAssessor : Role::ClientAdmin;
        $data = $request->validate([
            'date' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.now('Asia/Jakarta')->toDateString()],
            'channels' => ['required', 'array', 'min:1', 'max:6'],
            'channels.*' => [Rule::in(ReportService::CHANNELS)],
            'audience' => ['required', 'string', 'min:3', 'max:300'],
            'reached' => ['nullable', 'integer', 'min:1', 'max:1000000'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);
        $note = trim((string) ($data['note'] ?? ''));
        $reports->recordCommunication($assessment, $request->user(), $actor, $data['date'], $data['channels'], trim($data['audience']),
            isset($data['reached']) ? (int) $data['reached'] : null, $note === '' ? null : $note);

        return back()->with('status', 'saved');
    }
}
