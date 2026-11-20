<?php

namespace App\Services\Validation;

use App\Domain\Access\Role;
use App\Domain\Evidence\EvidenceRules;
use App\Domain\Validation\FieldCoding;
use App\Domain\Validation\SessionProposal;
use App\Domain\Validation\Triangulation;
use App\Domain\Validation\ValidationRules;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\Characteristic;
use App\Models\EvidenceReview;
use App\Models\FeedbackNote;
use App\Models\SiteVisitCheck;
use App\Models\Stratum;
use App\Models\User;
use App\Models\ValidationGuide;
use App\Models\ValidationParticipant;
use App\Models\ValidationRating;
use App\Models\ValidationSession;
use App\Services\Findings\FindingsService;
use App\Support\Audit;
use App\Support\RuleViolation;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Validasi lapangan (docs/01 M7, docs/12 tahap 3), dibawa dari v1 src/lib/validation/service.ts: panduan per lapisan
 * jabatan, usulan sesi dari kalkulator sampel dengan karakteristik fokus dari temuan awal (temuan T1), penjadwalan,
 * narasumber yang disimpan terpisah dari catatan (docs/13 V16), nilai asesor 1,0 sampai 5,0 kelipatan 0,5, tinjauan
 * bukti per karakteristik, dan catatan umpan balik harian (docs/13 V17).
 */
class ValidationService
{
    public const LAYERS = ['MANAGEMENT', 'SUPERVISORY', 'FIELD'];

    public function __construct(private readonly FindingsService $findings) {}

    // -----------------------------------------------------------------------------------------------------------------
    // Panduan
    // -----------------------------------------------------------------------------------------------------------------

    /** @return list<array{layer: string, intro: string, questions: list<array{code: string, question: string}>}> */
    public function guides(Assessment $assessment): array
    {
        $this->ensureGuides($assessment);

        return ValidationGuide::where('assessment_id', $assessment->id)->get()->sortBy(fn (ValidationGuide $g) => array_search($g->layer, self::LAYERS, true))
            ->map(fn (ValidationGuide $g) => ['layer' => $g->layer, 'intro' => $g->intro, 'questions' => $g->questions])->values()->all();
    }

    /** @param list<array{code: string, question: string}> $questions */
    public function updateGuide(Assessment $assessment, User $user, Role $actorRole, string $layer, string $intro, array $questions): void
    {
        DB::transaction(function () use ($assessment, $user, $actorRole, $layer, $intro, $questions) {
            $locked = $this->lock($assessment, fn (AssessmentStatus $s) => ValidationRules::planningOpen($s), 'VALIDATION_CLOSED');
            $this->ensureGuides($locked);
            $guide = ValidationGuide::where('assessment_id', $locked->id)->where('layer', $layer)->firstOrFail();
            $codes = array_column($guide->questions, 'code');
            if (array_diff(array_column($questions, 'code'), $codes) !== []) {
                throw RuleViolation::invalid('questions', 'UNKNOWN_ITEM');
            }
            $before = ['intro' => $guide->intro, 'questions' => $guide->questions];
            $guide->forceFill(['intro' => $intro, 'questions' => $questions, 'updated_by' => $user->id])->save();
            Audit::record('validation.guide_update', $guide, ['before' => $before, 'after' => ['intro' => $intro, 'questions' => $questions]], $locked, $actorRole);
        });
    }

