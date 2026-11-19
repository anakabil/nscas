<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/**
 * Butir skala iklim Likert lima titik.
 *
 * @property string $id
 * @property string $climate_dimension_id
 * @property string $code
 * @property string $text_id
 * @property string|null $text_en
 * @property bool $reverse_coded
 * @property int $position
 */
class ClimateItem extends Model
{
    use HasUlids;

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['reverse_coded' => 'boolean', 'position' => 'integer'];
    }
}
