<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Tinjauan asesor utama atas partisipasi atau mutu data sebelum validasi (fase R6, docs/12 temuan T3).
 *
 * @property string $id
 * @property string $assessment_id
 * @property string $kind
 * @property string|null $note
 * @property int $reviewed_by
 * @property CarbonImmutable $reviewed_at
 */
class AssessmentReview extends Model
{
    use HasUlids;

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['reviewed_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