    private function ensureGuides(Assessment $assessment): void
    {
        $existing = ValidationGuide::where('assessment_id', $assessment->id)->pluck('layer')->all();
        $missing = array_diff(self::LAYERS, $existing);
        if ($missing === []) {
            return;
        }
        $bank = json_decode((string) file_get_contents(base_path('seed/panduan-validasi-v1.json')), true);
        $codes = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->orderBy('position')->pluck('code')->all();
        foreach ($missing as $layer) {
            ValidationGuide::firstOrCreate(['assessment_id' => $assessment->id, 'layer' => $layer], [
                'intro' => trim(($bank['layers'][$layer] ?? '')."\n\n".($bank['opening'] ?? '')),
                // Lapisan pekerja memakai pertanyaan diskusi kelompok terarah berbahasa sehari-hari (bahan versi 2).
                'questions' => array_map(fn (string $code) => ['code' => $code, 'question' => (string) ($layer === 'FIELD'
                    ? (FieldGuide::content()['focusGroup']['characteristics'][$code]['question'] ?? $bank['questions'][$code] ?? '')
                    : ($bank['questions'][$code] ?? ''))], $codes),
            ]);
        }
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Usulan dan sesi
    // -----------------------------------------------------------------------------------------------------------------

    /**
     * Usulan sesi dari rencana sampel terkunci dan karakteristik fokus dari temuan awal. Null bila rencana sampel belum
     * tersimpan.
     *
     * @return array<string, mixed>|null
     */
    public function proposal(Assessment $assessment): ?array
    {
        $plan = $assessment->parameter_snapshot['samplePlan']['result'] ?? $assessment->parameter_draft['samplePlan']['result'] ?? null;
        if ($plan === null) {
            return null;
        }
        $max = (int) ($assessment->parameter_snapshot['parameters']['sampling']['fgdMaxParticipantsPerSession']
            ?? $assessment->parameter_draft['sampling']['fgdMaxParticipantsPerSession'] ?? ValidationRules::MAX_FOCUS_GROUP_PARTICIPANTS);
        $strata = Stratum::where('assessment_id', $assessment->id)->orderBy('code')->get(['id', 'code', 'group', 'population']);
        $proposal = SessionProposal::propose(
            (int) ($plan['sclMinimumInterviewManagement'] ?? 0),
            (int) ($plan['sclMinimumInterviewOperational'] ?? 0),
            (int) ($plan['projectsToVisit'] ?? 0),
            $strata->map(fn (Stratum $s) => ['id' => $s->id, 'code' => $s->code, 'group' => $s->group->value, 'population' => (int) $s->population])->all(),
            min($max, ValidationRules::MAX_FOCUS_GROUP_PARTICIPANTS),
        );

        return [...$proposal, 'focus' => $this->findings->build($assessment)['focus']];
    }

    public function createFromProposal(Assessment $assessment, Role $actorRole): int
    {
        $proposal = $this->proposal($assessment);
        if ($proposal === null) {
            throw RuleViolation::locked('SAMPLE_PLAN_MISSING');
        }

        return DB::transaction(function () use ($assessment, $actorRole, $proposal) {
            $locked = $this->lock($assessment, fn (AssessmentStatus $s) => ValidationRules::planningOpen($s), 'VALIDATION_CLOSED');
            if (ValidationSession::where('assessment_id', $locked->id)->exists()) {
                throw RuleViolation::locked('SESSIONS_EXIST');
            }
            $focus = array_column($proposal['focus'], 'characteristicId');
            foreach ($proposal['sessions'] as $s) {
                ValidationSession::create([
                    'assessment_id' => $locked->id,
                    'type' => $s['type'],
                    'label' => trim(preg_replace('/\s+/', ' ', __('setup.sessionLabels.'.$s['type'], ['stratum' => $s['stratumCode'] ?? '', 'n' => $s['sequence']], 'id'))),
                    'layer' => $s['layer'],
                    'stratum_id' => $s['stratumId'],
                    'participant_count' => $s['participantCount'] ?: null,
                    // Kunjungan mengamati karakteristik fokus juga, tetapi tanpa panduan wawancara.
                    'focus_characteristic_ids' => $focus,
                ]);
            }
            Audit::record('validation.sessions_proposed', $locked, ['after' => [
                'sessions' => count($proposal['sessions']),
                'interviews' => $proposal['interviews'],
                'focusGroupParticipants' => $proposal['focusGroupParticipants'],
                'siteVisits' => $proposal['siteVisits'],
                'virtualVisits' => $proposal['virtualVisits'],
                'focus' => array_column($proposal['focus'], 'code'),
            ]], $locked, $actorRole);

            return count($proposal['sessions']);
        });
    }

    /**
     * @param  array{type: string, label: string, layer: string, unitId: ?string, stratumId: ?string, scheduledAt: ?CarbonInterface, meetingUrl: ?string, location: ?string, participantCount: ?int, focus: list<string>}  $input
     */
    public function createSession(Assessment $assessment, Role $actorRole, array $input): ValidationSession
    {
        return DB::transaction(function () use ($assessment, $actorRole, $input) {
            $locked = $this->lock($assessment, fn (AssessmentStatus $s) => ValidationRules::planningOpen($s), 'VALIDATION_CLOSED');
            $this->assertRefs($locked, $input);
            $this->assertGroupSize($input['type'], $input['participantCount']);
            $session = ValidationSession::create([
                'assessment_id' => $locked->id,
                'type' => $input['type'],
                ...$this->fields($input),
            ]);
            Audit::record('validation.session_create', $session, ['after' => $this->auditFields($session)], $locked, $actorRole);

            return $session;
        });
    }

    /**
     * Mengubah jadwal, fokus, dan status sesi. Jadwal dan fokus selama perencanaan terbuka; status juga selama validasi.
     *
     * @param  array{label: string, layer: string, unitId: ?string, stratumId: ?string, scheduledAt: ?CarbonInterface, meetingUrl: ?string, location: ?string, participantCount: ?int, focus: list<string>, status: string}  $input
     */
    public function updateSession(Assessment $assessment, Role $actorRole, string $sessionId, array $input): void
    {
        DB::transaction(function () use ($assessment, $actorRole, $sessionId, $input) {
            $locked = $this->lock($assessment, fn (AssessmentStatus $s) => ValidationRules::planningOpen($s) || ValidationRules::ratingOpen($s), 'VALIDATION_CLOSED');
            $session = ValidationSession::where('assessment_id', $locked->id)->lockForUpdate()->find($sessionId);
            if ($session === null) {
                throw new RuleViolation(404, 'NOT_FOUND');
            }
            $this->assertRefs($locked, $input);
            $this->assertGroupSize($session->type, $input['participantCount']);
            $before = $this->auditFields($session);
            $session->forceFill([...$this->fields($input), 'status' => $input['status']])->save();
            Audit::record('validation.session_update', $session, ['before' => $before, 'after' => $this->auditFields($session)], $locked, $actorRole);
        });
    }

    /** @return array<string, mixed> */
    private function fields(array $input): array
    {
        return [
            'label' => $input['label'],
            'layer' => $input['layer'],
            'unit_id' => $input['unitId'],
            'stratum_id' => $input['stratumId'],
            'scheduled_at' => $input['scheduledAt']?->utc(),
            'meeting_url' => $input['meetingUrl'],
            'location' => $input['location'],
            'participant_count' => $input['participantCount'],
            'focus_characteristic_ids' => array_values(array_unique($input['focus'])),
        ];
    }

    /** @return array<string, mixed> */
    private function auditFields(ValidationSession $s): array
    {
        return [
            'type' => $s->type, 'label' => $s->label, 'layer' => $s->layer, 'status' => $s->status,
            'scheduledAt' => $s->scheduled_at?->toIso8601String(), 'meetingUrl' => $s->meeting_url, 'location' => $s->location,
            'participantCount' => $s->participant_count, 'focus' => $s->focus_characteristic_ids,
        ];
    }

    private function assertRefs(Assessment $assessment, array $input): void
    {
        if ($input['unitId'] !== null && ! $assessment->units()->whereKey($input['unitId'])->exists()) {
            throw RuleViolation::invalid('unitId', 'NOT_FOUND');
        }
        if ($input['stratumId'] !== null && ! $assessment->strata()->whereKey($input['stratumId'])->exists()) {
            throw RuleViolation::invalid('stratumId', 'NOT_FOUND');
        }
        $valid = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->whereIn('id', $input['focus'])->count();
        if ($valid !== count(array_unique($input['focus']))) {
            throw RuleViolation::invalid('focus', 'UNKNOWN_ITEM');
        }
    }

    /** Diskusi kelompok terarah paling banyak delapan peserta (docs/12 tahap 3). */
    private function assertGroupSize(string $type, ?int $count): void
    {
        if ($type === SessionProposal::FOCUS_GROUP && $count !== null && $count > ValidationRules::MAX_FOCUS_GROUP_PARTICIPANTS) {
            throw RuleViolation::invalid('participantCount', 'FOCUS_GROUP_FULL');
        }
    }

    /** @return list<array<string, mixed>> */
    public function sessions(Assessment $assessment): array
    {
        return ValidationSession::where('assessment_id', $assessment->id)
            ->with(['unit:id,name', 'stratum:id,code,name'])->withCount(['participants', 'ratings'])
            ->orderByRaw('scheduled_at is null')->orderBy('scheduled_at')->orderBy('type')->orderBy('label')
            ->get()->map(fn (ValidationSession $s) => [
                'id' => $s->id,
                'type' => $s->type,
                'label' => $s->label,
                'layer' => $s->layer,
                'status' => $s->status,
                'scheduledAt' => $s->scheduled_at?->toIso8601String(),
                'meetingUrl' => $s->meeting_url,
                'location' => $s->location,
                'participantCount' => $s->participant_count,
                'unit' => $s->unit?->name,
                'stratum' => $s->stratum?->code,
                'focusCount' => count($s->focus_characteristic_ids),
                'participants' => $s->participants_count,
                'ratings' => $s->ratings_count,
            ])->all();
    }

    /** Rincian satu sesi dengan nilai milik asesor yang sedang masuk. @return array<string, mixed>|null */
    public function session(Assessment $assessment, string $sessionId, User $assessor): ?array
    {
        $s = ValidationSession::where('assessment_id', $assessment->id)->with(['unit:id,name', 'stratum:id,code,name'])->find($sessionId);
        if ($s === null) {
            return null;
        }
        $this->ensureGuides($assessment);
        $guide = ValidationGuide::where('assessment_id', $assessment->id)->where('layer', $s->layer)->first();
        $mine = ValidationRating::where('validation_session_id', $s->id)->where('assessor_id', $assessor->id)->get()->keyBy('characteristic_id');
        $raters = ValidationRating::where('validation_session_id', $s->id)->distinct()->count('assessor_id');

        return [
            'id' => $s->id,
            'type' => $s->type,
            'label' => $s->label,
            'layer' => $s->layer,
            'status' => $s->status,
            'unitId' => $s->unit_id,
            'stratumId' => $s->stratum_id,
            'unit' => $s->unit?->name,
            'stratum' => $s->stratum?->code,
            'scheduledAt' => $s->scheduled_at?->toIso8601String(),
            'meetingUrl' => $s->meeting_url,
            'location' => $s->location,
            'participantCount' => $s->participant_count,
            'focus' => $s->focus_characteristic_ids,
            'recordingConsent' => $s->recording_consent,
            'notes' => $s->notes,
            'raters' => $raters,
            'participants' => ValidationParticipant::where('validation_session_id', $s->id)->orderBy('created_at')->get(['id', 'full_name', 'position'])
                ->map(fn ($p) => ['id' => $p->id, 'name' => $p->full_name, 'position' => $p->position])->all(),
            'guide' => $guide ? ['intro' => $guide->intro, 'questions' => $guide->questions] : null,
            'ratings' => $mine->map(fn (ValidationRating $r) => ['level' => $r->level, 'note' => $r->note, 'evidence' => $r->evidence_code, 'agreement' => $r->agreement])->all(),
            'fieldGuide' => FieldGuide::forType($s->type),
            'siteChecks' => SiteVisitCheck::where('validation_session_id', $s->id)->get()
                ->mapWithKeys(fn (SiteVisitCheck $c) => [$c->item_code => ['result' => $c->result, 'note' => $c->note]])->all(),
        ];
    }

    public function addParticipant(Assessment $assessment, Role $actorRole, string $sessionId, string $name, string $position): void
    {
        DB::transaction(function () use ($assessment, $actorRole, $sessionId, $name, $position) {
            $locked = $this->lock($assessment, fn (AssessmentStatus $s) => ValidationRules::planningOpen($s) || ValidationRules::ratingOpen($s), 'VALIDATION_CLOSED');
            $session = ValidationSession::where('assessment_id', $locked->id)->find($sessionId);
            if ($session === null) {
                throw new RuleViolation(404, 'NOT_FOUND');
            }
            if ($session->type === SessionProposal::FOCUS_GROUP && $session->participants()->count() >= ValidationRules::MAX_FOCUS_GROUP_PARTICIPANTS) {
                throw RuleViolation::invalid('name', 'FOCUS_GROUP_FULL');
            }
            $p = $session->participants()->create(['full_name' => $name, 'position' => $position]);
            Audit::record('validation.participant_add', $p, ['after' => ['sessionId' => $session->id, 'name' => $name, 'position' => $position]], $locked, $actorRole);
        });
    }

    public function removeParticipant(Assessment $assessment, Role $actorRole, string $participantId): void
    {
        DB::transaction(function () use ($assessment, $actorRole, $participantId) {
            $locked = $this->lock($assessment, fn (AssessmentStatus $s) => ValidationRules::planningOpen($s) || ValidationRules::ratingOpen($s), 'VALIDATION_CLOSED');
            $p = ValidationParticipant::whereIn('validation_session_id', ValidationSession::where('assessment_id', $locked->id)->select('id'))->find($participantId);
            if ($p === null) {
                throw new RuleViolation(404, 'NOT_FOUND');
            }
            $p->delete();
            Audit::record('validation.participant_remove', $p, ['before' => ['sessionId' => $p->validation_session_id, 'name' => $p->full_name, 'position' => $p->position]], $locked, $actorRole);
        });
    }

    /**
     * Formulir asesor per sesi: catatan sesi, persetujuan perekaman, dan nilai milik asesor ini. Nilai kosong menghapus
     * nilai karakteristik itu.
     *
     * @param  list<array{characteristicId: string, level: float|null, note: string|null}>  $ratings
     */
    public function saveAssessorForm(Assessment $assessment, User $assessor, Role $actorRole, string $sessionId, bool $recordingConsent, ?string $notes, array $ratings): void
    {
        foreach ($ratings as $r) {
            if ($r['level'] !== null && ! ValidationRules::isValidRating($r['level'])) {
                throw RuleViolation::invalid('ratings', 'INVALID_RATING');
            }
            if ((($r['evidence'] ?? null) !== null && ! in_array($r['evidence'], FieldCoding::EVIDENCE, true))
                || (($r['agreement'] ?? null) !== null && ! in_array($r['agreement'], FieldCoding::AGREEMENT, true))) {
                throw RuleViolation::invalid('ratings', 'INVALID_CODE');
            }
        }
        DB::transaction(function () use ($assessment, $assessor, $actorRole, $sessionId, $recordingConsent, $notes, $ratings) {
            $locked = $this->lock($assessment, fn (AssessmentStatus $s) => ValidationRules::ratingOpen($s), 'RATINGS_CLOSED');
            $session = ValidationSession::where('assessment_id', $locked->id)->lockForUpdate()->find($sessionId);
            if ($session === null) {
                throw new RuleViolation(404, 'NOT_FOUND');
            }
            $ids = array_values(array_unique(array_column($ratings, 'characteristicId')));
            $codes = Characteristic::where('instrument_version_id', $locked->instrument_version_id)->whereIn('id', $ids)->pluck('code', 'id');
            if ($codes->count() !== count($ids)) {
                throw RuleViolation::invalid('ratings', 'UNKNOWN_ITEM');
            }
            if ($session->notes !== $notes || $session->recording_consent !== $recordingConsent) {
                $before = ['notes' => $session->notes, 'recordingConsent' => $session->recording_consent];
                $session->forceFill(['notes' => $notes, 'recording_consent' => $recordingConsent])->save();
                Audit::record('validation.session_notes', $session, ['before' => $before, 'after' => ['notes' => $notes, 'recordingConsent' => $recordingConsent]], $locked, $actorRole);
            }
            $before = ValidationRating::where('validation_session_id', $session->id)->where('assessor_id', $assessor->id)->get()
                ->map(fn (ValidationRating $r) => ['characteristic' => $codes[$r->characteristic_id] ?? $r->characteristic_id, 'level' => $r->level, 'note' => $r->note,
                    'evidence' => $r->evidence_code, 'agreement' => $r->agreement])->values()->all();
            foreach ($ratings as $r) {
                $match = ['validation_session_id' => $session->id, 'characteristic_id' => $r['characteristicId'], 'assessor_id' => $assessor->id];
                if ($r['level'] === null) {
                    ValidationRating::where($match)->delete();
                } else {
                    ValidationRating::updateOrCreate($match, [
                        'level' => $r['level'], 'note' => $r['note'], 'evidence_code' => $r['evidence'] ?? null,
                        // Kesepakatan kelompok hanya bermakna pada diskusi kelompok terarah.
                        'agreement' => $session->type === SessionProposal::FOCUS_GROUP ? ($r['agreement'] ?? null) : null,
                    ]);
                }
            }
            Audit::record('validation.rating_save', $session, [
                'before' => $before,
                'after' => array_values(array_map(fn (array $r) => ['characteristic' => $codes[$r['characteristicId']], 'level' => $r['level'], 'note' => $r['note'],
                    'evidence' => $r['evidence'] ?? null, 'agreement' => $r['agreement'] ?? null], array_filter($ratings, fn (array $r) => $r['level'] !== null))),
            ], $locked, $actorRole);
        });
    }

    /**
     * Lembar kerja kunjungan proyek (bahan versi 2): hasil per butir untuk satu sesi kunjungan. Hasil kosong menghapus
     * butir itu dari lembar.
     *
     * @param  list<array{itemCode: string, result: ?string, note: ?string}>  $checks
     */
    public function saveSiteChecks(Assessment $assessment, User $user, Role $actorRole, string $sessionId, array $checks): void
    {
        $items = FieldGuide::siteItems();
        foreach ($checks as $c) {
            if (! array_key_exists($c['itemCode'], $items) || ($c['result'] !== null && ! in_array($c['result'], FieldCoding::SITE_RESULTS, true))) {
                throw RuleViolation::invalid('checks', 'INVALID_CODE');
            }
        }
        DB::transaction(function () use ($assessment, $user, $actorRole, $sessionId, $checks, $items) {
            $locked = $this->lock($assessment, fn (AssessmentStatus $s) => ValidationRules::ratingOpen($s), 'RATINGS_CLOSED');
            $session = ValidationSession::where('assessment_id', $locked->id)->lockForUpdate()->find($sessionId);
            if ($session === null) {
                throw new RuleViolation(404, 'NOT_FOUND');
            }
            if (! in_array($session->type, [SessionProposal::SITE_VISIT, SessionProposal::VIRTUAL_SITE_VISIT], true)) {
                throw RuleViolation::invalid('checks', 'NOT_SITE_VISIT');
            }
            $characteristics = Characteristic::where('instrument_version_id', $locked->instrument_version_id)->pluck('id', 'code');
            $changed = [];
            foreach ($checks as $c) {
                $match = ['validation_session_id' => $session->id, 'item_code' => $c['itemCode']];
                if ($c['result'] === null) {
                    if (SiteVisitCheck::where($match)->delete() > 0) {
                        $changed[] = ['item' => $c['itemCode'], 'result' => null];
                    }

                    continue;
                }
                $characteristicId = $characteristics[$items[$c['itemCode']]] ?? null;
                if ($characteristicId === null) {
                    throw RuleViolation::invalid('checks', 'UNKNOWN_ITEM');
                }
                $row = SiteVisitCheck::firstOrNew($match);
                if ($row->exists && $row->result === $c['result'] && $row->note === $c['note']) {
                    continue;
                }
                $row->fill(['characteristic_id' => $characteristicId, 'result' => $c['result'], 'note' => $c['note'], 'checked_by' => $user->id])->save();
                $changed[] = ['item' => $c['itemCode'], 'result' => $c['result'], 'note' => $c['note']];
            }
            if ($changed !== []) {
                Audit::record('validation.site_check', $session, ['after' => $changed], $locked, $actorRole);
            }
        });
    }

    /**
     * Ringkasan triangulasi per karakteristik (App\Domain\Validation\Triangulation). Bukan nilai: rumus penilaian
     * tidak berubah.
     *
     * @return array<string, array<string, mixed>>
     */
    public function triangulation(Assessment $assessment): array
    {
        $codes = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->orderBy('position')->pluck('code', 'id');
        $sessions = ValidationSession::where('assessment_id', $assessment->id)->where('status', '!=', 'CANCELLED')->get(['id', 'type', 'layer', 'unit_id'])->keyBy('id');
        $ratings = ValidationRating::whereIn('validation_session_id', $sessions->keys())->get()
            ->map(fn (ValidationRating $r) => [
                'code' => (string) ($codes[$r->characteristic_id] ?? ''),
                'type' => (string) $sessions[$r->validation_session_id]->type,
                'layer' => (string) $sessions[$r->validation_session_id]->layer,
                'level' => (float) $r->level,
                'evidence' => $r->evidence_code,
                'agreement' => $r->agreement,
            ])->values()->all();
        $checks = SiteVisitCheck::whereIn('validation_session_id', $sessions->keys())->get()
            ->map(fn (SiteVisitCheck $c) => [
                'code' => (string) ($codes[$c->characteristic_id] ?? ''),
                'result' => $c->result,
                'unitId' => $sessions[$c->validation_session_id]->unit_id,
            ])->values()->all();

        return Triangulation::summarize($codes->values()->all(), $ratings, $checks);
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Tinjauan bukti dan umpan balik harian
    // -----------------------------------------------------------------------------------------------------------------

    /** Tinjauan bukti dicatat sejak bukti dapat diunggah sampai penilaian. */
    public static function evidenceReviewOpen(AssessmentStatus $status): bool
    {
        return EvidenceRules::uploadOpen($status) && $status !== AssessmentStatus::PanelReview;
    }

    public function reviewEvidence(Assessment $assessment, User $user, Role $actorRole, string $characteristicId, bool $reviewed, ?string $note): void
    {
        DB::transaction(function () use ($assessment, $user, $actorRole, $characteristicId, $reviewed, $note) {
            $locked = $this->lock($assessment, fn (AssessmentStatus $s) => self::evidenceReviewOpen($s), 'REVIEW_CLOSED');
            $c = Characteristic::where('instrument_version_id', $locked->instrument_version_id)->find($characteristicId);
            if ($c === null) {
                throw RuleViolation::invalid('characteristicId', 'UNKNOWN_ITEM');
            }
            $existing = EvidenceReview::where('assessment_id', $locked->id)->where('characteristic_id', $c->id)->first();
            if ($reviewed) {
                $row = $existing ?? new EvidenceReview(['assessment_id' => $locked->id, 'characteristic_id' => $c->id]);
                $row->forceFill(['note' => $note, 'reviewed_by' => $user->id, 'reviewed_at' => now()])->save();
                Audit::record('evidence.review', $row, ['after' => ['characteristic' => $c->code, 'note' => $note]], $locked, $actorRole);
            } elseif ($existing !== null) {
                $existing->delete();
                Audit::record('evidence.review_withdraw', $existing, ['before' => ['characteristic' => $c->code, 'note' => $existing->note]], $locked, $actorRole);
            }
        });
    }

    /** @return array<string, array{note: ?string, by: ?string, at: string}> */
    public function evidenceReviews(Assessment $assessment): array
    {
        return EvidenceReview::where('assessment_id', $assessment->id)->with('reviewer:id,name')->get()
            ->mapWithKeys(fn (EvidenceReview $r) => [$r->characteristic_id => ['note' => $r->note, 'by' => $r->reviewer?->name, 'at' => $r->reviewed_at->toIso8601String()]])->all();
    }

    /** Catatan umpan balik dicatat selama pengumpulan data dan validasi, satu per hari. */
    public function saveFeedback(Assessment $assessment, User $user, Role $actorRole, string $date, string $summary): void
    {
        DB::transaction(function () use ($assessment, $user, $actorRole, $date, $summary) {
            $locked = $this->lock($assessment, fn (AssessmentStatus $s) => $s === AssessmentStatus::DataCollection || $s === AssessmentStatus::Validation, 'VALIDATION_CLOSED');
            $note = FeedbackNote::firstOrNew(['assessment_id' => $locked->id, 'note_date' => $date]);
            $before = $note->exists ? $note->summary : null;
            $note->forceFill(['summary' => $summary, 'author_id' => $user->id])->save();
            Audit::record('validation.feedback', $note, ['before' => $before, 'after' => ['date' => $date, 'summary' => $summary]], $locked, $actorRole);
        });
    }

    /** @return list<array{date: string, summary: string, author: ?string}> */
    public function feedback(Assessment $assessment): array
    {
        return FeedbackNote::where('assessment_id', $assessment->id)->with('author:id,name')->orderByDesc('note_date')->get()
            ->map(fn (FeedbackNote $n) => ['date' => $n->note_date->toDateString(), 'summary' => $n->summary, 'author' => $n->author?->name])->all();
    }

    /** @param callable(AssessmentStatus): bool $allowed */
    private function lock(Assessment $assessment, callable $allowed, string $code): Assessment
    {
        $locked = Assessment::whereKey($assessment->id)->lockForUpdate()->firstOrFail();
        if (! $allowed($locked->status)) {
            throw RuleViolation::locked($code);
        }

        return $locked;
    }
}
