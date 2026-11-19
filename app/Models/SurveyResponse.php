<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Satu jawaban survei anonim (CLAUDE.md aturan 2, docs/02 bagian 4). Tidak ada relasi ke token atau daftar
 * responden, tidak ada cap waktu. Kunci utama UUID versi 4 acak: UUID bawaan Laravel berurutan waktu sehingga
 * dapat dicocokkan dengan waktu selesai token, karena itu tidak dipakai.
 *
 * @property string $id
 * @property string $assessment_id
 * @property string $unit_id
 * @property string $stratum_id
 * @property string $instrument_version_id
 * @property string $language
 * @property Carbon $submitted_on
 * @property string $duration_bucket
 * @property list<string> $quality_flags
 * @property bool $excluded
 */
class SurveyResponse extends Model
{
    public $timestamps = false;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected static function booted(): void
    {
        static::creating(function (SurveyResponse $response) {
            $response->id ??= self::randomId();
        });
    }

    /** UUID versi 4 (acak penuh). */
    public static function randomId(): string
    {
        return (string) Str::uuid();
    }

    protected function casts(): array
    {
        return ['submitted_on' => 'date', 'quality_flags' => 'array', 'excluded' => 'boolean'];
    }

    /** @return HasMany<CharacteristicAnswer, $this> */
    public function characteristicAnswers(): HasMany
    {
        return $this->hasMany(CharacteristicAnswer::class);
    }

    /** @return HasMany<ClimateAnswer, $this> */
    public function climateAnswers(): HasMany
    {
        return $this->hasMany(ClimateAnswer::class);
    }
}
