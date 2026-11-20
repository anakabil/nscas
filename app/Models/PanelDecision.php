<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Keputusan rapat panel atas satu karakteristik: nilai disesuaikan atau nilai mesin dikukuhkan, dengan alasan.
 *
 * @property string $id
 * @property string $score_run_id
 * @property string $characteristic_id
 * @property string $characteristic_code
 * @property string $kind
 * @property float|null $engine_value
 * @property float|null $adjusted_value
 * @property string $rationale
 * @property int $decided_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
class PanelDecision extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['engine_value' => 'float', 'adjusted_value' => 'float'];
    }

    /** @return BelongsTo<User, $this> */
    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
