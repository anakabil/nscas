<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/**
 * Versi instrumen beserta parameter bawaannya. Parameter bawaan disalin ke draf asesmen saat asesmen dibuat, lalu ke
 * snapshot saat dikunci, sehingga perubahan seed tidak memengaruhi asesmen yang sudah berjalan.
 *
 * @property string $id
 * @property string $code
 * @property string $status
 * @property CarbonImmutable|null $published_at
 * @property array<string, mixed> $default_parameters
 * @property array<string, mixed>|null $content
 */
#[Fillable(['code', 'status', 'published_at', 'default_parameters', 'content'])]
class InstrumentVersion extends Model
{
    use HasUlids;

    protected function casts(): array
    {
        return ['published_at' => 'datetime', 'default_parameters' => 'array', 'content' => 'array'];
    }

    public function isPublished(): bool
    {
        return $this->status === 'PUBLISHED';
    }
}
