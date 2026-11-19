<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Sesi validasi: wawancara, diskusi kelompok terarah, kunjungan fisik, atau kunjungan virtual (docs/01 M7, D6). */
class ValidationSession extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['scheduled_at' => 'datetime', 'participant_count' => 'integer', 'focus_characteristic_ids' => 'array', 'recording_consent' => 'boolean'];
    }

    /** @return HasMany<ValidationParticipant, $this> */
    public function participants(): HasMany
    {
        return $this->hasMany(ValidationParticipant::class);
    }

    /** @return HasMany<ValidationRating, $this> */
    public function ratings(): HasMany
    {
        return $this->hasMany(ValidationRating::class);
    }

    /** @return BelongsTo<Unit, $this> */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /** @return BelongsTo<Stratum, $this> */
    public function stratum(): BelongsTo
    {
        return $this->belongsTo(Stratum::class);
    }
}
