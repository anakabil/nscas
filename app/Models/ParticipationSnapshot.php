<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Hitungan partisipasi harian (jumlah mentah) untuk grafik tren; ambang sel diterapkan saat ditampilkan.
 *
 * @property int $id
 * @property string $assessment_id
 * @property CarbonImmutable $taken_on
 * @property array<string, mixed> $data
 */
#[Fillable(['assessment_id', 'taken_on', 'data'])]
class ParticipationSnapshot extends Model
{
    protected function casts(): array
    {
        return ['taken_on' => 'date', 'data' => 'array'];
    }
}
