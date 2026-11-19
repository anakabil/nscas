<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/** Panduan pertanyaan validasi per lapisan jabatan, salinan per asesmen (docs/01 M7). */
class ValidationGuide extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['questions' => 'array'];
    }
}
