<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Izin unggah yang belum diselesaikan. Id-nya menjadi tiket unggah; hanya pengguna yang memintanya yang dapat
 * menyelesaikannya, dan objek yang tidak pernah diselesaikan dihapus oleh nscas:prune-uploads.
 *
 * @property string $id
 * @property string $kind
 * @property string $assessment_id
 * @property int $user_id
 * @property string $storage_key
 * @property string $file_name
 * @property int $declared_size
 * @property array<string, mixed> $data
 * @property Carbon $expires_at
 */
class PendingUpload extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['declared_size' => 'integer', 'data' => 'array', 'expires_at' => 'datetime'];
    }
}
