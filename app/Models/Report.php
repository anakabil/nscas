<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu versi laporan: potret isi yang tidak berubah; versi final ditandatangani asesor utama (pemicu report_guard).
 *
 * @property string $id
 * @property string $assessment_id
 * @property string $kind
 * @property int $version
 * @property string $locale
 * @property string $status
 * @property array<array-key, mixed> $content
 * @property string|null $storage_key
 * @property string|null $pdf_sha256
 * @property int|null $signed_by
 * @property CarbonImmutable|null $signed_at
 * @property string|null $signer_name
 * @property string|null $signer_position
 * @property int|null $created_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
class Report extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['content' => 'array', 'signed_at' => 'datetime', 'version' => 'integer'];
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
