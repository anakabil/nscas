<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Keputusan rapat panel atas satu karakteristik: nilai disesuaikan atau nilai mesin dikukuhkan, dengan alasan. */
class PanelDecision extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['engine_value' => 'float', 'adjusted_value' => 'float'];
    }

    /** @return BelongsTo<User, $this> */
    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
