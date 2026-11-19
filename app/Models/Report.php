<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu versi laporan: potret isi yang tidak berubah; versi final ditandatangani asesor utama (pemicu report_guard).
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
