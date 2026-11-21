<?php

namespace App\Models;

use Database\Factories\OrganizationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $name
 * @property bool $is_operator
 * @property string|null $legal_name
 * @property string|null $sector
 * @property bool $is_active
 * @property list<array{code: string, name: string, group: string, isContractor: bool, jobTitles: list<string>}>|null $strata_template
 */
#[Fillable(['name', 'is_operator', 'legal_name', 'sector', 'is_active'])]
class Organization extends Model
{
    /** @use HasFactory<OrganizationFactory> */
    use HasFactory, HasUlids;

    protected $attributes = ['is_operator' => false, 'is_active' => true];

    protected function casts(): array
    {
        return ['is_operator' => 'boolean', 'is_active' => 'boolean', 'strata_template' => 'array'];
    }

    /** @return HasMany<Membership, $this> */
    public function memberships(): HasMany
    {
        return $this->hasMany(Membership::class);
    }

    /** @return HasMany<Assessment, $this> */
    public function assessments(): HasMany
    {
        return $this->hasMany(Assessment::class);
    }
}
