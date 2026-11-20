<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Tinjauan pemantauan satu triwulan; tinjauan penutup menandai akhir pemantauan.
 *
 * @property string $id
 * @property string $assessment_id
 * @property string $quarter
 * @property string $summary
 * @property bool $closing
 * @property int $reviewed_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
class MonitoringReview extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['closing' => 'boolean'];
    }

    /** @return BelongsTo<User, $this> */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
