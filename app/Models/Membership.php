<?php

namespace App\Models;

use App\Domain\Access\Role;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Peran seorang pengguna di satu organisasi. Peran operator hanya sah di organisasi operator dan peran klien
 * hanya sah di organisasi klien (Role::isValidFor).
 *
 * @property int $user_id
 * @property string $organization_id
 * @property Role $role
 */
#[Fillable(['user_id', 'organization_id', 'role'])]
class Membership extends Model
{
    protected function casts(): array
    {
        return ['role' => Role::class];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Organization, $this> */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
