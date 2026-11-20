<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pernyataan asesor bahwa bukti satu karakteristik telah ditinjau (fase R6, syarat evidence_reviewed).
 *
 * @property string $id
 * @property string $assessment_id
 * @property string $characteristic_id
 * @property string|null $note
 * @property int $reviewed_by
 * @property CarbonImmutable $reviewed_at
 */
class EvidenceReview extends Model
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
