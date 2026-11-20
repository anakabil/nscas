<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Catatan penyampaian hasil kepada pekerja (docs/12 temuan T5).
 *
 * @property string $id
 * @property string $assessment_id
 * @property CarbonImmutable $communicated_on
 * @property array<array-key, mixed> $channels
 * @property string $audience
 * @property int|null $reached
 * @property string|null $note
 * @property int $recorded_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
class ResultCommunication extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['communicated_on' => 'date', 'channels' => 'array'];
    }

    /** @return BelongsTo<User, $this> */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
