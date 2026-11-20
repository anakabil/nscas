<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Ringkasan umpan balik harian kepada organisasi selama validasi (docs/13 V17).
 *
 * @property string $id
 * @property string $assessment_id
 * @property CarbonImmutable $note_date
 * @property string $summary
 * @property int $author_id
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
class FeedbackNote extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['note_date' => 'date'];
    }

    /** @return BelongsTo<User, $this> */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
