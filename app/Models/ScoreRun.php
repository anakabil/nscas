<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Satu eksekusi mesin penilaian: masukan (nilai lapisan, tanpa jawaban mentah), parameter, dan hasil. Tidak dapat
 * diubah; penetapan rapat panel mengisi kolom final satu kali (pemicu score_run_guard).
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
