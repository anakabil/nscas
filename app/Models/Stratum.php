<?php

namespace App\Models;

use App\Domain\Scoring\StratumGroup;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Strata jabatan dan populasinya (jumlah rata-rata pekerja setahun, docs/13 bagian 3.5).
 *
 * @property string $id
 * @property string $assessment_id
 * @property string $code
 * @property string $name
 * @property StratumGroup $group
 * @property int $population
 * @property bool $is_contractor
 * @property list<string> $job_titles nama jabatan organisasi pada strata ini (App\Domain\Setup\JobTitles)
 */
#[Fillable(['assessment_id', 'code', 'name', 'group', 'population', 'is_contractor', 'job_titles'])]
class Stratum extends Model
{
    use HasUlids;

    protected $table = 'strata';

    protected $attributes = ['job_titles' => '[]'];

    protected function casts(): array
    {
        return ['group' => StratumGroup::class, 'population' => 'integer', 'is_contractor' => 'boolean', 'job_titles' => 'array'];
    }

    /** @return BelongsTo<Assessment, $this> */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }
}
