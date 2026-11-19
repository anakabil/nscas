<?php

namespace App\Models;

use App\Domain\Setup\DpaStatus;
use App\Domain\Setup\ScopeType;
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
 * @property ScopeType $scope_type
 * @property string|null $instrument_version_id
 * @property array<string, mixed>|null $parameter_draft
 * @property string|null $consent_text_id
 * @property string|null $consent_text_en
 * @property DpaStatus $dpa_status
 * @property string|null $dpa_reference
 * @property Carbon|null $dpa_signed_on
 * @property array<string, mixed>|null $kickoff
 * @property array<string, mixed>|null $calibration
 * @property Carbon|null $locked_at
 * @property int|null $locked_by
 * @property Carbon|null $survey_opens_at
 * @property Carbon|null $survey_closes_at
 */
#[Fillable([
    'organization_id', 'name', 'scope_type', 'period_start', 'period_end', 'target_level', 'status', 'created_by',
    'instrument_version_id', 'parameter_draft', 'consent_text_id', 'consent_text_en', 'dpa_status', 'dpa_reference',
    'dpa_signed_on', 'kickoff', 'calibration', 'survey_opens_at', 'survey_closes_at',
])]
class Assessment extends Model
{
    /** @use HasFactory<AssessmentFactory> */
    use HasFactory, HasUlids;

    protected $attributes = ['status' => 'DRAFT', 'target_level' => 3, 'scope_type' => 'CORPORATE', 'dpa_status' => 'NOT_STARTED'];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'target_level' => 'integer',
            'status' => AssessmentStatus::class,
            'parameter_snapshot' => 'array',
            'locked_at' => 'datetime',
            'scope_type' => ScopeType::class,
            'parameter_draft' => 'array',
            'dpa_status' => DpaStatus::class,
            'dpa_signed_on' => 'date',
            'kickoff' => 'array',
            'calibration' => 'array',
            'survey_opens_at' => 'datetime',
            'survey_closes_at' => 'datetime',
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

    /** @return BelongsTo<InstrumentVersion, $this> */
    public function instrumentVersion(): BelongsTo
    {
        return $this->belongsTo(InstrumentVersion::class);
    }

    /** @return HasMany<Unit, $this> */
    public function units(): HasMany
    {
        return $this->hasMany(Unit::class);
    }

    /** @return HasMany<Stratum, $this> */
    public function strata(): HasMany
    {
        return $this->hasMany(Stratum::class)->orderBy('code');
    }

    /** @return HasMany<RosterEntry, $this> */
    public function roster(): HasMany
    {
        return $this->hasMany(RosterEntry::class);
    }

    /** @return HasMany<AccessToken, $this> */
    public function tokens(): HasMany
    {
        return $this->hasMany(AccessToken::class);
    }

    /** @return HasMany<UnitQrCode, $this> */
    public function qrCodes(): HasMany
    {
        return $this->hasMany(UnitQrCode::class);
    }

    /** @return HasMany<UnitAssignment, $this> */
    public function unitAssignments(): HasMany
    {
        return $this->hasMany(UnitAssignment::class);
    }

    public function stage(): ?Stage
    {
        return Stage::of($this->status);
    }
}
