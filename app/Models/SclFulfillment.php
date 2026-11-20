<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/**
 * Pemenuhan jalur setara satu aspek pada satu tangga (docs/03 bagian 5), dengan alasan.
 *
 * @property string $id
 * @property string $assessment_id
 * @property string $aspect_code
 * @property int $step
 * @property float $percent
 * @property string $justification
 * @property int $updated_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
class SclFulfillment extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['percent' => 'float', 'step' => 'integer'];
    }
}
