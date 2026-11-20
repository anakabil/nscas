<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Satu tindakan rencana aksi dengan penanggung jawab, tenggat, indikator keberhasilan, dan status.
 *
 * @property string $id
 * @property string $gap_item_id
 * @property string $title
 * @property string|null $description
 * @property string $owner_name
 * @property string $owner_position
 * @property string|null $owner_email
 * @property string|null $unit_id
 * @property CarbonImmutable $due_date
 * @property string $success_indicator
 * @property string $status
 * @property int $progress_percent
 * @property int|null $verified_by
 * @property CarbonImmutable|null $verified_at
 * @property CarbonImmutable|null $last_reminder_at
 * @property int|null $created_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
class ActionItem extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['due_date' => 'date', 'verified_at' => 'datetime', 'last_reminder_at' => 'datetime', 'owner_email' => 'encrypted'];
    }

    /** @return BelongsTo<GapItem, $this> */
    public function gap(): BelongsTo
    {
        return $this->belongsTo(GapItem::class, 'gap_item_id');
    }

    /** @return BelongsTo<Unit, $this> */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /** @return HasMany<ActionUpdate, $this> */
    public function updates(): HasMany
    {
        return $this->hasMany(ActionUpdate::class);
    }
}
