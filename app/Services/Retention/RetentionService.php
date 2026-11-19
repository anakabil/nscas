<?php

namespace App\Services\Retention;

use App\Domain\Access\Role;
use App\Domain\Retention\RetentionRules;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\DestructionRecord;
use App\Models\User;
use App\Services\AssessmentSetup;
use App\Services\Files\ObjectStore;
use App\Services\Reports\PdfRenderer;
use App\Support\Audit;
use App\Support\RuleViolation;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Masa simpan dan pemusnahan data mentah (docs/04 bagian 7), dibawa dari v1 (src/lib/retention/service.ts dan
 * src/lib/jobs/destruction.ts). Yang dimusnahkan: daftar responden, token, respons survei beserta jawabannya,
 * penilaian mandiri, berkas bukti, rekaman observasi, daftar narasumber validasi, dan alamat surel penanggung jawab
 * aksi. Yang disimpan: hasil agregat, hasil final, laporan final, berita acara, dan jejak audit.
 */
class RetentionService
{
    /** Urutan baris rincian berita acara. */
    public const CATEGORIES = [
        'rosterEntries', 'accessTokens', 'surveyResponses', 'characteristicAnswers', 'climateAnswers', 'selfAssessments',
        'selfAssessmentAnswers', 'evidenceItems', 'evidenceLinks', 'observationCaptures', 'validationParticipants',
        'pendingUploads', 'actionOwnerEmails', 'storageObjects',
    ];

    public function __construct(
        private readonly ObjectStore $store,
        private readonly PdfRenderer $pdf,
        private readonly AssessmentSetup $setup,
    ) {}

    public static function months(Assessment $assessment): int
    {
        $months = $assessment->parameter_snapshot['parameters']['retention']['rawDataMonths'] ?? RetentionRules::DEFAULT_MONTHS;

        return max(1, (int) $months);
    }

    /** @return array{baseline: ?CarbonImmutable, dueAt: ?CarbonImmutable, months: int} */
    public static function schedule(Assessment $assessment): array
    {
        $signed = DB::table('reports')->where('assessment_id', $assessment->id)->where('kind', 'FULL')->where('status', 'FINAL')->min('signed_at');
        $finalized = DB::table('score_runs')->where('assessment_id', $assessment->id)->where('is_final', true)->value('finalized_at');
        $baseline = RetentionRules::baseline(
            $signed ? CarbonImmutable::parse($signed) : null,
            $finalized ? CarbonImmutable::parse($finalized) : null,
        );
        $months = self::months($assessment);
        $due = RetentionRules::dueAt($baseline, $months);

        return [
            'baseline' => $baseline ? CarbonImmutable::instance($baseline) : null,
            'dueAt' => $due ? CarbonImmutable::instance($due) : null,
            'months' => $months,
        ];
    }

    /**
     * Daftar asesmen yang hasilnya sudah ditetapkan, untuk halaman retensi pengelola sistem.
     *
     * @return list<array<string, mixed>>
     */
    public function overview(): array
    {
        $ids = DB::table('score_runs')->where('is_final', true)->pluck('assessment_id');
        $records = DestructionRecord::whereIn('assessment_id', $ids)->get()->keyBy('assessment_id');
        $now = now();

        return Assessment::whereIn('id', $ids)->with('organization:id,name')->orderBy('created_at')->get()
            ->map(function (Assessment $a) use ($records, $now) {
                $plan = self::schedule($a);
                $record = $records->get($a->id);
                $expired = RetentionRules::expired($plan['dueAt'], $now);

                return [
                    'id' => $a->id,
                    'name' => $a->name,
                    'organization' => $a->organization?->name,
                    'status' => $a->status->value,
                    'baseline' => $plan['baseline']?->toIso8601String(),
                    'dueAt' => $plan['dueAt']?->toIso8601String(),
                    'months' => $plan['months'],
                    'state' => match (true) {
                        $record !== null => 'destroyed',
                        $a->retention_flagged_at !== null => 'flagged',
                        $expired => 'expired',
                        default => 'active',
                    },
                    'flaggedAt' => $a->retention_flagged_at?->toIso8601String(),
                    'canDestroy' => $record === null && RetentionRules::destructionAllowed($a->status, $plan['dueAt'], $now),
                    'record' => $record ? [
                        'id' => $record->id,
                        'executedAt' => $record->executed_at->toIso8601String(),
                        'objectCount' => $record->object_count,
                        'objectsPurged' => $record->objects_purged_at !== null,
                    ] : null,
                ];
            })->values()->all();
    }

