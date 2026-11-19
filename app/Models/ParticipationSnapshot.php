<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Hitungan partisipasi harian (jumlah mentah) untuk grafik tren; ambang sel diterapkan saat ditampilkan.
 *
 * @property int $id
 * @property string $assessment_id
 * @property Carbon $taken_on
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
