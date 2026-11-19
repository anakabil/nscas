<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Satu tindakan rencana aksi dengan penanggung jawab, tenggat, indikator keberhasilan, dan status. */
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
