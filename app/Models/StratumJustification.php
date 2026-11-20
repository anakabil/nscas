<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/**
 * Alasan tertulis untuk strata dengan partisipasi di bawah batas minimum (fase R6).
 *
 * @property string $id
 * @property string $assessment_id
 * @property string $stratum_id
 * @property string $justification
 * @property int $written_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
class StratumJustification extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [];
    }
}
