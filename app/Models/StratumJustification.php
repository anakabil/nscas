<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/** Alasan tertulis untuk strata dengan partisipasi di bawah batas minimum (fase R6). */
class StratumJustification extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [];
    }
}
