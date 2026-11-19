<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/** Narasumber sesi validasi; disimpan terpisah dari catatan dan nilai (docs/13 V16). */
class ValidationParticipant extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [];
    }
}
