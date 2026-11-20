<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/**
 * Narasumber sesi validasi; disimpan terpisah dari catatan dan nilai (docs/13 V16).
 *
 * @property string $id
 * @property string $validation_session_id
 * @property string $full_name
 * @property string $position
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
class ValidationParticipant extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [];
    }
}
