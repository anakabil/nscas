<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/** Nilai validasi satu asesor untuk satu karakteristik dalam satu sesi, 1,0 sampai 5,0 kelipatan 0,5. */
class ValidationRating extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['level' => 'float'];
    }
}
