<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pembaruan kemajuan atau verifikasi asesor atas satu tindakan.
 *
 * @property string $id
 * @property string $action_item_id
 * @property string $kind
 * @property string $note
 * @property int $progress_percent
 * @property string $status
 * @property int $created_by
 * @property CarbonImmutable $created_at
 */
class ActionUpdate extends Model
{
    use HasUlids;

    public const UPDATED_AT = null;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
