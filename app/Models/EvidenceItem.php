<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * Bukti dokumen (docs/01 M5). Setiap versi adalah baris tersendiri; versi baru merujuk versi yang digantikannya.
 *
 * @property string $id
 * @property string $assessment_id
 * @property string|null $unit_id
 * @property string $title
 * @property string|null $description
 * @property string $file_name
 * @property string $storage_key
 * @property string $sha256
 * @property string $mime_type
 * @property int $size_bytes
 * @property int $version
 * @property string|null $supersedes_id
 * @property int $uploaded_by_id
 * @property Carbon|null $deleted_at
 * @property Carbon $created_at
 */
class EvidenceItem extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['size_bytes' => 'integer', 'version' => 'integer', 'deleted_at' => 'datetime'];
    }

    /** @return HasMany<EvidenceLink, $this> */
    public function links(): HasMany
    {
        return $this->hasMany(EvidenceLink::class);
    }

    /** @return BelongsTo<Unit, $this> */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /** @return BelongsTo<User, $this> */
    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_id');
    }

    /** @return HasOne<EvidenceItem, $this> */
    public function supersededBy(): HasOne
    {
        return $this->hasOne(EvidenceItem::class, 'supersedes_id');
    }
}
