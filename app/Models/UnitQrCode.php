<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Kode QR unit untuk pekerja tanpa surel (docs/01 M2). Hanya hash kode yang disimpan; kode mentah tampil sekali saat
 * dibuat. Setiap pemindaian menerbitkan satu token sekali pakai, sampai batas max_issuance.
 *
 * @property string $id
 * @property string $assessment_id
 * @property string $unit_id
 * @property string|null $stratum_id
 * @property string $code_hash
 * @property bool $is_active
 * @property int|null $max_issuance
 */
#[Fillable(['assessment_id', 'unit_id', 'stratum_id', 'code_hash', 'is_active', 'max_issuance'])]
class UnitQrCode extends Model
{
    use HasUlids;

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'max_issuance' => 'integer'];
    }

    /** @return BelongsTo<Unit, $this> */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /** @return BelongsTo<Stratum, $this> */
    public function stratum(): BelongsTo
    {
        return $this->belongsTo(Stratum::class);
    }

    /** @return BelongsTo<Assessment, $this> */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }
}