    /**
     * Tugas mingguan: tandai asesmen yang melewati masa simpan dan belum ditandai atau dimusnahkan.
     *
     * @return list<array{id: string, name: string, organization: ?string, dueAt: string}>
     */
    public function flagExpired(): array
    {
        $flagged = [];
        $ids = DB::table('score_runs')->where('is_final', true)->pluck('assessment_id');
        Assessment::whereIn('id', $ids)->whereNull('retention_flagged_at')->where('status', '!=', AssessmentStatus::Purged->value)
            ->with('organization:id,name')->get()->each(function (Assessment $a) use (&$flagged) {
                $plan = self::schedule($a);
                if (! RetentionRules::expired($plan['dueAt'], now())) {
                    return;
                }
                $a->forceFill(['retention_flagged_at' => now()])->save();
                Audit::record('retention.flag', $a, ['after' => ['dueAt' => $plan['dueAt']?->toIso8601String(), 'months' => $plan['months']]]);
                $flagged[] = ['id' => $a->id, 'name' => $a->name, 'organization' => $a->organization?->name, 'dueAt' => (string) $plan['dueAt']?->toIso8601String()];
            });

        return $flagged;
    }

    /**
     * Pemusnahan data mentah satu asesmen oleh pengelola sistem setelah konfirmasi tertulis klien. Baris dihapus dalam
     * satu transaksi bersama pembuatan berita acara dan perpindahan status ke PURGED; berkas di penyimpanan objek
     * dihapus sesudahnya.
     *
     * @param  array{ref: string, confirmedBy: string, confirmedOn: string, witness: string, notes: ?string}  $input
     */
    public function execute(Assessment $assessment, User $user, array $input): DestructionRecord
    {
        abort_unless($user->is_super_admin, 403);
        [$record, $keys] = DB::transaction(function () use ($assessment, $user, $input) {
            $locked = Assessment::whereKey($assessment->id)->lockForUpdate()->firstOrFail();
            if (DestructionRecord::where('assessment_id', $locked->id)->exists()) {
                throw RuleViolation::locked('ALREADY_DESTROYED');
            }
            $plan = self::schedule($locked);
            if (! RetentionRules::destructionAllowed($locked->status, $plan['dueAt'], now())) {
                throw RuleViolation::locked($locked->status === AssessmentStatus::Archived ? 'RETENTION_ACTIVE' : 'ARCHIVE_FIRST');
            }
            [$counts, $keys] = $this->purgeRows($locked);
            $record = DestructionRecord::create([
                'assessment_id' => $locked->id,
                'executed_at' => now(),
                'executed_by' => $user->id,
                'client_confirmation_ref' => $input['ref'],
                'client_confirmed_by' => $input['confirmedBy'],
                'client_confirmed_on' => $input['confirmedOn'],
                'witness_name' => $input['witness'],
                'notes' => $input['notes'],
                'details' => [
                    'counts' => $counts,
                    'baseline' => $plan['baseline']?->toIso8601String(),
                    'dueAt' => $plan['dueAt']?->toIso8601String(),
                    'months' => $plan['months'],
                    'locale' => app()->getLocale() === 'en' ? 'en' : 'id',
                ],
                'object_count' => count($keys),
            ]);
            Audit::record('retention.destroy', $record, ['after' => [
                'counts' => $counts,
                'clientConfirmationRef' => $input['ref'],
                'clientConfirmedOn' => $input['confirmedOn'],
            ]], $locked, Role::SuperAdmin);
            $this->setup->transition($locked, AssessmentStatus::Purged, [Role::SuperAdmin]);

            return [$record, $keys];
        });

        foreach ($keys as $key) {
            $this->store->delete($key);
        }
        $record->forceFill(['objects_purged_at' => now()])->save();
        try {
            $this->storeMinutes($record);
        } catch (\Throwable) {
            // Berita acara dibuat ulang saat diunduh bila pembuat PDF belum tersedia.
        }

        return $record->refresh();
    }

    /** PDF berita acara: berkas tersimpan, atau dibuat dan disimpan sekali. */
    public function minutesResponse(DestructionRecord $record): Response
    {
        $record->loadMissing('assessment');
        $name = sprintf('%s %s.pdf', __('retention.doc.file', [], $this->locale($record)), $record->assessment->name);
        if ($record->storage_key === null) {
            if (! $this->pdf->available()) {
                throw RuleViolation::locked('MINUTES_PDF_UNAVAILABLE');
            }
            $this->storeMinutes($record);
        }

        return $this->store->download((string) $record->storage_key, $name, 'application/pdf', false);
    }

