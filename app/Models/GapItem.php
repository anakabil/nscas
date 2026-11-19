<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Satu karakteristik di bawah tingkat sasaran, dengan analisis penyebab dan prioritas (docs/01 M10). */
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
