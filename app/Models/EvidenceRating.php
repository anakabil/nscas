<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Nilai bukti satu asesor untuk satu karakteristik (docs/03 bagian 2.2), dengan alasan dan bukti dasarnya.
 *
 * @property string $id
 * @property string $assessment_id
 * @property string $characteristic_id
 * @property int $assessor_id
 * @property float $level
 * @property string $rationale
 * @property array<array-key, mixed> $evidence_item_ids
 * @property array<array-key, mixed> $observation_capture_ids
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
class EvidenceRating extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['level' => 'float', 'evidence_item_ids' => 'array', 'observation_capture_ids' => 'array'];
    }

    /** @return BelongsTo<User, $this> */
    public function assessor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assessor_id');
    }
}
