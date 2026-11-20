<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/**
 * Panduan pertanyaan validasi per lapisan jabatan, salinan per asesmen (docs/01 M7).
 *
 * @property string $id
 * @property string $assessment_id
 * @property string $layer
 * @property string $intro
 * @property array<array-key, mixed> $questions
 * @property int|null $updated_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
class ValidationGuide extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['questions' => 'array'];
    }
}
