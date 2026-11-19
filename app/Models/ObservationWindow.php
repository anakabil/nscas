<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Masa observasi lapangan satu proyek (docs/01 M6): waktu buka dan tutup, daftar periksa, dan titik proyek
 * dengan radius toleransi.
 *
 * @property string $id
 * @property string $assessment_id
 * @property string $unit_id
 * @property string $title
 * @property Carbon $opens_at
 * @property Carbon $closes_at
 * @property list<array{code: string, label: string}> $checklist
 * @property float $latitude
 * @property float $longitude
 * @property int $radius_meters
 * @property int $created_by_id
 */
class ObservationWindow extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'opens_at' => 'datetime',
            'closes_at' => 'datetime',
            'checklist' => 'array',
            'latitude' => 'float',
            'longitude' => 'float',
            'radius_meters' => 'integer',
        ];
    }

    /** @return HasMany<ObservationCapture, $this> */
    public function captures(): HasMany
    {
        return $this->hasMany(ObservationCapture::class);
    }

    /** @return BelongsTo<Unit, $this> */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /** @return BelongsTo<Assessment, $this> */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }
}
