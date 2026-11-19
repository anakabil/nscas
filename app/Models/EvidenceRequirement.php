<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/**
 * Butir daftar periksa bukti satu karakteristik (docs/01 M5), dari evidence_examples versi instrumen.
 *
 * @property string $id
 * @property string $characteristic_id
 * @property int $position
 * @property string $description
 */
class EvidenceRequirement extends Model
{
    use HasUlids;

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['position' => 'integer'];
    }
}
