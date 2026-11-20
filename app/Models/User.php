<?php

namespace App\Models;

use App\Domain\Access\Role;
use Carbon\CarbonImmutable;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property CarbonImmutable|null $email_verified_at
 * @property string $password
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property CarbonImmutable|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property bool $is_super_admin
 * @property bool $is_active
 * @property string|null $locale
 * @property bool $must_change_password
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
#[Fillable(['name', 'email', 'password', 'locale'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable;

    /** Nilai bawaan yang sama dengan basis data, agar model baru langsung konsisten sebelum dimuat ulang. */
    protected $attributes = ['is_super_admin' => false, 'is_active' => true, 'must_change_password' => false];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'is_super_admin' => 'boolean',
            'is_active' => 'boolean',
            'must_change_password' => 'boolean',
        ];
    }

    /** @return HasMany<Membership, $this> */
    public function memberships(): HasMany
    {
        return $this->hasMany(Membership::class);
    }

    /** @return HasMany<AssessmentTeamMember, $this> */
    public function teamAssignments(): HasMany
    {
        return $this->hasMany(AssessmentTeamMember::class);
    }

    /**
     * Seluruh peran pengguna di semua organisasi dan asesmen, tanpa duplikat. Dipakai untuk menu tingkat akun;
     * hak atas satu asesmen selalu dihitung per asesmen oleh AssessmentAccess.
     *
     * @return list<Role>
     */
    public function allRoles(): array
    {
        $roles = $this->is_super_admin ? [Role::SuperAdmin] : [];
        foreach ([...$this->memberships, ...$this->teamAssignments] as $held) {
            if (! in_array($held->role, $roles, true)) {
                $roles[] = $held->role;
            }
        }

        return $roles;
    }
}
