<?php

namespace App\Http\Controllers\Validation;

use App\Domain\Access\Role;
use App\Http\Controllers\Respondents\CollectionController;

/**
 * Dasar halaman tahap 3 Validasi dan triangulasi (fase R6): mutu data, temuan awal, dan validasi lapangan. Hak buka
 * mengikuti katalog modul; perubahan diperiksa per aksi.
 */
abstract class ValidationStageController extends CollectionController
{
    private const TABS = [
        'dataQuality' => 'data-quality',
        'findings' => 'findings',
        'validation' => 'validation',
    ];

    protected function tabMap(): array
    {
        return self::TABS;
    }

    protected function stageKey(): string
    {
        return 'validationStage';
    }

    /**
     * Asesor utama memutuskan tinjauan, pengeluaran jawaban, dan rencana sesi (docs/01 M7).
     *
     * @param  list<Role>  $roles
     */
    protected function isLead(array $roles): bool
    {
        return in_array(Role::LeadAssessor, $roles, true);
    }

    /**
     * Peran asesor pelaku (asesor utama didahulukan), atau 403.
     *
     * @param  list<Role>  $roles
     */
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
