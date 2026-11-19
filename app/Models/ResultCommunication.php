<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Catatan penyampaian hasil kepada pekerja (docs/12 temuan T5). */
class ResultCommunication extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['communicated_on' => 'date', 'channels' => 'array'];
    }

    /** @return BelongsTo<User, $this> */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
