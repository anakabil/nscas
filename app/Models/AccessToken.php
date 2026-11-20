<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Token akses survei. Hanya hash yang disimpan; token mentah hanya ada di tautan (docs/02 bagian 4). Partisipasi
 * dihitung dari completed_at di sini, tidak pernah dari tabel jawaban.
 *
 * @property string $id
 * @property string $assessment_id
 * @property string|null $roster_entry_id
 * @property string|null $unit_qr_code_id
 * @property string $unit_id
 * @property string|null $stratum_id
 * @property string $kind
 * @property string $token_hash
 * @property string|null $channel
 * @property CarbonImmutable $issued_at
 * @property CarbonImmutable|null $first_opened_at
 * @property CarbonImmutable|null $completed_at
 * @property CarbonImmutable|null $revoked_at
 * @property string|null $revoked_reason
 * @property int $reminder_count
 * @property CarbonImmutable|null $last_reminder_at
 */
#[Fillable([
    'assessment_id', 'roster_entry_id', 'unit_qr_code_id', 'unit_id', 'stratum_id', 'kind', 'token_hash', 'channel',
    'issued_at', 'reminder_count', 'last_reminder_at',
])]
class AccessToken extends Model
{
    use HasUlids;

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'issued_at' => 'datetime',
            'first_opened_at' => 'datetime',
            'consent_at' => 'datetime',
            'completed_at' => 'datetime',
            'revoked_at' => 'datetime',
            'last_reminder_at' => 'datetime',
            'reminder_count' => 'integer',
        ];
    }

    /** @return BelongsTo<RosterEntry, $this> */
    public function rosterEntry(): BelongsTo
    {
        return $this->belongsTo(RosterEntry::class);
    }

    /** @return BelongsTo<Assessment, $this> */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }
}
