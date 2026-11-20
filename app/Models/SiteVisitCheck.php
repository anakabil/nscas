<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Hasil satu butir lembar kerja kunjungan proyek dalam satu sesi kunjungan.
 *
 * @property string $id
 * @property string $validation_session_id
 * @property string $item_code
 * @property string $characteristic_id
 * @property string $result
 * @property string|null $note
 * @property int $checked_by
 */
class SiteVisitCheck extends Model
{
    use HasUlids;

    protected $guarded = [];

    /** @return BelongsTo<ValidationSession, $this> */
    public function session(): BelongsTo
    {
        return $this->belongsTo(ValidationSession::class, 'validation_session_id');
    }
}
