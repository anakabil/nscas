<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Bagian dari jawaban survei anonim; disimpan sekaligus bersama SurveyResponse dengan UUID versi 4 acak.
 *
 * @property string $id
 * @property string $survey_response_id
 * @property string $characteristic_id
 * @property int|null $level
 */
class CharacteristicAnswer extends Model
{
    public $timestamps = false;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];
}
