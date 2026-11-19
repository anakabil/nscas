<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/**
 * Pernyataan berjenjang satu karakteristik. Tingkatnya tidak pernah dikirim ke peramban responden; peramban hanya
 * menerima id pernyataan dalam urutan acak.
 *
 * @property string $id
 * @property string $characteristic_id
 * @property int $level
 * @property string $text_id
 * @property string|null $text_en
 */
class LevelStatement extends Model
{
    use HasUlids;

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['level' => 'integer'];
    }
}
