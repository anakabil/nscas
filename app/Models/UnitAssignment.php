<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Penugasan koordinator unit pada satu unit asesmen. Koordinator hanya melihat unit itu dan unit di bawahnya.
 *
 * @property int $id
 * @property string $assessment_id
 * @property string $unit_id
 * @property int $user_id
 */
#[Fillable(['assessment_id', 'unit_id', 'user_id'])]
class UnitAssignment extends Model
{
    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Unit, $this> */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }
}
