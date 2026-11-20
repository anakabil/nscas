<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Berita acara pemusnahan data mentah satu asesmen (docs/04 bagian 7); permanen dan tidak berubah.
 *
 * @property string $id
 * @property string $assessment_id
 * @property CarbonImmutable $executed_at
 * @property int $executed_by
 * @property string $client_confirmation_ref
 * @property string $client_confirmed_by
 * @property CarbonImmutable $client_confirmed_on
 * @property string $witness_name
 * @property string|null $notes
 * @property array<array-key, mixed> $details
 * @property int $object_count
 * @property CarbonImmutable|null $objects_purged_at
 * @property string|null $storage_key
 * @property string|null $pdf_sha256
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
class DestructionRecord extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['executed_at' => 'datetime', 'client_confirmed_on' => 'date', 'details' => 'array', 'objects_purged_at' => 'datetime'];
    }

    /** @return BelongsTo<Assessment, $this> */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }

    /** @return BelongsTo<User, $this> */
    public function executor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'executed_by');
    }
}
