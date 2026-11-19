<?php

namespace App\Http\Controllers;

use App\Domain\Access\Role;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use App\Services\OrganizationAdmin;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Organisasi dan pengguna (PROMPTS.md R1 butir 1, matriks docs/04: baca SA, LA, CA; ubah SA dan CA). Pengelola sistem
 * melihat dan mengelola semua organisasi; asesor utama melihat tanpa mengubah; administrator klien hanya organisasinya
 * sendiri. Organisasi lain bagi administrator klien menghasilkan 404 agar keberadaannya tidak terungkap.
 */
class OrganizationController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $this->actor($request);
        $query = Organization::query()->withCount(['assessments'])->orderByDesc('is_operator')->orderBy('name');
        if (! $user->is_super_admin && ! $this->isLeadAssessor($user)) {
            $query->whereIn('id', $this->clientAdminOrganizations($user));
        }
        abort_unless($user->is_super_admin || $this->isLeadAssessor($user) || $this->clientAdminOrganizations($user) !== [], 403);

        $userCounts = Membership::query()->selectRaw('organization_id, count(distinct user_id) as total')
            ->groupBy('organization_id')->pluck('total', 'organization_id');

        return Inertia::render('organizations/index', [
            'organizations' => $query->get()->map(fn (Organization $o) => [
                'id' => $o->id,
                'name' => $o->name,
                'legalName' => $o->legal_name,
                'sector' => $o->sector,
                'isOperator' => $o->is_operator,
                'isActive' => $o->is_active,
                'userCount' => (int) ($userCounts[$o->id] ?? 0),
                'assessmentCount' => (int) $o->assessments_count,
                'href' => route('organizations.show', $o),
            ])->all(),
            'canCreate' => $user->is_super_admin,
        ]);
    }

    public function store(Request $request, OrganizationAdmin $admin): RedirectResponse
    {
        abort_unless($this->actor($request)->is_super_admin, 403);
        $organization = $admin->createOrganization($this->validatedOrganization($request));

        return redirect()->route('organizations.show', $organization)->with('status', 'created');
    }

    public function show(Request $request, Organization $organization): Response
    {
        $user = $this->actor($request);
        $actorRole = $this->managerRole($user, $organization);
        abort_unless($actorRole !== null || $user->is_super_admin || $this->isLeadAssessor($user), 404);

        $members = User::query()
            ->whereHas('memberships', fn ($q) => $q->where('organization_id', $organization->id))
            ->with(['memberships' => fn ($q) => $q->where('organization_id', $organization->id)])
            ->orderBy('name')
            ->get();

        return Inertia::render('organizations/show', [
            'organization' => [
                'id' => $organization->id,
                'name' => $organization->name,
                'legalName' => $organization->legal_name,
                'sector' => $organization->sector,
                'isOperator' => $organization->is_operator,
                'isActive' => $organization->is_active,
            ],
            'users' => $members->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'isActive' => $u->is_active,
                'roles' => $u->memberships->map(fn (Membership $m) => $m->role->value)->sort()->values()->all(),
                'twoFactorEnabled' => $u->two_factor_confirmed_at !== null,
                'mustChangePassword' => $u->must_change_password,
                'isSelf' => $u->is($user),
            ])->all(),
            'canManageUsers' => $actorRole !== null,
            'canEditOrganization' => $user->is_super_admin,
            'roleOptions' => $actorRole === null ? [] : array_values(array_map(
                fn (Role $r) => $r->value,
                array_filter(Role::cases(), fn (Role $r) => $r !== Role::SuperAdmin
                    && $r->isValidFor($organization->is_operator)
                    && ($actorRole === Role::SuperAdmin || $r->isClient())),
            )),
        ]);
    }

    public function update(Request $request, Organization $organization, OrganizationAdmin $admin): RedirectResponse
    {
        abort_unless($this->actor($request)->is_super_admin, 403);
        $data = $this->validatedOrganization($request);
        $data['is_active'] = $request->boolean('is_active', true);
        $admin->updateOrganization($organization, $data);

        return back()->with('status', 'saved');
    }

    public function storeUser(Request $request, Organization $organization, OrganizationAdmin $admin): RedirectResponse
    {
        $actorRole = $this->requireManager($request, $organization);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:200'],
            'email' => ['required', 'email', 'max:255'],
            'roles' => ['array'],
            'roles.*' => [Rule::enum(Role::class)],
        ]);
        $roles = array_map(fn ($r) => Role::from($r), $data['roles'] ?? []);
        $password = $admin->createUser($organization, $data['name'], $data['email'], $roles, $actorRole);

        return back()->with('temporaryPassword', ['email' => strtolower(trim($data['email'])), 'password' => $password, 'created' => true]);
    }

    public function updateUser(Request $request, Organization $organization, User $user, OrganizationAdmin $admin): RedirectResponse
    {
        $actorRole = $this->requireManager($request, $organization);
        $this->requireManagedUser($organization, $user, $actorRole);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:200'],
            'roles' => ['array'],
            'roles.*' => [Rule::enum(Role::class)],
        ]);
        $roles = array_map(fn ($r) => Role::from($r), $data['roles'] ?? []);
        $admin->updateUser($organization, $user, $data['name'], $roles, $request->user(), $actorRole);

        return back()->with('status', 'saved');
    }

    public function setActive(Request $request, Organization $organization, User $user, OrganizationAdmin $admin): RedirectResponse
    {
        $actorRole = $this->requireManager($request, $organization);
        $this->requireManagedUser($organization, $user, $actorRole);
        $active = $request->validate(['active' => ['required', 'boolean']])['active'];
        $admin->setActive($user, (bool) $active, $request->user(), $actorRole);

        return back()->with('status', 'saved');
    }

    public function resetPassword(Request $request, Organization $organization, User $user, OrganizationAdmin $admin): RedirectResponse
    {
        $actorRole = $this->requireManager($request, $organization);
        $this->requireManagedUser($organization, $user, $actorRole);
        $password = $admin->resetPassword($user, $actorRole);

        return back()->with('temporaryPassword', ['email' => $user->email, 'password' => $password, 'created' => false]);
    }

    private function actor(Request $request): User
    {
        return $request->user()->load(['memberships.organization', 'teamAssignments']);
    }

    private function isLeadAssessor(User $user): bool
    {
        return $user->memberships->contains(fn (Membership $m) => $m->role === Role::LeadAssessor && $m->organization->is_operator);
    }

    /** @return list<string> */
    private function clientAdminOrganizations(User $user): array
    {
        return $user->memberships->filter(fn (Membership $m) => $m->role === Role::ClientAdmin)->pluck('organization_id')->values()->all();
    }

    /** Peran pengelola akun di organisasi ini: pengelola sistem, atau administrator klien organisasi itu. */
    private function managerRole(User $user, Organization $organization): ?Role
    {
        if ($user->is_super_admin) {
            return Role::SuperAdmin;
        }
        if (! $organization->is_operator && in_array($organization->id, $this->clientAdminOrganizations($user), true)) {
            return Role::ClientAdmin;
        }

        return null;
    }

    private function requireManager(Request $request, Organization $organization): Role
    {
        $user = $this->actor($request);
        $role = $this->managerRole($user, $organization);
        if ($role === null) {
            // Asesor utama boleh melihat tetapi tidak mengubah; pengguna lain tidak boleh tahu organisasi ini ada.
            abort($user->is_super_admin || $this->isLeadAssessor($user) ? 403 : 404);
        }

        return $role;
    }

    /**
     * Pengguna harus anggota organisasi ini. Administrator klien tidak boleh mengelola pengelola sistem atau staf
     * Nusa Safety yang kebetulan juga tercatat di organisasinya.
     */
    private function requireManagedUser(Organization $organization, User $user, Role $actorRole): void
    {
        $user->loadMissing('memberships');
        abort_unless($user->memberships->contains(fn (Membership $m) => $m->organization_id === $organization->id), 404);
        if ($actorRole === Role::ClientAdmin) {
            abort_if($user->is_super_admin || $user->memberships->contains(fn (Membership $m) => $m->role->isOperator()), 403);
        }
    }

    /** @return array{name: string, legal_name: string|null, sector: string|null} */
    private function validatedOrganization(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:200'],
            'legal_name' => ['nullable', 'string', 'max:255'],
            'sector' => ['nullable', 'string', 'max:120'],
        ]);

        return ['name' => trim($data['name']), 'legal_name' => $data['legal_name'] ?? null, 'sector' => $data['sector'] ?? null];
    }
}
