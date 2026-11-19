<?php

namespace App\Models;

use App\Domain\Access\Role;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Penugasan asesor pada satu asesmen (docs/01 bagian 2: peran asesor ditugaskan per asesmen).
 *
 * @property string $assessment_id
 * @property int $user_id
 * @property Role $role
 */
#[Fillable(['assessment_id', 'user_id', 'role'])]
class AssessmentTeamMember extends Model
{
    protected function casts(): array
    {
        return ['role' => Role::class];
    }

    /** @return BelongsTo<Assessment, $this> */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
