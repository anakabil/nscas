<?php

namespace App\Http\Controllers\Validation;

use App\Domain\Access\Role;
use App\Domain\Validation\FieldCoding;
use App\Domain\Validation\SessionProposal;
use App\Domain\Validation\ValidationRules;
use App\Models\Assessment;
use App\Models\Characteristic;
use App\Models\Stratum;
use App\Models\Unit;
use App\Services\Validation\ValidationExport;
use App\Services\Validation\ValidationService;
use App\Support\Audit;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * Validasi lapangan (docs/01 M7, docs/12 tahap 3): usulan sesi dari rencana sampel, jadwal wawancara, diskusi
 * kelompok terarah, dan kunjungan proyek, panduan pertanyaan, narasumber, nilai asesor, serta catatan umpan balik
 * harian. Asesor utama menyusun usulan dan panduan; seluruh tim asesor menjadwalkan, mencatat, dan menilai.
 */
class ValidationController extends ValidationStageController
{
    public const TYPES = [SessionProposal::INTERVIEW, SessionProposal::FOCUS_GROUP, SessionProposal::SITE_VISIT, SessionProposal::VIRTUAL_SITE_VISIT];

    public const STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED'];

    public function index(Request $request, Assessment $assessment, ValidationService $validation): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'validation');
        $sessions = $validation->sessions($assessment);
        $planningOpen = ValidationRules::planningOpen($assessment->status);

        return Inertia::render('validation/index', [
            ...$this->collectionCommon($assessment, $roles),
            'canPlan' => $planningOpen,
            'canLead' => $planningOpen && $this->isLead($roles),
            'canFeedback' => in_array($assessment->status->value, ['DATA_COLLECTION', 'VALIDATION'], true),
            // Ekspor data validasi lapangan untuk analisis (bahan versi 2): hanya asesor.
            'canExport' => $sessions !== [] && (in_array(Role::LeadAssessor, $roles, true) || in_array(Role::Assessor, $roles, true)),
            'sessions' => $sessions,
            // Usulan hanya dihitung selama belum ada sesi; setelah itu sesi diatur langsung.
            'proposal' => $sessions === [] && $planningOpen ? $validation->proposal($assessment) : null,
            'guides' => $validation->guides($assessment),
            'feedback' => $validation->feedback($assessment),
            ...$this->references($assessment),
        ]);
    }

    public function propose(Request $request, Assessment $assessment, ValidationService $validation): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'validation');
        abort_unless($this->isLead($roles), 403);
        $validation->createFromProposal($assessment, $this->assessorRole($roles));

        return back()->with('status', 'sessionsCreated');
    }

    public function store(Request $request, Assessment $assessment, ValidationService $validation): RedirectResponse
    {
        $actor = $this->assessorRole($this->pageRoles($request, $assessment, 'validation'));
        $data = $request->validate([...$this->sessionRules(), 'type' => ['required', Rule::in(self::TYPES)]]);
        $session = $validation->createSession($assessment, $actor, ['type' => $data['type'], ...$this->sessionInput($data)]);

        return to_route('validation.sessions.show', [$assessment, $session->id])->with('status', 'saved');
    }

    public function show(Request $request, Assessment $assessment, string $session, ValidationService $validation): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'validation');
        $detail = $validation->session($assessment, $session, $request->user());
        abort_if($detail === null, 404);

        return Inertia::render('validation/session', [
            ...$this->collectionCommon($assessment, $roles),
            'session' => $detail,
            'canPlan' => ValidationRules::planningOpen($assessment->status) || ValidationRules::ratingOpen($assessment->status),
            'canRate' => ValidationRules::ratingOpen($assessment->status),
            'ratingLevels' => ValidationRules::RATING_LEVELS,
            'maxFocusGroup' => ValidationRules::MAX_FOCUS_GROUP_PARTICIPANTS,
            ...$this->references($assessment),
        ]);
    }

    public function update(Request $request, Assessment $assessment, string $session, ValidationService $validation): RedirectResponse
    {
        $actor = $this->assessorRole($this->pageRoles($request, $assessment, 'validation'));
        $data = $request->validate([...$this->sessionRules(), 'status' => ['required', Rule::in(self::STATUSES)]]);
        $validation->updateSession($assessment, $actor, $session, [...$this->sessionInput($data), 'status' => $data['status']]);

        return back()->with('status', 'saved');
    }

    public function form(Request $request, Assessment $assessment, string $session, ValidationService $validation): RedirectResponse
    {
        $actor = $this->assessorRole($this->pageRoles($request, $assessment, 'validation'));
        $data = $request->validate([
            'recordingConsent' => ['required', 'boolean'],
            'notes' => ['nullable', 'string', 'max:'.ValidationRules::NOTE_MAX],
            'ratings' => ['present', 'array', 'max:200'],
            'ratings.*.characteristicId' => ['required', 'string', 'max:26', 'distinct'],
            'ratings.*.level' => ['nullable', 'numeric', 'between:1,5'],
            'ratings.*.note' => ['nullable', 'string', 'max:2000'],
            'ratings.*.evidence' => ['nullable', Rule::in(FieldCoding::EVIDENCE)],
            'ratings.*.agreement' => ['nullable', Rule::in(FieldCoding::AGREEMENT)],
        ]);
        $notes = trim((string) ($data['notes'] ?? ''));
        $validation->saveAssessorForm($assessment, $request->user(), $actor, $session, (bool) $data['recordingConsent'], $notes === '' ? null : $notes,
            array_map(fn (array $r) => [
                'characteristicId' => $r['characteristicId'],
                'level' => $r['level'] === null ? null : (float) $r['level'],
                'note' => ($n = trim((string) ($r['note'] ?? ''))) === '' ? null : $n,
                'evidence' => $r['evidence'] ?? null,
                'agreement' => $r['agreement'] ?? null,
            ], $data['ratings']));

        return back()->with('status', 'saved');
    }

    /** Lembar kerja kunjungan proyek (bahan validasi versi 2). */
    public function siteChecks(Request $request, Assessment $assessment, string $session, ValidationService $validation): RedirectResponse
    {
        $actor = $this->assessorRole($this->pageRoles($request, $assessment, 'validation'));
        $data = $request->validate([
            'checks' => ['present', 'array', 'max:100'],
            'checks.*.itemCode' => ['required', 'string', 'max:12', 'distinct'],
            'checks.*.result' => ['nullable', Rule::in(FieldCoding::SITE_RESULTS)],
            'checks.*.note' => ['nullable', 'string', 'max:2000'],
        ]);
        $validation->saveSiteChecks($assessment, $request->user(), $actor, $session, array_map(fn (array $c) => [
            'itemCode' => $c['itemCode'],
            'result' => $c['result'] ?? null,
            'note' => ($n = trim((string) ($c['note'] ?? ''))) === '' ? null : $n,
        ], $data['checks']));

        return back()->with('status', 'saved');
    }

    /** Data validasi lapangan ke Excel untuk analisis lanjut; hanya asesor. */
    public function export(Request $request, Assessment $assessment, ValidationService $validation): BinaryFileResponse
    {
        $actor = $this->assessorRole($this->pageRoles($request, $assessment, 'validation'));
        $locale = app()->getLocale();
        $path = ValidationExport::build($assessment, $validation->triangulation($assessment), $locale);
        Audit::record('validation.export', $assessment, ['after' => ['format' => 'xlsx']], $assessment, $actor);
        $name = preg_replace('/[^\pL\pN ._-]+/u', '', __('fieldwork.fileName', ['name' => $assessment->name], $locale));

        return response()->download($path, $name, ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])->deleteFileAfterSend();
    }

    /** Panduan sesi siap cetak untuk dipakai di lapangan tanpa sambungan. */
    public function print(Request $request, Assessment $assessment, string $session, ValidationService $validation): HttpResponse
    {
        $this->assessorRole($this->pageRoles($request, $assessment, 'validation'));
        $detail = $validation->session($assessment, $session, $request->user());
        abort_if($detail === null || $detail['fieldGuide'] === null, 404);
        $characteristics = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->orderBy('position')->get(['id', 'code', 'name_id', 'name_en']);
        $focus = $detail['focus'] === [] ? $characteristics : $characteristics->whereIn('id', $detail['focus'])->values();

        return response()->view('validation.guide', [
            'loc' => app()->getLocale() === 'en' ? 'en' : 'id',
            's' => $detail,
            'characteristics' => $focus,
            'questions' => collect($detail['guide']['questions'] ?? [])->pluck('question', 'code'),
        ])->header('Cache-Control', 'private, no-store')
            ->header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    }

    public function addParticipant(Request $request, Assessment $assessment, string $session, ValidationService $validation): RedirectResponse
    {
        $actor = $this->assessorRole($this->pageRoles($request, $assessment, 'validation'));
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:200'],
            'position' => ['required', 'string', 'min:2', 'max:200'],
        ]);
        $validation->addParticipant($assessment, $actor, $session, trim($data['name']), trim($data['position']));

        return back()->with('status', 'saved');
    }

    public function removeParticipant(Request $request, Assessment $assessment, string $participant, ValidationService $validation): RedirectResponse
    {
        $actor = $this->assessorRole($this->pageRoles($request, $assessment, 'validation'));
        $validation->removeParticipant($assessment, $actor, $participant);

        return back()->with('status', 'saved');
    }

    public function guide(Request $request, Assessment $assessment, string $layer, ValidationService $validation): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'validation');
        abort_unless($this->isLead($roles), 403);
        abort_unless(in_array($layer, ValidationService::LAYERS, true), 404);
        $data = $request->validate([
            'intro' => ['required', 'string', 'min:10', 'max:4000'],
            'questions' => ['required', 'array', 'max:100'],
            'questions.*.code' => ['required', 'string', 'max:16', 'distinct'],
            'questions.*.question' => ['required', 'string', 'min:5', 'max:1000'],
        ]);
        $validation->updateGuide($assessment, $request->user(), $this->assessorRole($roles), $layer, trim($data['intro']),
            array_map(fn (array $q) => ['code' => $q['code'], 'question' => trim($q['question'])], $data['questions']));

        return back()->with('status', 'saved');
    }

    public function feedback(Request $request, Assessment $assessment, ValidationService $validation): RedirectResponse
    {
        $actor = $this->assessorRole($this->pageRoles($request, $assessment, 'validation'));
        $data = $request->validate([
            'date' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.now('Asia/Jakarta')->toDateString()],
            'summary' => ['required', 'string', 'min:10', 'max:4000'],
        ]);
        $validation->saveFeedback($assessment, $request->user(), $actor, $data['date'], trim($data['summary']));

        return back()->with('status', 'saved');
    }

    /** @return array<string, list<mixed>> */
    private function sessionRules(): array
    {
        return [
            'label' => ['required', 'string', 'min:2', 'max:200'],
            'layer' => ['required', Rule::in(ValidationService::LAYERS)],
            'unitId' => ['nullable', 'string', 'max:26'],
            'stratumId' => ['nullable', 'string', 'max:26'],
            'scheduledAt' => ['nullable', 'date_format:Y-m-d\TH:i'],
            'meetingUrl' => ['nullable', 'string', 'url:https', 'max:500'],
            'location' => ['nullable', 'string', 'max:300'],
            'participantCount' => ['nullable', 'integer', 'min:1', 'max:500'],
            'focus' => ['present', 'array', 'max:100'],
            'focus.*' => ['string', 'max:26'],
        ];
    }

    /** @return array<string, mixed> */
    private function sessionInput(array $data): array
    {
        $blank = fn ($v) => ($v = trim((string) $v)) === '' ? null : $v;

        return [
            'label' => trim($data['label']),
            'layer' => $data['layer'],
            'unitId' => $data['unitId'] ?? null,
            'stratumId' => $data['stratumId'] ?? null,
            'scheduledAt' => isset($data['scheduledAt']) ? CarbonImmutable::createFromFormat('Y-m-d\TH:i', $data['scheduledAt'], 'Asia/Jakarta') : null,
            'meetingUrl' => $blank($data['meetingUrl'] ?? null),
            'location' => $blank($data['location'] ?? null),
            'participantCount' => isset($data['participantCount']) ? (int) $data['participantCount'] : null,
            'focus' => array_values($data['focus']),
        ];
    }

    /** @return array<string, list<array<string, mixed>>> */
    private function references(Assessment $assessment): array
    {
        return [
            'characteristics' => Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->orderBy('position')
                ->get(['id', 'code', 'name_id', 'name_en', 'is_contextual'])
                ->map(fn (Characteristic $c) => ['id' => $c->id, 'code' => $c->code, 'name' => $c->name_id, 'nameEn' => $c->name_en])->all(),
            'units' => Unit::where('assessment_id', $assessment->id)->orderBy('name')->get(['id', 'name'])
                ->map(fn (Unit $u) => ['id' => $u->id, 'name' => $u->name])->all(),
            'strata' => Stratum::where('assessment_id', $assessment->id)->orderBy('code')->get(['id', 'code', 'name'])
                ->map(fn (Stratum $s) => ['id' => $s->id, 'code' => $s->code, 'name' => $s->name])->all(),
        ];
    }
}
