<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/** Pemenuhan jalur setara satu aspek pada satu tangga (docs/03 bagian 5), dengan alasan. */
class SclFulfillment extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['percent' => 'float', 'step' => 'integer'];
    }
}
