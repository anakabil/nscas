<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu foto atau video observasi dari kamera di dalam aplikasi (docs/01 M6). Waktu adalah waktu server.
 *
 * @property string $id
 * @property string $observation_window_id
 * @property string $checklist_item_code
 * @property string $storage_key
 * @property string $sha256
 * @property string $mime_type
 * @property int $size_bytes
 * @property CarbonImmutable $server_captured_at
 * @property float|null $latitude
 * @property float|null $longitude
 * @property float|null $accuracy_meters
 * @property float|null $distance_meters
 * @property bool $outside_radius
 * @property string|null $note
 * @property int $uploaded_by_id
 */
class ObservationCapture extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
            'server_captured_at' => 'datetime',
            'latitude' => 'float',
            'longitude' => 'float',
            'accuracy_meters' => 'float',
            'distance_meters' => 'float',
            'outside_radius' => 'boolean',
        ];
    }

    /** @return BelongsTo<ObservationWindow, $this> */
    public function window(): BelongsTo
    {
        return $this->belongsTo(ObservationWindow::class, 'observation_window_id');
    }

    /** @return BelongsTo<User, $this> */
    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_id');
    }
}
