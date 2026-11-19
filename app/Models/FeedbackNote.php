<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Ringkasan umpan balik harian kepada organisasi selama validasi (docs/13 V17). */
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
