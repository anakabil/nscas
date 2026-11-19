<?php

namespace App\Models;

use App\Domain\Setup\UnitType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Unit yang diukur: kantor pusat, divisi, proyek, atau cabang, bertingkat.
 *
 * @property string $id
 * @property string $assessment_id
 * @property string|null $parent_id
 * @property string $name
 * @property UnitType $type
 * @property string|null $latitude
 * @property string|null $longitude
 * @property int|null $radius_meters
 */
#[Fillable(['assessment_id', 'parent_id', 'name', 'type', 'latitude', 'longitude', 'radius_meters'])]
class Unit extends Model
{
    use HasUlids;

    protected function casts(): array
    {
        return ['type' => UnitType::class, 'radius_meters' => 'integer'];
    }

    /** @return BelongsTo<Assessment, $this> */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }
}
