<?php

namespace App\Services;

use App\Domain\Access\Role;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use App\Support\Audit;
use App\Support\RuleViolation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Organisasi dan akun pengguna (PROMPTS.md R1 butir 1). Pengelola sistem mengelola semua organisasi; administrator
 * klien mengelola akun klien di organisasinya. Peran tidak pernah diisi otomatis, dan akun dinonaktifkan, bukan
 * dihapus. Akun baru dan akun yang diatur ulang menerima kata sandi sementara yang tampil satu kali dan wajib diganti
 * saat masuk berikutnya. Kata sandi tidak pernah masuk jejak audit.
 */
final class OrganizationAdmin
{
    /** @param  array{name: string, legal_name: string|null, sector: string|null}  $input */
    public function createOrganization(array $input): Organization
    {
        return DB::transaction(function () use ($input) {
            $organization = Organization::create([...$input, 'is_operator' => false]);
            Audit::record('organization.create', $organization, ['after' => $input], actorRole: Role::SuperAdmin);

            return $organization;
        });
    }

    /** @param  array{name: string, legal_name: string|null, sector: string|null, is_active: bool}  $input */
    public function updateOrganization(Organization $organization, array $input): void
    {
        DB::transaction(function () use ($organization, $input) {
            if ($organization->is_operator && ! $input['is_active']) {
                throw RuleViolation::invalid('is_active', 'OPERATOR_ALWAYS_ACTIVE');
            }
            $before = $organization->only(array_keys($input));
            $organization->update($input);
            Audit::record('organization.update', $organization, ['before' => $before, 'after' => $input], actorRole: Role::SuperAdmin);
        });
    }

    /**
     * Akun baru dengan peran yang dipilih secara eksplisit. Mengembalikan kata sandi sementara untuk ditampilkan satu
     * kali kepada administrator.
     *
     * @param  list<Role>  $roles
     */
    public function createUser(Organization $organization, string $name, string $email, array $roles, Role $actorRole): string
    {
        $this->assertRoles($organization, $roles, $actorRole);
        $email = Str::lower(trim($email));
        if (User::where('email', $email)->exists()) {
            throw RuleViolation::invalid('email', 'EMAIL_TAKEN');
        }
        $password = $this->temporaryPassword();

        DB::transaction(function () use ($organization, $name, $email, $roles, $actorRole, $password) {
            $user = new User(['name' => trim($name), 'email' => $email, 'password' => $password]);
            $user->forceFill(['must_change_password' => true, 'email_verified_at' => now()])->save();
            foreach ($roles as $role) {
                $user->memberships()->create(['organization_id' => $organization->id, 'role' => $role]);
            }
            Audit::record('user.create', $user, ['after' => [
                'email' => $email,
                'organization' => $organization->name,
                'roles' => array_map(fn (Role $r) => $r->value, $roles),
            ]], actorRole: $actorRole);
        });

        return $password;
    }

    /**
     * Mengubah nama dan peran pengguna di satu organisasi. Peran di organisasi lain tidak tersentuh.
     *
     * @param  list<Role>  $roles
     */
    public function updateUser(Organization $organization, User $user, string $name, array $roles, User $actor, Role $actorRole): void
    {
        $this->assertRoles($organization, $roles, $actorRole);
        if ($actor->is($user) && $actorRole === Role::ClientAdmin && ! in_array(Role::ClientAdmin, $roles, true)) {
            throw RuleViolation::invalid('roles', 'SELF_ROLE');
        }
        DB::transaction(function () use ($organization, $user, $name, $roles, $actorRole) {
            $current = $user->memberships()->where('organization_id', $organization->id)->get();
            $before = $current->map(fn (Membership $m) => $m->role->value)->sort()->values()->all();
            foreach ($current as $membership) {
                if (! in_array($membership->role, $roles, true)) {
                    $membership->delete();
                }
            }
            foreach ($roles as $role) {
                if (! $current->contains(fn (Membership $m) => $m->role === $role)) {
                    $user->memberships()->create(['organization_id' => $organization->id, 'role' => $role]);
                }
            }
            $user->update(['name' => trim($name)]);
            Audit::record('user.update', $user, [
                'organization' => $organization->name,
                'before' => ['roles' => $before],
                'after' => ['roles' => collect($roles)->map(fn (Role $r) => $r->value)->sort()->values()->all()],
            ], actorRole: $actorRole);
        });
    }

    public function setActive(User $user, bool $active, User $actor, Role $actorRole): void
    {
        if ($actor->is($user) && ! $active) {
            throw RuleViolation::invalid('user', 'SELF_DEACTIVATE');
        }
        DB::transaction(function () use ($user, $active, $actorRole) {
            $user->forceFill(['is_active' => $active])->save();
            Audit::record($active ? 'user.activate' : 'user.deactivate', $user, ['email' => $user->email], actorRole: $actorRole);
        });
    }

    /** Kata sandi sementara baru; verifikasi dua langkah tidak diubah. */
    public function resetPassword(User $user, Role $actorRole): string
    {
        $password = $this->temporaryPassword();
        DB::transaction(function () use ($user, $password, $actorRole) {
            $user->forceFill(['password' => $password, 'must_change_password' => true, 'remember_token' => null])->save();
            Audit::record('user.password_reset', $user, ['email' => $user->email], actorRole: $actorRole);
        });

        return $password;
    }

    /**
     * Peran harus dipilih, sah untuk jenis organisasinya, dan berada dalam wewenang pelaku: administrator klien hanya
     * dapat memberi peran klien di organisasinya sendiri.
     *
     * @param  list<Role>  $roles
     */
    private function assertRoles(Organization $organization, array $roles, Role $actorRole): void
    {
        if ($roles === []) {
            throw RuleViolation::invalid('roles', 'ROLE_REQUIRED');
        }
        foreach ($roles as $role) {
            if ($role === Role::SuperAdmin || ! $role->isValidFor($organization->is_operator)) {
                throw RuleViolation::invalid('roles', 'ROLE_NOT_VALID_FOR_ORGANIZATION');
            }
            if ($actorRole === Role::ClientAdmin && ! $role->isClient()) {
                throw RuleViolation::invalid('roles', 'ROLE_NOT_VALID_FOR_ORGANIZATION');
            }
        }
    }

    /** Kata sandi sementara 16 karakter alfanumerik acak (sekitar 93 bit), mudah diketik; wajib diganti saat masuk. */
    private function temporaryPassword(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        do {
            $password = '';
            for ($i = 0; $i < 16; $i++) {
                $password .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
        } while (! preg_match('/[A-Z]/', $password) || ! preg_match('/[a-z]/', $password) || ! preg_match('/\d/', $password));

        return $password;
    }
}
