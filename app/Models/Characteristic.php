<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Karakteristik budaya K3 pada satu versi instrumen, dengan lima pernyataan berjenjang (docs/03). Dimuat dari
 * seed/instrumen-karakteristik-v1.json; pernyataan adalah karya Nusa Safety (CLAUDE.md aturan 8).
 *
 * @property string $id
 * @property string $instrument_version_id
 * @property string $aspect_code
 * @property string $code
 * @property string $name_id
 * @property string|null $name_en
 * @property bool $is_contextual
 * @property int $position
 */
class Characteristic extends Model
{
    use HasUlids;

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['is_contextual' => 'boolean', 'position' => 'integer', 'target_respondents' => 'array', 'evidence_examples' => 'array'];
    }

    /** @return HasMany<LevelStatement, $this> */
    public function statements(): HasMany
    {
        return $this->hasMany(LevelStatement::class);
    }
}
