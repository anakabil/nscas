<?php

namespace App\Http\Controllers\Audit;

use App\Http\Controllers\Respondents\CollectionController;
use App\Models\Assessment;
use App\Services\Audit\AuditTrailService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * Jejak audit satu asesmen (docs/04 bagian 6): dibaca pengelola sistem, asesor utama, dan administrator klien;
 * diekspor ke CSV oleh asesor utama.
 */
class AuditTrailController extends CollectionController
{
    protected function tabMap(): array
    {
        return ['audit' => 'audit'];
    }

    protected function stageKey(): string
    {
        return 'auditStage';
    }

    public function index(Request $request, Assessment $assessment, AuditTrailService $trail): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'audit');
        $filters = $this->filters($request);
        $full = AuditTrailService::full($roles);

        return Inertia::render('audit/index', [
            ...$this->collectionCommon($assessment, $roles),
            'filters' => $filters,
            'categories' => $trail->categories($assessment),
            'full' => $full,
            'canExport' => AuditTrailService::canExport($roles),
            ...$trail->page($assessment, $filters, $full),
        ]);
    }

    public function export(Request $request, Assessment $assessment, AuditTrailService $trail): HttpResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'audit');
        abort_unless(AuditTrailService::canExport($roles), 403);
        $filters = $this->filters($request);
        unset($filters['page']);
        $locale = app()->getLocale();
        $result = $trail->export($assessment, $filters, $locale);
        $name = __('audit.file', [], $locale).'-'.Str::slug($assessment->name).'-'.now('Asia/Jakarta')->format('Ymd-His').'.csv';

        return response($result['csv'], 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$name.'"',
            'Cache-Control' => 'no-store',
        ]);
    }

    /** @return array{category: ?string, from: ?string, to: ?string, page: int} */
    private function filters(Request $request): array
    {
        $data = $request->validate([
            'category' => ['nullable', 'string', 'max:40', 'regex:/^[A-Za-z_]+$/'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
        ]);

        return [
            'category' => $data['category'] ?? null,
            'from' => $data['from'] ?? null,
            'to' => $data['to'] ?? null,
            'page' => (int) ($data['page'] ?? 1),
        ];
    }
}
