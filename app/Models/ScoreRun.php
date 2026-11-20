<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Satu eksekusi mesin penilaian: masukan (nilai lapisan, tanpa jawaban mentah), parameter, dan hasil. Tidak dapat
 * diubah; penetapan rapat panel mengisi kolom final satu kali (pemicu score_run_guard).
 *
 * @property string $id
 * @property string $assessment_id
 * @property string $engine_version
 * @property array<array-key, mixed> $input_snapshot
 * @property array<array-key, mixed> $parameter_snapshot
 * @property array<array-key, mixed> $result
 * @property int $run_by
 * @property CarbonImmutable $created_at
 * @property bool $is_final
 * @property array<array-key, mixed>|null $final_result
 * @property CarbonImmutable|null $finalized_at
 * @property int|null $finalized_by
 */
class ScoreRun extends Model
{
    use HasUlids;

    public const UPDATED_AT = null;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'input_snapshot' => 'array',
            'parameter_snapshot' => 'array',
            'result' => 'array',
            'final_result' => 'array',
            'is_final' => 'boolean',
            'finalized_at' => 'datetime',
        ];
    }

    /** @return HasMany<PanelDecision, $this> */
    public function decisions(): HasMany
    {
        return $this->hasMany(PanelDecision::class);
    }

    /** @return BelongsTo<User, $this> */
    public function runner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'run_by');
    }

    /** @return BelongsTo<User, $this> */
    public function finalizer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'finalized_by');
    }
}
