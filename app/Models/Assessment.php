<?php

namespace App\Models;

use App\Domain\Workflow\AssessmentStatus;
use App\Domain\Workflow\Stage;
use Database\Factories\AssessmentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $name
 * @property Carbon $period_start
 * @property Carbon $period_end
 * @property int $target_level
 * @property AssessmentStatus $status
 * @property array<string, mixed>|null $parameter_snapshot
 */
#[Fillable(['organization_id', 'name', 'period_start', 'period_end', 'target_level', 'status', 'created_by'])]
class Assessment extends Model
{
    /** @use HasFactory<AssessmentFactory> */
    use HasFactory, HasUlids;

    protected $attributes = ['status' => 'DRAFT', 'target_level' => 3];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'target_level' => 'integer',
            'status' => AssessmentStatus::class,
            'parameter_snapshot' => 'array',
            'locked_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Organization, $this> */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /** @return HasMany<AssessmentTeamMember, $this> */
    public function team(): HasMany
    {
        return $this->hasMany(AssessmentTeamMember::class);
    }

    public function stage(): ?Stage
    {
        return Stage::of($this->status);
    }
}