    public function minutesHtml(DestructionRecord $record): string
    {
        $record->loadMissing(['assessment.organization', 'executor']);
        $loc = $this->locale($record);

        return view('retention.minutes', [
            'r' => $record,
            'loc' => $loc,
            'categories' => self::CATEGORIES,
            'logo' => 'data:image/png;base64,'.base64_encode((string) file_get_contents(public_path('brand/nscas-logo-480.png'))),
        ])->render();
    }

    private function storeMinutes(DestructionRecord $record): void
    {
        if ($record->storage_key !== null || ! $this->pdf->available()) {
            return;
        }
        $record->loadMissing('assessment');
        $bytes = $this->pdf->render($this->minutesHtml($record));
        $key = $this->store->key($record->assessment->organization_id, $record->assessment_id, 'destruction', 'pdf');
        $this->store->disk()->put($key, $bytes);
        $record->forceFill(['storage_key' => $key, 'pdf_sha256' => hash('sha256', $bytes)])->save();
    }

    private function locale(DestructionRecord $record): string
    {
        return ($record->details['locale'] ?? 'id') === 'en' ? 'en' : 'id';
    }

    /**
     * Menghapus baris data mentah sesuai urutan kunci asing dan mengumpulkan kunci objek berkasnya.
     *
     * @return array{0: array<string, int>, 1: list<string>}
     */
    private function purgeRows(Assessment $assessment): array
    {
        $id = $assessment->id;
        $responses = DB::table('survey_responses')->where('assessment_id', $id)->select('id');
        $selfAssessments = DB::table('self_assessments')->where('assessment_id', $id)->select('id');
        $evidence = DB::table('evidence_items')->where('assessment_id', $id)->select('id');
        $windows = DB::table('observation_windows')->where('assessment_id', $id)->select('id');
        $sessions = DB::table('validation_sessions')->where('assessment_id', $id)->select('id');
        $captures = DB::table('observation_captures')->whereIn('observation_window_id', $windows);

        $keys = array_values(array_unique(array_merge(
            DB::table('evidence_items')->where('assessment_id', $id)->pluck('storage_key')->all(),
            (clone $captures)->pluck('storage_key')->all(),
            DB::table('pending_uploads')->where('assessment_id', $id)->pluck('storage_key')->all(),
        )));
        $counts = [
            'characteristicAnswers' => DB::table('characteristic_answers')->whereIn('survey_response_id', $responses)->count(),
            'climateAnswers' => DB::table('climate_answers')->whereIn('survey_response_id', $responses)->count(),
            'selfAssessmentAnswers' => DB::table('self_assessment_answers')->whereIn('self_assessment_id', $selfAssessments)->count(),
            'evidenceLinks' => DB::table('evidence_links')->whereIn('evidence_item_id', $evidence)->count(),
            'actionOwnerEmails' => DB::table('action_items')->whereIn('gap_item_id', DB::table('gap_items')->where('assessment_id', $id)->select('id'))
                ->whereNotNull('owner_email')->update(['owner_email' => null]),
        ];
        // Jawaban ikut terhapus lewat kunci asing ON DELETE CASCADE.
        $counts['surveyResponses'] = DB::table('survey_responses')->where('assessment_id', $id)->delete();
        $counts['selfAssessments'] = DB::table('self_assessments')->where('assessment_id', $id)->delete();
        $counts['accessTokens'] = DB::table('access_tokens')->where('assessment_id', $id)->delete();
        $counts['rosterEntries'] = DB::table('roster_entries')->where('assessment_id', $id)->delete();
        DB::table('evidence_items')->where('assessment_id', $id)->whereNotNull('supersedes_id')->update(['supersedes_id' => null]);
        $counts['evidenceItems'] = DB::table('evidence_items')->where('assessment_id', $id)->delete();
        $counts['observationCaptures'] = $captures->delete();
        $counts['validationParticipants'] = DB::table('validation_participants')->whereIn('validation_session_id', $sessions)->delete();
        $counts['pendingUploads'] = DB::table('pending_uploads')->where('assessment_id', $id)->delete();
        $counts['storageObjects'] = count($keys);

        $ordered = [];
        foreach (self::CATEGORIES as $category) {
            $ordered[$category] = (int) ($counts[$category] ?? 0);
        }

        return [$ordered, $keys];
    }
}
