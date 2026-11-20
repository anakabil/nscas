<?php

namespace App\Services\Reports;

use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\EvidenceItem;
use App\Models\GapItem;
use App\Models\Report;
use App\Models\ResultCommunication;
use App\Models\ScoreRun;
use App\Models\User;
use App\Models\ValidationSession;
use App\Services\Files\ObjectStore;
use App\Services\Respondents\ParticipationReport;
use App\Services\Results\ResultsService;
use App\Support\Audit;
use App\Support\RuleViolation;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Laporan dan komunikasi hasil (docs/01 M11 dan bagian 6, docs/12 temuan T5), dibawa dari v1 src/lib/report.
 * Setiap versi menyimpan potret isi laporan dari hasil final; versi final ditandatangani asesor utama. Laporan
 * tidak mencantumkan nama narasumber validasi (docs/13 V16) maupun data per responden.
 */
class ReportService
{
    public const KINDS = ['FULL', 'EXECUTIVE_SUMMARY', 'STATEMENT', 'WORKER_SUMMARY'];

    public const CHANNELS = ['SAFETY_TALK', 'NOTICE_BOARD', 'MEETING', 'EMAIL', 'MESSAGING', 'INTRANET'];

    public function __construct(private readonly ResultsService $results, private readonly PdfRenderer $pdf, private readonly ObjectStore $store) {}

    public static function open(AssessmentStatus $status): bool
    {
        return in_array($status, [AssessmentStatus::ActionPlanning, AssessmentStatus::Reported, AssessmentStatus::Monitoring], true);
    }

    /**
     * Isi laporan dari hasil final dan data asesmen saat ini. Null bila hasil belum ditetapkan.
     *
     * @return array<string, mixed>|null
     */
    public function content(Assessment $assessment, string $kind, string $locale): ?array
    {
        $dashboard = $this->results->dashboard($assessment, false, null);
        if ($dashboard === null || $dashboard['provisional']) {
            return null;
        }
        $assessment->loadMissing(['organization', 'instrumentVersion']);
        $snapshot = $assessment->parameter_snapshot ?? [];
        $run = ScoreRun::where('assessment_id', $assessment->id)->where('is_final', true)->with('decisions')->firstOrFail();
        $participation = ParticipationReport::for($assessment, null);
        $gaps = GapItem::where('assessment_id', $assessment->id)->orderBy('rank')->with(['actions' => fn ($q) => $q->orderBy('due_date')])->get();
        $sortedChars = collect($dashboard['characteristics'])->filter(fn ($c) => ! $c['contextual'] && $c['value'] !== null);

        return [
            'kind' => $kind,
            'locale' => $locale,
            'meta' => [
                'organization' => $assessment->organization->name,
                'assessment' => $assessment->name,
                'scopeType' => $assessment->scope_type->value,
                'periodStart' => $assessment->period_start->toDateString(),
                'periodEnd' => $assessment->period_end->toDateString(),
                'targetLevel' => $dashboard['targetLevel'],
                'instrument' => $assessment->instrumentVersion?->code,
                'dataLocation' => $locale === 'en' ? config('nscas.data_location_en') : config('nscas.data_location'),
                'finalizedAt' => $dashboard['finalizedAt'],
                'engineVersion' => $dashboard['engineVersion'],
                'units' => count($snapshot['units'] ?? []),
                'workers' => array_sum(array_map(fn ($s) => (int) $s['population'], $snapshot['strata'] ?? [])),
            ],
            'results' => [
                'organization' => $dashboard['organization'],
                'sclLevel' => $dashboard['sclLevel'],
                'aspects' => $dashboard['aspects'],
                'characteristics' => $dashboard['characteristics'],
                'divergence' => $dashboard['divergence'],
                'perceptionGap' => $dashboard['perceptionGap'],
                'gapAttention' => $dashboard['gapAttention'],
                'heatmapStrata' => $dashboard['heatmaps']['strata'],
                'sensitivity' => $dashboard['sensitivity'],
                'minCell' => $dashboard['minCell'],
                'strengths' => $sortedChars->sortByDesc('value')->take(3)->values()->map(fn ($c) => ['code' => $c['code'], 'name' => $locale === 'en' && $c['nameEn'] ? $c['nameEn'] : $c['name'], 'value' => $c['value']])->all(),
            ],
            'participation' => [
                'strata' => $participation['summary']['strata'],
                'units' => $participation['summary']['units'],
                'totals' => $participation['summary']['totals'] ?? null,
                'minParticipation' => $participation['minParticipation'],
            ],
            'quality' => $dashboard['quality'],
            'panel' => $run->decisions->sortBy('characteristic_code')->map(fn ($d) => [
                'code' => $d->characteristic_code, 'kind' => $d->kind, 'engineValue' => $d->engine_value, 'value' => $d->adjusted_value, 'rationale' => $d->rationale,
            ])->values()->all(),
            'gaps' => $gaps->map(fn (GapItem $g) => [
                'rank' => $g->rank, 'code' => $g->characteristic_code, 'currentIndex' => $g->current_index, 'gap' => $g->gap,
                'contextual' => $g->is_contextual, 'priority' => $g->priority, 'rootCause' => $g->root_cause,
                'actions' => $g->actions->map(fn ($a) => ['title' => $a->title, 'owner' => $a->owner_position, 'dueDate' => $a->due_date->toDateString(), 'indicator' => $a->success_indicator])->values()->all(),
            ])->all(),
            // Tanpa nama narasumber: hanya jenis sesi, kelompok jabatan, tanggal, dan banyak narasumber.
            'sessions' => ValidationSession::where('assessment_id', $assessment->id)->where('status', 'COMPLETED')->withCount('participants')
                ->orderBy('scheduled_at')->get(['id', 'type', 'layer', 'scheduled_at'])
                ->map(fn ($s) => ['type' => $s->type, 'layer' => $s->layer, 'date' => $s->scheduled_at?->setTimezone('Asia/Jakarta')->toDateString(), 'participants' => $s->participants_count])->all(),
            'evidence' => EvidenceItem::where('assessment_id', $assessment->id)->whereNull('deleted_at')
                ->whereNotExists(fn ($q) => $q->from('evidence_items as newer')->whereColumn('newer.supersedes_id', 'evidence_items.id'))
                ->orderBy('title')->get(['title', 'version', 'sha256'])
                ->map(fn ($e) => ['title' => $e->title, 'version' => $e->version, 'sha256' => substr($e->sha256, 0, 16)])->all(),
            'parameters' => [
                ...$dashboard['parameters'],
                'consolidation' => $run->parameter_snapshot['consolidation'] ?? null,
                'assessorDisagreementFlag' => $run->parameter_snapshot['assessorDisagreementFlag'] ?? null,
                'quality' => $run->parameter_snapshot['quality'] ?? null,
                'aspectWeights' => array_map(fn ($a) => ['code' => $a['code'], 'name' => $a['name'], 'weight' => $a['weight']], $dashboard['aspects']),
                'sampling' => $snapshot['samplePlan']['result'] ?? null,
            ],
            'limitations' => [
                'belowMinimum' => array_values(array_map(fn ($s) => $s['code'], array_filter($participation['summary']['strata'], fn ($s) => $s['belowMinimum']))),
                'unstable' => ! $dashboard['sensitivity']['stable'],
            ],
            'communications' => ResultCommunication::where('assessment_id', $assessment->id)->count(),
        ];
    }

