<?php

namespace App\Http\Controllers\Results;

use App\Domain\Access\Role;
use App\Http\Controllers\Respondents\CollectionController;

/** Dasar halaman tahap 5 Pelaporan dan rencana aksi (fase R8 sampai R10). */
abstract class ReportingStageController extends CollectionController
{
    private const TABS = [
        'dashboard' => 'dashboard',
        'gaps' => 'gaps',
        'report' => 'report',
        'communication' => 'communication',
    ];

    protected function tabMap(): array
    {
        return self::TABS;
    }

    protected function stageKey(): string
    {
        return 'reportingStage';
    }

    /** @param list<Role> $roles */
    protected function isAssessor(array $roles): bool
    {
        return in_array(Role::LeadAssessor, $roles, true) || in_array(Role::Assessor, $roles, true);
    }
}
