<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/**
 * Nilai validasi satu asesor untuk satu karakteristik dalam satu sesi, 1,0 sampai 5,0 kelipatan 0,5.
 *
 * @property string $id
 * @property string $validation_session_id
 * @property string $characteristic_id
 * @property int $assessor_id
 * @property float $level
 * @property string|null $note
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property string|null $evidence_code
 * @property string|null $agreement
 */
class ValidationRating extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['level' => 'float'];
    }
}