    public function html(array $content, ?Report $report): string
    {
        return view('reports.document', [
            'c' => $content,
            'report' => $report,
            'logo' => 'data:image/png;base64,'.base64_encode((string) file_get_contents(public_path('brand/nscas-logo-480.png'))),
        ])->render();
    }

    /** @return list<array<string, mixed>> */
    public function versions(Assessment $assessment): array
    {
        return Report::where('assessment_id', $assessment->id)->with('creator:id,name')->orderBy('kind')->orderByDesc('version')
            ->get(['id', 'kind', 'version', 'locale', 'status', 'signer_name', 'signer_position', 'signed_at', 'created_at', 'created_by', 'storage_key'])
            ->map(fn (Report $r) => [
                'id' => $r->id, 'kind' => $r->kind, 'version' => $r->version, 'locale' => $r->locale, 'status' => $r->status,
                'signer' => $r->signer_name, 'signerPosition' => $r->signer_position, 'signedAt' => $r->signed_at?->toIso8601String(),
                'createdAt' => $r->created_at->toIso8601String(), 'by' => $r->creator?->name, 'hasPdf' => $r->storage_key !== null,
            ])->all();
    }

    public function createVersion(Assessment $assessment, User $user, Role $actorRole, string $kind, string $locale): Report
    {
        return DB::transaction(function () use ($assessment, $user, $actorRole, $kind, $locale) {
            $locked = $this->lock($assessment);
            $content = $this->content($locked, $kind, $locale);
            if ($content === null) {
                throw RuleViolation::locked('RESULTS_NOT_FINAL');
            }
            $version = (int) Report::where('assessment_id', $locked->id)->where('kind', $kind)->max('version') + 1;
            $report = Report::create([
                'assessment_id' => $locked->id, 'kind' => $kind, 'version' => $version, 'locale' => $locale,
                'content' => $content, 'created_by' => $user->id,
            ]);
            Audit::record('report.version', $report, ['after' => ['kind' => $kind, 'version' => $version, 'locale' => $locale]], $locked, $actorRole);

            return $report;
        });
    }

