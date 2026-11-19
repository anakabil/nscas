<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Penilaian mandiri manajemen (docs/01 M4). Teridentifikasi, berbeda dengan survei pekerja yang anonim.
 *
 * @property string $id
 * @property string $assessment_id
 * @property string $unit_id
 * @property string $access_token_id
 * @property string $respondent_name
 * @property string $respondent_position
 * @property string $status
 * @property Carbon|null $submitted_at
 * @property string|null $respondent_email
 * @property Carbon $created_at
 */
class SelfAssessment extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['submitted_at' => 'datetime', 'respondent_email' => 'encrypted'];
    }

    /** @return HasMany<SelfAssessmentAnswer, $this> */
    public function answers(): HasMany
    {
        return $this->hasMany(SelfAssessmentAnswer::class);
    }

    /** @return BelongsTo<AccessToken, $this> */
    public function accessToken(): BelongsTo
    {
        return $this->belongsTo(AccessToken::class);
    }

    /** @return BelongsTo<Unit, $this> */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }
}
