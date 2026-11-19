<?php

namespace App\Http\Controllers\Scoring;

use App\Domain\Access\Role;
use App\Http\Controllers\Respondents\CollectionController;

/** Dasar halaman tahap 4 Penilaian (fase R7): penilaian asesor dan rapat panel. */
abstract class RatingStageController extends CollectionController
{
    private const TABS = [
        'scoring' => 'scoring',
        'panel' => 'panel',
    ];

    protected function tabMap(): array
    {
        return self::TABS;
    }

    protected function stageKey(): string
    {
        return 'ratingStage';
    }

    /** @param list<Role> $roles */
    protected function isLead(array $roles): bool
    {
        return in_array(Role::LeadAssessor, $roles, true);
    }

    /** @param list<Role> $roles */
    protected function assessorRole(array $roles): Role
    {
        foreach ([Role::LeadAssessor, Role::Assessor] as $role) {
            if (in_array($role, $roles, true)) {
                return $role;
            }
        }
        abort(403);
    }
}
