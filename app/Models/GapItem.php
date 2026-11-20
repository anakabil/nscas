<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Satu karakteristik di bawah tingkat sasaran, dengan analisis penyebab dan prioritas (docs/01 M10).
 *
 * @property string $id
 * @property string $assessment_id
 * @property string $characteristic_id
 * @property string $characteristic_code
 * @property string|null $score_run_id
 * @property float $current_index
 * @property float $target_level
 * @property float $gap
 * @property float $priority_score
 * @property int $rank
 * @property bool $is_contextual
 * @property string|null $root_cause
 * @property string|null $priority
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read int|null $active_actions Hasil withCount di ActionPlanService.
 */
class GapItem extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['current_index' => 'float', 'target_level' => 'float', 'gap' => 'float', 'priority_score' => 'float', 'is_contextual' => 'boolean'];
    }

    /** @return HasMany<ActionItem, $this> */
    public function actions(): HasMany
    {
        return $this->hasMany(ActionItem::class);
    }
}
