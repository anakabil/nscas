<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Bagian dari jawaban survei anonim; disimpan sekaligus bersama SurveyResponse dengan UUID versi 4 acak. */
class ClimateAnswer extends Model
{
    public $timestamps = false;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];
}
