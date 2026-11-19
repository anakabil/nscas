<?php

namespace App\Http\Controllers\Respondents;

use App\Domain\Access\Permissions;
use App\Domain\Access\Resource;
use App\Domain\Access\Role;
use App\Domain\Respondents\RosterValidator;
use App\Domain\Setup\UnitTree;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\RosterEntry;
use App\Models\Unit;
use App\Models\UnitAssignment;
use App\Models\User;
use App\Services\Respondents\RespondentDistribution;
use App\Services\Respondents\RespondentScope;
use App\Services\Respondents\RosterReader;
use App\Services\Respondents\RosterTemplate;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Daftar responden, masa survei, distribusi token, dan penugasan koordinator unit (docs/01 M2). Koordinator unit
 * hanya melihat dan mengimpor unitnya; distribusi token hanya oleh administrator klien (matriks docs/04). Status
 * penyelesaian per orang tidak pernah ditampilkan.
 */
class RespondentController extends CollectionController
{
    private const PAGE_SIZE = 50;

    public function index(Request $request, Assessment $assessment): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'respondents');
        $scope = RespondentScope::units($request->user(), $assessment, $roles);
        $open = $this->distribution($assessment) === 'open';
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'unit' => ['nullable', 'string', 'max:26'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $units = Unit::where('assessment_id', $assessment->id)->get(['id', 'parent_id', 'name']);
        $tree = UnitTree::flatten($units->map(fn (Unit $u) => ['id' => $u->id, 'parentId' => $u->parent_id, 'name' => $u->name])->all());
        $visibleUnits = array_values(array_filter($tree, fn (array $u) => $scope === null || in_array($u['id'], $scope, true)));

        $base = RosterEntry::where('assessment_id', $assessment->id)->when($scope !== null, fn (Builder $q) => $q->whereIn('unit_id', $scope));
        $tokenBase = AccessToken::where('assessment_id', $assessment->id)->where('kind', 'SURVEY')->whereNull('revoked_at')
            ->when($scope !== null, fn (Builder $q) => $q->whereIn('unit_id', $scope));

        $canAssign = in_array(Role::ClientAdmin, $roles, true) && ! $assessment->status->isClosed();

        return Inertia::render('respondents/index', [
            ...$this->collectionCommon($assessment, $roles),
            'can' => [
                'import' => $open && Permissions::canWrite($roles, Resource::Roster),
                'distribute' => $open && Permissions::canWrite($roles, Resource::TokensAndParticipation),
                'window' => $open && $this->windowWriter($roles) !== null,
                'assign' => $canAssign,
            ],
            'scoped' => $scope !== null,
            'summary' => [
                'registered' => (clone $base)->count(),
                'withEmail' => (clone $base)->whereNotNull('email')->count(),
                'tokens' => (clone $tokenBase)->whereNotNull('roster_entry_id')->count(),
            ],
            'units' => array_map(fn (array $u) => ['id' => $u['id'], 'name' => $u['name'], 'depth' => $u['depth']], $visibleUnits),
            'strata' => $assessment->strata()->orderBy('code')->get(['id', 'code', 'name'])->map(fn ($s) => ['id' => $s->id, 'code' => $s->code, 'name' => $s->name])->all(),
            'filters' => ['search' => $filters['search'] ?? '', 'unit' => $filters['unit'] ?? ''],
            'roster' => $this->rosterPage($base, $filters),
            'coordinators' => $this->coordinators($assessment, $roles, $canAssign),
            // Hasil aksi terakhir, hanya untuk satu kali tampil.
            'preview' => $request->session()->get('rosterPreview'),
            'issuedLinks' => $request->session()->get('issuedLinks'),
            'notice' => $request->session()->get('respondentNotice'),
        ]);
    }

    public function template(Request $request, Assessment $assessment): BinaryFileResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'respondents');
        $this->writerFor($roles, Resource::Roster);
        $scope = RespondentScope::units($request->user(), $assessment, $roles);
        $units = Unit::where('assessment_id', $assessment->id)->when($scope !== null, fn ($q) => $q->whereIn('id', $scope))->orderBy('name')->pluck('name')->all();
        $strata = $assessment->strata()->orderBy('code')->get(['code', 'name'])->map(fn ($s) => ['code' => $s->code, 'name' => $s->name])->all();
        $path = RosterTemplate::build($units, $strata, [
            'optionsSheet' => __('respondents.template.optionsSheet'),
            'instructionsSheet' => __('respondents.template.instructionsSheet'),
            'title' => __('respondents.template.title'),
            'lines' => array_values(__('respondents.template.lines')),
            'yes' => __('respondents.template.yes'),
            'no' => __('respondents.template.no'),
        ]);

        return response()->download($path, __('respondents.template.fileName').'.xlsx')->deleteFileAfterSend();
    }

    public function import(Request $request, Assessment $assessment, RespondentDistribution $service): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'respondents');
        $actor = $this->writerFor($roles, Resource::Roster);
        $data = $request->validate([
            'file' => ['required', 'file', 'max:'.(RosterReader::MAX_BYTES / 1024)],
            'commit' => ['required', 'boolean'],
        ]);
        $scope = RespondentScope::units($request->user(), $assessment, $roles);
        $result = $service->import($assessment, $data['file']->getRealPath(), $scope, (bool) $data['commit'], $actor);

        return back()->with('rosterPreview', [
            ...$result,
            'commit' => (bool) $data['commit'],
            'fileName' => $data['file']->getClientOriginalName(),
            'maxRows' => RosterValidator::MAX_ROWS,
        ]);
    }

    public function links(Request $request, Assessment $assessment, RespondentDistribution $service): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'respondents');
        $actor = $this->writerFor($roles, Resource::TokensAndParticipation);
        $data = $request->validate(['unit_id' => ['nullable', 'string', 'max:26'], 'only_without_email' => ['required', 'boolean']]);
        $scope = RespondentScope::units($request->user(), $assessment, $roles);
        $links = $service->issueLinks($assessment, $data['unit_id'] ?? null, (bool) $data['only_without_email'], $scope, $actor);

        return back()->with($links === [] ? 'respondentNotice' : 'issuedLinks', $links === [] ? ['key' => 'linksNone'] : $links);
    }

    public function invitations(Request $request, Assessment $assessment, RespondentDistribution $service): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'respondents');
        $actor = $this->writerFor($roles, Resource::TokensAndParticipation);
        $data = $request->validate(['unit_id' => ['nullable', 'string', 'max:26']]);
        $scope = RespondentScope::units($request->user(), $assessment, $roles);
        $count = $service->queueInvitations($assessment, $data['unit_id'] ?? null, $scope, $actor);

        return back()->with('respondentNotice', $count === 0 ? ['key' => 'invitationsNone'] : ['key' => 'invitationsQueued', 'count' => $count]);
    }

    public function revoke(Request $request, Assessment $assessment, string $entry, RespondentDistribution $service): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'respondents');
        $actor = $this->writerFor($roles, Resource::TokensAndParticipation);
        $service->revoke($assessment, $entry, RespondentScope::units($request->user(), $assessment, $roles), $actor);

        return back()->with('respondentNotice', ['key' => 'revoked']);
    }

    public function reissue(Request $request, Assessment $assessment, string $entry, RespondentDistribution $service): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'respondents');
        $actor = $this->writerFor($roles, Resource::TokensAndParticipation);
        $data = $request->validate(['channel' => ['required', Rule::in(['LINK', 'EMAIL'])]]);
        $link = $service->reissue($assessment, $entry, $data['channel'], RespondentScope::units($request->user(), $assessment, $roles), $actor);

        return $link === null
            ? back()->with('respondentNotice', ['key' => 'reissueQueued'])
            : back()->with('issuedLinks', [$link]);
    }

    /** Waktu diisi sebagai WIB (UTC+7) dari isian tanggal dan jam. */
    public function window(Request $request, Assessment $assessment, RespondentDistribution $service): RedirectResponse
    {
        $actor = $this->windowWriter($this->pageRoles($request, $assessment, 'respondents'));
        abort_if($actor === null, 403);
        $data = $request->validate([
            'opens_at' => ['required', 'date_format:Y-m-d\TH:i'],
            'closes_at' => ['required', 'date_format:Y-m-d\TH:i'],
        ]);
        $service->setWindow(
            $assessment,
            CarbonImmutable::createFromFormat('Y-m-d\TH:i', $data['opens_at'], 'Asia/Jakarta'),
            CarbonImmutable::createFromFormat('Y-m-d\TH:i', $data['closes_at'], 'Asia/Jakarta'),
            $actor,
        );

        return back()->with('status', 'saved');
    }

    public function closeSurvey(Request $request, Assessment $assessment, RespondentDistribution $service): RedirectResponse
    {
        $actor = $this->windowWriter($this->pageRoles($request, $assessment, 'respondents'));
        abort_if($actor === null, 403);
        $service->closeSurvey($assessment, $actor);

        return back()->with('status', 'saved');
    }

    public function assign(Request $request, Assessment $assessment, RespondentDistribution $service): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'respondents');
        abort_unless(in_array(Role::ClientAdmin, $roles, true), 403);
        $data = $request->validate(['user_id' => ['required', 'integer'], 'unit_id' => ['required', 'string', 'max:26']]);
        $service->assignCoordinator($assessment, (int) $data['user_id'], $data['unit_id'], Role::ClientAdmin);

        return back()->with('status', 'saved');
    }

    public function unassign(Request $request, Assessment $assessment, int $assignment, RespondentDistribution $service): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'respondents');
        abort_unless(in_array(Role::ClientAdmin, $roles, true), 403);
        $service->removeCoordinator($assessment, $assignment, Role::ClientAdmin);

        return back()->with('status', 'saved');
    }

    /**
     * @param  Builder<RosterEntry>  $base
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function rosterPage(Builder $base, array $filters): array
    {
        $search = trim((string) ($filters['search'] ?? ''));
        $query = (clone $base)
            ->when(($filters['unit'] ?? '') !== '', fn (Builder $q) => $q->where('unit_id', $filters['unit']))
            ->when($search !== '', fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('full_name', 'ilike', '%'.addcslashes($search, '%_\\').'%')
                ->orWhere('employee_no', 'ilike', '%'.addcslashes($search, '%_\\').'%')));
        $total = (clone $query)->count();
        $pages = max(1, (int) ceil($total / self::PAGE_SIZE));
        $page = min((int) ($filters['page'] ?? 1), $pages);
        $rows = $query->orderBy('full_name')->orderBy('id')
            ->skip(($page - 1) * self::PAGE_SIZE)->take(self::PAGE_SIZE)
            ->with(['unit:id,name', 'stratum:id,code', 'tokens' => fn ($q) => $q->where('kind', 'SURVEY')->orderByDesc('issued_at')->select(['id', 'roster_entry_id', 'revoked_at', 'issued_at'])])
            ->get();

        return [
            'total' => $total,
            'page' => $page,
            'pages' => $pages,
            'rows' => $rows->map(fn (RosterEntry $e) => [
                'id' => $e->id,
                'fullName' => $e->full_name,
                'employeeNo' => $e->employee_no,
                'email' => $e->email,
                'phone' => $e->phone,
                'isContractor' => $e->is_contractor,
                'unit' => $e->unit->name,
                'stratum' => $e->stratum->code,
                // Status selesai sengaja tidak ditampilkan per orang; partisipasi hanya disajikan agregat.
                'tokenState' => $e->tokens->isEmpty() ? 'NONE' : ($e->tokens->first()->revoked_at === null ? 'ISSUED' : 'REVOKED'),
            ])->all(),
        ];
    }

    /**
     * Penugasan koordinator unit beserta calon (anggota organisasi klien berperan koordinator unit).
     *
     * @param  list<Role>  $roles
     * @return array<string, mixed>|null
     */
    private function coordinators(Assessment $assessment, array $roles, bool $canAssign): ?array
    {
        if (! in_array(Role::ClientAdmin, $roles, true) && ! in_array(Role::LeadAssessor, $roles, true)) {
            return null;
        }
        $assignments = UnitAssignment::where('assessment_id', $assessment->id)->with(['user:id,name,email', 'unit:id,name'])->get()
            ->sortBy(fn (UnitAssignment $a) => [$a->unit->name, $a->user->name])->values();

        return [
            'assignments' => $assignments->map(fn (UnitAssignment $a) => [
                'id' => $a->id, 'unit' => $a->unit->name, 'name' => $a->user->name, 'email' => $a->user->email,
            ])->all(),
            'candidates' => $canAssign ? User::where('is_active', true)
                ->whereHas('memberships', fn ($q) => $q->where('organization_id', $assessment->organization_id)->where('role', Role::UnitCoordinator))
                ->orderBy('name')->get(['id', 'name', 'email'])
                ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email])->all() : [],
        ];
    }
}
