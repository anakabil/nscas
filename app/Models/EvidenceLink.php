<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pemetaan bukti ke satu karakteristik beserta butir daftar periksa yang dipenuhinya (docs/01 M5).
 *
 * @property string $id
 * @property string $evidence_item_id
 * @property string $characteristic_id
 * @property list<string> $requirement_ids
 */
class EvidenceLink extends Model
{
    use HasUlids;

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['requirement_ids' => 'array'];
    }

    /** @return BelongsTo<Characteristic, $this> */
    public function characteristic(): BelongsTo
    {
        return $this->belongsTo(Characteristic::class);
    }

    /** @return BelongsTo<EvidenceItem, $this> */
    public function evidenceItem(): BelongsTo
    {
        return $this->belongsTo(EvidenceItem::class);
    }
}
