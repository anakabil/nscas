<?php

namespace App\Http\Controllers;

use App\Models\Assessment;
use App\Models\DestructionRecord;
use App\Services\Retention\RetentionService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * Retensi data (docs/04 bagian 7): daftar masa simpan, pemusnahan data mentah, dan berita acaranya. Hanya untuk
 * pengelola sistem; peran lain menerima 404 agar keberadaan halaman tidak terungkap.
 */
class RetentionController extends Controller
{
    public function index(Request $request, RetentionService $retention): Response
    {
        $this->requireSuperAdmin($request);

        return Inertia::render('retention/index', [
            'rows' => $retention->overview(),
            'categories' => RetentionService::CATEGORIES,
        ]);
    }

    public function destroy(Request $request, Assessment $assessment, RetentionService $retention): RedirectResponse
    {
        $this->requireSuperAdmin($request);
        $data = $request->validate([
            'ref' => ['required', 'string', 'min:3', 'max:200'],
            'confirmedBy' => ['required', 'string', 'min:3', 'max:200'],
            'confirmedOn' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.now('Asia/Jakarta')->toDateString()],
            'witness' => ['required', 'string', 'min:3', 'max:200'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'confirm' => ['accepted'],
        ]);
        $notes = trim((string) ($data['notes'] ?? ''));
        $retention->execute($assessment, $request->user(), [
            'ref' => trim($data['ref']),
            'confirmedBy' => trim($data['confirmedBy']),
            'confirmedOn' => $data['confirmedOn'],
            'witness' => trim($data['witness']),
            'notes' => $notes === '' ? null : $notes,
        ]);

        return back()->with('status', 'destroyed');
    }

    /** Berita acara dalam HTML untuk dibaca atau dicetak dari peramban. */
    public function show(Request $request, DestructionRecord $record, RetentionService $retention): HttpResponse
    {
        $this->requireSuperAdmin($request);

        return response($retention->minutesHtml($record), 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Cache-Control' => 'private, no-store',
            'Content-Security-Policy' => "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
        ]);
    }

    public function pdf(Request $request, DestructionRecord $record, RetentionService $retention): HttpResponse
    {
        $this->requireSuperAdmin($request);

        return $retention->minutesResponse($record);
    }

    private function requireSuperAdmin(Request $request): void
    {
        abort_unless($request->user()?->is_super_admin, 404);
    }
}
