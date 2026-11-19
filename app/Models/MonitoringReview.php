<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Tinjauan pemantauan satu triwulan; tinjauan penutup menandai akhir pemantauan. */
class MonitoringReview extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['closing' => 'boolean'];
    }

    /** @return BelongsTo<User, $this> */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
