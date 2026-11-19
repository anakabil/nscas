<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Nilai bukti satu asesor untuk satu karakteristik (docs/03 bagian 2.2), dengan alasan dan bukti dasarnya. */
class EvidenceRating extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['level' => 'float', 'evidence_item_ids' => 'array', 'observation_capture_ids' => 'array'];
    }

    /** @return BelongsTo<User, $this> */
    public function assessor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assessor_id');
    }
}
