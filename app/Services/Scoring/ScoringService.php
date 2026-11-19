<?php

namespace App\Services\Scoring;

use App\Domain\Access\Role;
use App\Domain\Panel\PanelRules;
use App\Domain\Scoring\CharacteristicDefinition;
use App\Domain\Scoring\EngineInput;
use App\Domain\Scoring\EngineParameters;
use App\Domain\Scoring\EvidenceRatingInput;
use App\Domain\Scoring\RawAssessmentInput;
use App\Domain\Scoring\ScoringEngine;
use App\Domain\Scoring\SelfAssessmentInput;
use App\Domain\Scoring\SelfAssessmentStatus;
use App\Domain\Scoring\StratumGroup;
use App\Domain\Scoring\StratumInput;
use App\Domain\Scoring\SurveyResponseInput;
use App\Domain\Scoring\ValidationRatingInput;
use App\Domain\Validation\ValidationRules;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\AuditLog;
use App\Models\Characteristic;
use App\Models\EvidenceItem;
use App\Models\EvidenceRating;
use App\Models\EvidenceReview;
use App\Models\ObservationCapture;
use App\Models\PanelDecision;
use App\Models\SclFulfillment;
use App\Models\ScoreRun;
use App\Models\User;
use App\Models\ValidationRating;
use App\Models\ValidationSession;
use App\Services\Findings\SurveyDataLoader;
use App\Support\Audit;
use App\Support\RuleViolation;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Penilaian asesor dan rapat panel (docs/01 M8), dibawa dari v1 src/lib/assessor-scoring/service.ts. Nilai bukti
 * diisi tiap asesor tanpa melihat nilai rekan sebelum menyimpan; jalur setara diisi asesor utama; mesin dijalankan
 * dari data basis data dan parameter terkunci (CLAUDE.md aturan 5), lalu disimpan sebagai eksekusi yang tidak dapat
 * diubah. Rapat panel memutuskan setiap karakteristik bertanda dan menetapkan hasil.
 */
class ScoringService
{
    // -----------------------------------------------------------------------------------------------------------------
    // Data masukan mesin
    // -----------------------------------------------------------------------------------------------------------------

    /** @return list<Characteristic> */
    private function characteristics(Assessment $assessment): array
    {
        return Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->orderBy('position')
            ->get(['id', 'code', 'name_id', 'name_en', 'aspect_code', 'is_contextual'])->all();
    }

    private function params(Assessment $assessment): EngineParameters
    {
        $parameters = $assessment->parameter_snapshot['parameters'] ?? null;
        if (! is_array($parameters)) {
            throw RuleViolation::locked('SNAPSHOT_MISSING');
        }

        return EngineParameters::fromSnapshot($parameters);
    }

    /** Kode aspek yang masuk jalur setara: aspek bertingkat, bukan kontekstual. Kosong sebelum parameter dikunci. @return list<string> */
    public function sclAspectCodes(Assessment $assessment): array
    {
        if (! is_array($assessment->parameter_snapshot['parameters'] ?? null)) {
            return [];
        }

        return array_values(array_map(fn ($a) => $a->code, array_filter($this->params($assessment)->aspects, fn ($a) => ! $a->excludedFromLevel && $a->maxPointsStep5 !== null)));
    }