    /** Asesor utama menandatangani versi terakhir satu jenis laporan; setelah itu versi itu tidak dapat diubah. */
    public function sign(Assessment $assessment, User $user, Role $actorRole, string $reportId, string $position): void
    {
        DB::transaction(function () use ($assessment, $user, $actorRole, $reportId, $position) {
            $locked = $this->lock($assessment);
            $report = Report::where('assessment_id', $locked->id)->lockForUpdate()->find($reportId);
            if ($report === null) {
                throw new RuleViolation(404, 'NOT_FOUND');
            }
            if ($report->status === 'FINAL') {
                throw RuleViolation::locked('REPORT_SIGNED');
            }
            $latest = (int) Report::where('assessment_id', $locked->id)->where('kind', $report->kind)->max('version');
            if ($report->version !== $latest) {
                throw RuleViolation::locked('REPORT_NOT_LATEST');
            }
            $report->forceFill(['status' => 'FINAL', 'signed_by' => $user->id, 'signed_at' => now(), 'signer_name' => $user->name, 'signer_position' => $position])->save();
            Audit::record('report.sign', $report, ['after' => ['kind' => $report->kind, 'version' => $report->version, 'signer' => $user->name, 'position' => $position]], $locked, $actorRole);
        });
    }

    public function pdfAvailable(): bool
    {
        return $this->pdf->available();
    }

    /**
     * PDF satu versi: berkas tersimpan untuk versi final, dibuat dan disimpan sekali bila belum ada; versi draf dibuat
     * setiap kali diminta dan tidak disimpan.
     */
    public function pdfResponse(Assessment $assessment, Report $report, ?Role $actorRole): Response
    {
        $name = sprintf('%s %s v%d.pdf', __('report.kinds.'.$report->kind, [], $report->locale), $assessment->name, $report->version);
        if ($report->storage_key !== null) {
            return $this->store->download($report->storage_key, $name, 'application/pdf', false);
        }
        if (! $this->pdf->available()) {
            throw RuleViolation::locked('PDF_UNAVAILABLE');
        }
        $bytes = $this->pdf->render($this->html($report->content, $report));
        if ($report->status === 'FINAL') {
            $key = $this->store->key($assessment->organization_id, $assessment->id, 'report', 'pdf');
            $this->store->disk()->put($key, $bytes);
            $report->forceFill(['storage_key' => $key, 'pdf_sha256' => hash('sha256', $bytes)])->save();
            Audit::record('report.pdf', $report, ['after' => ['kind' => $report->kind, 'version' => $report->version, 'sha256' => hash('sha256', $bytes)]], $assessment, $actorRole);
        }
        $safe = rawurlencode($name);

        return response($bytes, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => "attachment; filename*=UTF-8''{$safe}",
            'Cache-Control' => 'private, no-store',
        ]);
    }

    /** @return list<array<string, mixed>> */
    public function communications(Assessment $assessment): array
    {
        return ResultCommunication::where('assessment_id', $assessment->id)->with('recorder:id,name')->orderByDesc('communicated_on')->get()
            ->map(fn (ResultCommunication $c) => [
                'id' => $c->id, 'date' => $c->communicated_on->toDateString(), 'channels' => $c->channels, 'audience' => $c->audience,
                'reached' => $c->reached, 'note' => $c->note, 'by' => $c->recorder?->name,
            ])->all();
    }

    /** @param list<string> $channels */
    public function recordCommunication(Assessment $assessment, User $user, Role $actorRole, string $date, array $channels, string $audience, ?int $reached, ?string $note): void
    {
        DB::transaction(function () use ($assessment, $user, $actorRole, $date, $channels, $audience, $reached, $note) {
            $locked = $this->lock($assessment);
            $row = ResultCommunication::create([
                'assessment_id' => $locked->id, 'communicated_on' => $date, 'channels' => array_values(array_unique($channels)),
                'audience' => $audience, 'reached' => $reached, 'note' => $note, 'recorded_by' => $user->id,
            ]);
            Audit::record('communication.record', $row, ['after' => ['date' => $date, 'channels' => $channels, 'audience' => $audience, 'reached' => $reached]], $locked, $actorRole);
        });
    }

    private function lock(Assessment $assessment): Assessment
    {
        $locked = Assessment::whereKey($assessment->id)->lockForUpdate()->firstOrFail();
        if (! self::open($locked->status)) {
            throw RuleViolation::locked('REPORT_CLOSED');
        }

        return $locked;
    }
}
