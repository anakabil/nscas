<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/**
 * Jawaban penilaian mandiri untuk satu karakteristik: tingkat, alasan, dan bukti.
 *
 * @property string $id
 * @property string $self_assessment_id
 * @property string $characteristic_id
 * @property int|null $level
 * @property string $justification
 * @property list<string> $evidence_ids
 */
class SelfAssessmentAnswer extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['level' => 'integer', 'evidence_ids' => 'array'];
    }
}