    /** Data mentah satu asesmen untuk mesin, dengan strata dan sasaran dari snapshot terkunci. */
    public function raw(Assessment $assessment): RawAssessmentInput
    {
        $snapshot = $assessment->parameter_snapshot ?? [];
        $characteristics = $this->characteristics($assessment);
        $codeOf = [];
        foreach ($characteristics as $c) {
            $codeOf[$c->id] = $c->code;
        }
        $stratumCode = [];
        $strata = [];
        foreach ($snapshot['strata'] ?? [] as $s) {
            $stratumCode[$s['id']] = $s['code'];
            $strata[] = new StratumInput($s['code'], StratumGroup::from($s['group']), (int) $s['population']);
        }
        $byCode = fn (array $levels) => array_combine(
            array_map(fn ($id) => $codeOf[$id], array_keys(array_filter($levels, fn ($_, $id) => isset($codeOf[$id]), ARRAY_FILTER_USE_BOTH))),
            array_values(array_filter($levels, fn ($_, $id) => isset($codeOf[$id]), ARRAY_FILTER_USE_BOTH)),
        );
        $responses = [];
        foreach (SurveyDataLoader::responses($assessment) as $r) {
            if (isset($stratumCode[$r['stratumId']])) {
                $responses[] = new SurveyResponseInput($stratumCode[$r['stratumId']], $byCode($r['levels']));
            }
        }
        $selfAnswers = [];
        foreach (DB::table('self_assessment_answers')->join('self_assessments', 'self_assessments.id', '=', 'self_assessment_answers.self_assessment_id')
            ->where('self_assessments.assessment_id', $assessment->id)->where('self_assessments.status', 'SUBMITTED')
            ->get(['self_assessments.id as sa', 'self_assessment_answers.characteristic_id as c', 'self_assessment_answers.level']) as $a) {
            $selfAnswers[$a->sa][$a->c] = $a->level === null ? null : (int) $a->level;
        }

        return new RawAssessmentInput(
            characteristics: array_map(fn (Characteristic $c) => new CharacteristicDefinition($c->code, $c->aspect_code, (bool) $c->is_contextual), $characteristics),
            strata: $strata,
            surveyResponses: $responses,
            selfAssessments: array_values(array_map(fn (array $answers) => new SelfAssessmentInput(SelfAssessmentStatus::Submitted, $byCode($answers)), $selfAnswers)),
            evidenceRatings: EvidenceRating::where('assessment_id', $assessment->id)->get(['characteristic_id', 'assessor_id', 'level'])
                ->filter(fn ($r) => isset($codeOf[$r->characteristic_id]))
                ->map(fn ($r) => new EvidenceRatingInput($codeOf[$r->characteristic_id], (int) $r->assessor_id, (float) $r->level))->values()->all(),
            validationRatings: ValidationRating::whereIn('validation_session_id', ValidationSession::where('assessment_id', $assessment->id)->where('status', '!=', 'CANCELLED')->select('id'))
                ->get(['validation_session_id', 'characteristic_id', 'assessor_id', 'level'])
                ->filter(fn ($r) => isset($codeOf[$r->characteristic_id]))
                ->map(fn ($r) => new ValidationRatingInput($r->validation_session_id, $codeOf[$r->characteristic_id], (int) $r->assessor_id, (float) $r->level))->values()->all(),
            targetLevel: (float) ($snapshot['targetLevel'] ?? $assessment->target_level),
            sclFulfillment: PanelRules::sclFulfilment(
                SclFulfillment::where('assessment_id', $assessment->id)->get(['aspect_code', 'step', 'percent'])
                    ->map(fn ($r) => ['aspectCode' => $r->aspect_code, 'step' => (int) $r->step, 'percent' => (float) $r->percent])->all(),
                $this->sclAspectCodes($assessment),
            ),
        );
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Nilai bukti
    // -----------------------------------------------------------------------------------------------------------------

    /**
     * Daftar karakteristik untuk halaman penilaian: nilai milik asesor ini, banyak asesor, dan tanda rekonsiliasi
     * (hanya setelah asesor ini menyimpan nilainya sendiri).
     *
     * @return list<array<string, mixed>>
     */
    public function overview(Assessment $assessment, User $viewer): array
    {
        $threshold = is_array($assessment->parameter_snapshot['parameters'] ?? null) ? $this->params($assessment)->assessorDisagreementFlag : 1.0;
        $ratings = EvidenceRating::where('assessment_id', $assessment->id)->get(['characteristic_id', 'assessor_id', 'level'])->groupBy('characteristic_id');
        $linked = DB::table('evidence_links')->join('evidence_items', 'evidence_items.id', '=', 'evidence_links.evidence_item_id')
            ->where('evidence_items.assessment_id', $assessment->id)->whereNull('evidence_items.deleted_at')
            ->selectRaw('evidence_links.characteristic_id, count(*) as n')->groupBy('evidence_links.characteristic_id')->pluck('n', 'characteristic_id');
        $reviewed = EvidenceReview::where('assessment_id', $assessment->id)->pluck('characteristic_id')->flip();

        return array_map(function (Characteristic $c) use ($ratings, $viewer, $threshold, $linked, $reviewed) {
            $own = $ratings->get($c->id, collect());
            $mine = $own->firstWhere('assessor_id', $viewer->id);
            $levels = $own->pluck('level')->map(fn ($l) => (float) $l);

            return [
                'id' => $c->id,
                'code' => $c->code,
                'name' => $c->name_id,
                'nameEn' => $c->name_en,
                'aspectCode' => $c->aspect_code,
                'contextual' => (bool) $c->is_contextual,
                'mine' => $mine === null ? null : (float) $mine->level,
                'assessors' => $own->pluck('assessor_id')->unique()->count(),
                'reconcile' => $mine !== null && $levels->count() > 1 && $levels->max() - $levels->min() > $threshold + 1e-9,
                'evidence' => (int) ($linked[$c->id] ?? 0),
                'reviewed' => $reviewed->has($c->id),
            ];
        }, $this->characteristics($assessment));
    }

    /** Ruang kerja satu karakteristik: bukti, observasi, validasi, persepsi, dan nilai. @return array<string, mixed>|null */
    public function workspace(Assessment $assessment, string $code, User $viewer, array $perception): ?array
    {
        $c = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->where('code', $code)->first();
        if ($c === null) {
            return null;
        }
        $evidence = EvidenceItem::where('assessment_id', $assessment->id)->whereNull('deleted_at')
            ->whereIn('id', DB::table('evidence_links')->where('characteristic_id', $c->id)->select('evidence_item_id'))
            ->whereNotExists(fn ($q) => $q->from('evidence_items as newer')->whereColumn('newer.supersedes_id', 'evidence_items.id'))
            ->with('unit:id,name')->orderByDesc('created_at')->get(['id', 'title', 'file_name', 'mime_type', 'version', 'unit_id', 'created_at']);
        $captures = ObservationCapture::whereIn('observation_window_id', DB::table('observation_windows')->where('assessment_id', $assessment->id)->select('id'))
            ->with('window:id,title')->orderByDesc('server_captured_at')->limit(100)
            ->get(['id', 'observation_window_id', 'checklist_item_code', 'mime_type', 'server_captured_at', 'outside_radius', 'note']);
        $sessions = ValidationSession::where('assessment_id', $assessment->id)->where('status', '!=', 'CANCELLED')
            ->whereHas('ratings', fn ($q) => $q->where('characteristic_id', $c->id))
            ->with(['ratings' => fn ($q) => $q->where('characteristic_id', $c->id)])->orderBy('scheduled_at')->get(['id', 'label', 'type']);
        $ratings = EvidenceRating::where('assessment_id', $assessment->id)->where('characteristic_id', $c->id)->with('assessor:id,name')->get();
        $visible = PanelRules::visibleRatings($ratings->map(fn (EvidenceRating $r) => [
            'assessorId' => $r->assessor_id,
            'assessor' => $r->assessor?->name,
            'level' => (float) $r->level,
            'rationale' => $r->rationale,
            'evidenceIds' => $r->evidence_item_ids,
            'observationIds' => $r->observation_capture_ids,
            'updatedAt' => $r->updated_at->toIso8601String(),
        ])->values()->all(), $viewer->id);
        $review = EvidenceReview::where('assessment_id', $assessment->id)->where('characteristic_id', $c->id)->with('reviewer:id,name')->first();

        return [
            'id' => $c->id,
            'code' => $c->code,
            'name' => $c->name_id,
            'nameEn' => $c->name_en,
            'aspectCode' => $c->aspect_code,
            'contextual' => (bool) $c->is_contextual,
            'perception' => $perception,
            'evidence' => $evidence->map(fn (EvidenceItem $e) => [
                'id' => $e->id, 'title' => $e->title, 'fileName' => $e->file_name, 'mimeType' => $e->mime_type,
                'version' => $e->version, 'unit' => $e->unit?->name, 'createdAt' => $e->created_at->toIso8601String(),
                'url' => route('evidence.download', [$assessment, $e->id]),
            ])->all(),
            'captures' => $captures->map(fn (ObservationCapture $o) => [
                'id' => $o->id, 'window' => $o->window?->title, 'item' => $o->checklist_item_code, 'mimeType' => $o->mime_type,
                'capturedAt' => $o->server_captured_at->toIso8601String(), 'outside' => (bool) $o->outside_radius, 'note' => $o->note,
                'url' => route('observations.captures.file', [$assessment, $o->id]),
            ])->all(),
            'validation' => $sessions->map(fn (ValidationSession $s) => [
                'label' => $s->label, 'type' => $s->type,
                'mean' => $s->ratings->avg(fn ($r) => (float) $r->level), 'raters' => $s->ratings->count(),
            ])->values()->all(),
            'review' => $review ? ['note' => $review->note, 'by' => $review->reviewer?->name, 'at' => $review->reviewed_at->toIso8601String()] : null,
            'own' => $visible['own'],
            'others' => $visible['others'],
            'hidden' => $visible['hidden'],
        ];
    }

    /**
     * @param  list<string>  $evidenceIds
     * @param  list<string>  $observationIds
     */
    public function saveRating(Assessment $assessment, User $assessor, Role $actorRole, string $characteristicId, float $level, string $rationale, array $evidenceIds, array $observationIds): void
    {
        if (! ValidationRules::isValidRating($level)) {
            throw RuleViolation::invalid('level', 'INVALID_RATING');
        }
        DB::transaction(function () use ($assessment, $assessor, $actorRole, $characteristicId, $level, $rationale, $evidenceIds, $observationIds) {
            $locked = $this->lock($assessment, fn (AssessmentStatus $s) => PanelRules::ratingOpen($s), 'RATINGS_CLOSED');
            $c = Characteristic::where('instrument_version_id', $locked->instrument_version_id)->find($characteristicId);
            if ($c === null) {
                throw RuleViolation::invalid('characteristicId', 'UNKNOWN_ITEM');
            }
            $evidenceIds = array_values(array_unique($evidenceIds));
            $observationIds = array_values(array_unique($observationIds));
            if (EvidenceItem::where('assessment_id', $locked->id)->whereIn('id', $evidenceIds)->count() !== count($evidenceIds)) {
                throw RuleViolation::invalid('evidenceIds', 'UNKNOWN_ITEM');
            }
            $known = ObservationCapture::whereIn('observation_window_id', DB::table('observation_windows')->where('assessment_id', $locked->id)->select('id'))
                ->whereIn('id', $observationIds)->count();
            if ($known !== count($observationIds)) {
                throw RuleViolation::invalid('observationIds', 'UNKNOWN_ITEM');
            }
            $row = EvidenceRating::firstOrNew(['assessment_id' => $locked->id, 'characteristic_id' => $c->id, 'assessor_id' => $assessor->id]);
            $before = $row->exists ? ['level' => (float) $row->level, 'rationale' => $row->rationale] : null;
            $row->forceFill(['level' => $level, 'rationale' => $rationale, 'evidence_item_ids' => $evidenceIds, 'observation_capture_ids' => $observationIds])->save();
            Audit::record('score.evidence_rating', $row, ['before' => $before, 'after' => [
                'characteristic' => $c->code, 'level' => $level, 'rationale' => $rationale,
                'evidence' => count($evidenceIds), 'observations' => count($observationIds),
            ]], $locked, $actorRole);
        });
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Jalur setara
    // -----------------------------------------------------------------------------------------------------------------

    /** @return list<array{code: string, name: string, steps: array<int, array{percent: float, justification: string}|null>}> */
    public function scl(Assessment $assessment): array
    {
        $names = collect($assessment->parameter_snapshot['parameters']['aspects'] ?? [])->pluck('name', 'code');
        $rows = SclFulfillment::where('assessment_id', $assessment->id)->get()->groupBy('aspect_code');

        return array_map(fn (string $code) => [
            'code' => $code,
            'name' => (string) ($names[$code] ?? $code),
            'steps' => collect(PanelRules::SCL_STEPS)->mapWithKeys(fn (int $step) => [$step => ($r = ($rows[$code] ?? collect())->firstWhere('step', $step))
                ? ['percent' => (float) $r->percent, 'justification' => $r->justification] : null])->all(),
        ], $this->sclAspectCodes($assessment));
    }

    /** @param list<array{step: int, percent: float, justification: string}> $entries */
    public function saveScl(Assessment $assessment, User $user, Role $actorRole, string $aspectCode, array $entries): void
    {
        DB::transaction(function () use ($assessment, $user, $actorRole, $aspectCode, $entries) {
            $locked = $this->lock($assessment, fn (AssessmentStatus $s) => PanelRules::ratingOpen($s), 'RATINGS_CLOSED');
            if (! in_array($aspectCode, $this->sclAspectCodes($locked), true)) {
                throw RuleViolation::invalid('aspectCode', 'UNKNOWN_ITEM');
            }
            foreach ($entries as $e) {
                SclFulfillment::updateOrCreate(
                    ['assessment_id' => $locked->id, 'aspect_code' => $aspectCode, 'step' => $e['step']],
                    ['percent' => $e['percent'], 'justification' => $e['justification'], 'updated_by' => $user->id],
                );
            }
            Audit::record('score.scl', $locked, ['after' => ['aspect' => $aspectCode, 'entries' => array_map(fn ($e) => ['step' => $e['step'], 'percent' => $e['percent']], $entries)]], $locked, $actorRole);
        });
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Eksekusi mesin
    // -----------------------------------------------------------------------------------------------------------------

    public function run(Assessment $assessment, User $user, Role $actorRole): ScoreRun
    {
        return DB::transaction(function () use ($assessment, $user, $actorRole) {
            $locked = $this->lock($assessment, fn (AssessmentStatus $s) => PanelRules::runOpen($s), 'RUN_CLOSED');
            $params = $this->params($locked);
            $raw = $this->raw($locked);
            $input = new EngineInput(ScoringEngine::buildCharacteristicInputs($raw, $params), $raw->targetLevel, $raw->sclFulfillment);
            $result = ScoringEngine::runEngine($input, $params)->toArray();
            $run = ScoreRun::create([
                'assessment_id' => $locked->id,
                'engine_version' => ScoringEngine::ENGINE_VERSION,
                'input_snapshot' => [
                    ...PanelRules::serializeInput($input),
                    'counts' => [
                        'responses' => count($raw->surveyResponses),
                        'selfAssessments' => count($raw->selfAssessments),
                        'evidenceRatings' => count($raw->evidenceRatings),
                        'validationRatings' => count($raw->validationRatings),
                    ],
                ],
                'parameter_snapshot' => $locked->parameter_snapshot['parameters'],
                'result' => $result,
                'run_by' => $user->id,
            ]);
            Audit::record('score.run', $run, ['after' => [
                'engineVersion' => $result['engineVersion'],
                'organizationIndex' => $result['organization']['index'] ?? null,
                'indicativeLevel' => $result['organization']['indicativeLevel'] ?? null,
                'sclLevel' => $result['sclTrack']['indicativeLevel'] ?? null,
                'responses' => count($raw->surveyResponses),
                'evidenceRatings' => count($raw->evidenceRatings),
            ]], $locked, $actorRole);

            return $run;
        });
    }

    /** @return list<array<string, mixed>> */
    public function runs(Assessment $assessment): array
    {
        return ScoreRun::where('assessment_id', $assessment->id)->with('runner:id,name')->orderByDesc('created_at')->limit(20)
            ->get(['id', 'created_at', 'engine_version', 'is_final', 'result', 'run_by'])
            ->map(fn (ScoreRun $r) => [
                'id' => $r->id,
                'createdAt' => $r->created_at->toIso8601String(),
                'engineVersion' => $r->engine_version,
                'final' => $r->is_final,
                'by' => $r->runner?->name,
                'index' => $r->result['organization']['index'] ?? null,
                'level' => $r->result['organization']['indicativeLevel'] ?? null,
                'consolidated' => $r->result['organization']['consolidated'] ?? null,
            ])->all();
    }

    /**
     * Waktu perubahan terakhir data yang menjadi masukan mesin, untuk memberi tahu bila eksekusi terakhir usang.
     */
    public function lastInputChange(Assessment $assessment): ?CarbonInterface
    {
        $dates = array_filter([
            EvidenceRating::where('assessment_id', $assessment->id)->max('updated_at'),
            ValidationRating::whereIn('validation_session_id', ValidationSession::where('assessment_id', $assessment->id)->select('id'))->max('updated_at'),
            ValidationSession::where('assessment_id', $assessment->id)->max('updated_at'),
            SclFulfillment::where('assessment_id', $assessment->id)->max('updated_at'),
            DB::table('self_assessments')->where('assessment_id', $assessment->id)->where('status', 'SUBMITTED')->max('submitted_at'),
            AuditLog::where('assessment_id', $assessment->id)->whereIn('action', ['survey.exclude', 'survey.restore'])->max('occurred_at'),
        ]);

        return $dates === [] ? null : Carbon::parse(max(array_map(fn ($d) => Carbon::parse($d)->getTimestamp(), $dates)));
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Rapat panel
    // -----------------------------------------------------------------------------------------------------------------

    /** Eksekusi yang dibahas rapat panel: eksekusi final bila ada, selain itu eksekusi terakhir. */
    public function panelRun(Assessment $assessment): ?ScoreRun
    {
        return ScoreRun::where('assessment_id', $assessment->id)->orderByDesc('is_final')->orderByDesc('created_at')->first();
    }

    /** @return array<string, mixed>|null */
    public function panel(Assessment $assessment): ?array
    {
        $run = $this->panelRun($assessment);
        if ($run === null) {
            return null;
        }
        $run->load(['decisions.decider:id,name', 'runner:id,name', 'finalizer:id,name']);
        $decisions = $run->decisions->keyBy('characteristic_code');
        $needed = PanelRules::needsDecision($run->result['characteristics']);
        $adjusted = $run->is_final ? $run->final_result : $this->adjustedResult($run);
        $names = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->get(['code', 'name_id', 'name_en', 'id'])->keyBy('code');
        $aspectNames = collect($run->parameter_snapshot['aspects'] ?? [])->pluck('name', 'code');

        return [
            'id' => $run->id,
            'createdAt' => $run->created_at->toIso8601String(),
            'by' => $run->runner?->name,
            'engineVersion' => $run->engine_version,
            'final' => $run->is_final,
            'finalizedAt' => $run->finalized_at?->toIso8601String(),
            'finalizedBy' => $run->finalizer?->name,
            'counts' => $run->input_snapshot['counts'] ?? [],
            'engine' => $run->result['organization'],
            'adjusted' => $adjusted['organization'],
            'sclTrack' => $adjusted['sclTrack'] ?? null,
            'aspects' => array_map(fn (string $code, array $a) => ['code' => $code, 'name' => $aspectNames[$code] ?? $code, ...$a], array_keys($adjusted['aspects']), array_values($adjusted['aspects'])),
            'needed' => $needed,
            'characteristics' => array_map(function (array $c) use ($decisions, $names, $needed) {
                $d = $decisions->get($c['code']);

                return [
                    ...$c,
                    'id' => $names[$c['code']]->id ?? null,
                    'name' => $names[$c['code']]->name_id ?? $c['code'],
                    'nameEn' => $names[$c['code']]->name_en ?? null,
                    'needsDecision' => in_array($c['code'], $needed, true),
                    'decision' => $d ? [
                        'kind' => $d->kind,
                        'value' => $d->adjusted_value,
                        'rationale' => $d->rationale,
                        'by' => $d->decider?->name,
                        'at' => $d->updated_at->toIso8601String(),
                    ] : null,
                ];
            }, $run->result['characteristics']),
        ];
    }

    /** @return array<string, mixed> Hasil mesin dengan nilai panel, dari masukan tersimpan eksekusi itu. */
    private function adjustedResult(ScoreRun $run): array
    {
        $panel = [];
        foreach ($run->decisions as $d) {
            if ($d->kind === 'ADJUSTED' && $d->adjusted_value !== null) {
                $panel[$d->characteristic_code] = (float) $d->adjusted_value;
            }
        }

        return ScoringEngine::runEngine(PanelRules::restoreInput($run->input_snapshot, $panel), EngineParameters::fromSnapshot($run->parameter_snapshot))->toArray();
    }

    public function decide(Assessment $assessment, User $user, Role $actorRole, string $code, string $kind, ?float $value, string $rationale): void
    {
        if ($kind === 'ADJUSTED' && ($value === null || ! PanelRules::isValidPanelValue($value))) {
            throw RuleViolation::invalid('value', 'INVALID_PANEL_VALUE');
        }
        DB::transaction(function () use ($assessment, $user, $actorRole, $code, $kind, $value, $rationale) {
            $locked = $this->lock($assessment, fn (AssessmentStatus $s) => PanelRules::panelOpen($s), 'PANEL_CLOSED');
            $run = $this->openRun($locked);
            $engine = collect($run->result['characteristics'])->firstWhere('code', $code);
            $c = Characteristic::where('instrument_version_id', $locked->instrument_version_id)->where('code', $code)->first();
            if ($engine === null || $c === null) {
                throw RuleViolation::invalid('code', 'UNKNOWN_ITEM');
            }
            $row = PanelDecision::firstOrNew(['score_run_id' => $run->id, 'characteristic_id' => $c->id]);
            $before = $row->exists ? ['kind' => $row->kind, 'value' => $row->adjusted_value, 'rationale' => $row->rationale] : null;
            $row->forceFill([
                'characteristic_code' => $code,
                'kind' => $kind,
                'engine_value' => $engine['final'],
                'adjusted_value' => $kind === 'ADJUSTED' ? $value : null,
                'rationale' => $rationale,
                'decided_by' => $user->id,
            ])->save();
            Audit::record('panel.decision', $row, ['before' => $before, 'after' => [
                'characteristic' => $code, 'kind' => $kind, 'engineValue' => $engine['final'], 'value' => $kind === 'ADJUSTED' ? $value : null, 'rationale' => $rationale,
            ]], $locked, $actorRole);
        });
    }

    public function withdraw(Assessment $assessment, Role $actorRole, string $code): void
    {
        DB::transaction(function () use ($assessment, $actorRole, $code) {
            $locked = $this->lock($assessment, fn (AssessmentStatus $s) => PanelRules::panelOpen($s), 'PANEL_CLOSED');
            $run = $this->openRun($locked);
            $row = PanelDecision::where('score_run_id', $run->id)->where('characteristic_code', $code)->first();
            if ($row === null) {
                return;
            }
            $row->delete();
            Audit::record('panel.decision_withdraw', $row, ['before' => ['characteristic' => $code, 'kind' => $row->kind, 'value' => $row->adjusted_value, 'rationale' => $row->rationale]], $locked, $actorRole);
        });
    }

    /** Menetapkan hasil: eksekusi terakhir menjadi final dengan nilai panel; setelah itu tidak dapat diubah. */
    public function finalize(Assessment $assessment, User $user, Role $actorRole): void
    {
        DB::transaction(function () use ($assessment, $user, $actorRole) {
            $locked = $this->lock($assessment, fn (AssessmentStatus $s) => PanelRules::panelOpen($s), 'PANEL_CLOSED');
            $run = $this->openRun($locked);
            $run->load('decisions');
            $needed = PanelRules::needsDecision($run->result['characteristics']);
            if (! PanelRules::decisionsComplete($needed, $run->decisions->pluck('rationale', 'characteristic_code')->all())) {
                throw RuleViolation::invalid('form', 'DECISIONS_MISSING');
            }
            $final = $this->adjustedResult($run);
            $run->forceFill(['is_final' => true, 'final_result' => $final, 'finalized_at' => now(), 'finalized_by' => $user->id])->save();
            Audit::record('panel.finalize', $run, ['after' => [
                'organizationIndex' => $final['organization']['index'] ?? null,
                'indicativeLevel' => $final['organization']['indicativeLevel'] ?? null,
                'consolidated' => $final['organization']['consolidated'] ?? null,
                'decisions' => $run->decisions->count(),
            ]], $locked, $actorRole);
        });
    }

    private function openRun(Assessment $assessment): ScoreRun
    {
        $run = ScoreRun::where('assessment_id', $assessment->id)->orderByDesc('created_at')->lockForUpdate()->first();
        if ($run === null) {
            throw RuleViolation::locked('NO_SCORE_RUN');
        }
        if ($run->is_final || ScoreRun::where('assessment_id', $assessment->id)->where('is_final', true)->exists()) {
            throw RuleViolation::locked('RESULTS_FINAL');
        }

        return $run;
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
