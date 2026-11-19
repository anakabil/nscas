<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Dimensi skala iklim keselamatan (bagian B survei), dari seed/skala-iklim-draf.json.
 *
 * @property string $id
 * @property string $instrument_version_id
 * @property string $code
 * @property string $name_id
 * @property string|null $name_en
 * @property int $position
 */
class ClimateDimension extends Model
{
    use HasUlids;

    public $timestamps = false;

    protected $guarded = [];

    /** @return HasMany<ClimateItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(ClimateItem::class)->orderBy('position');
    }
}
