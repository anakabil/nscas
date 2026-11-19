<?php

declare(strict_types=1);

namespace App\Domain\Navigation;

use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Domain\Workflow\Stage;
use App\Domain\Workflow\StageState;

/**
 * Penyusun menu beranda dan menu asesmen. Murni, sehingga dapat diuji tanpa basis data. Dua sudut pandang:
 * menurut tahap penilaian (enam tahap), dan menurut jenis akun (tugas utama setiap peran).
 */
final class MenuBuilder
{
    /**
     * Tugas utama setiap peran, sebagai kunci modul. Urutan adalah urutan tampil di beranda.
     *
     * @var array<string, list<string>>
     */
    private const ROLE_TASKS = [
        'SUPER_ADMIN' => ['team', 'participation', 'audit'],
        'LEAD_ASSESSOR' => ['details', 'sampling', 'participation', 'scoring', 'panel', 'report'],
        'ASSESSOR' => ['evidence', 'observations', 'validation', 'scoring'],
        'CLIENT_ADMIN' => ['respondents', 'participation', 'evidence', 'dashboard', 'gaps'],
        'UNIT_COORDINATOR' => ['respondents', 'participation', 'evidence', 'observations'],
        'EXECUTIVE_VIEWER' => ['dashboard', 'report', 'monitoring'],
    ];

    /**
     * Menu menurut tahap. Keenam tahap selalu dikembalikan agar pengguna melihat seluruh metode; modul di
     * dalamnya hanya yang boleh dibuka peran tersebut.
     *
     * @param  list<Role>  $roles
     * @return list<array{stage: Stage, state: StageState, modules: list<Module>}>
     */
    public static function byStage(AssessmentStatus $status, array $roles): array
    {
        $modules = ModuleCatalog::all($status);

        return array_map(static fn (Stage $stage): array => [
            'stage' => $stage,
            'state' => $stage->stateFor($status),
            'modules' => array_values(array_filter(
                $modules,
                static fn (Module $module): bool => $module->stage === $stage && $module->visibleTo($roles),
            )),
        ], Stage::cases());
    }

    /**
     * Halaman lintas tahap, misalnya jejak audit.
     *
     * @param  list<Role>  $roles
     * @return list<Module>
     */
    public static function crossStage(AssessmentStatus $status, array $roles): array
    {
        return array_values(array_filter(
            ModuleCatalog::all($status),
            static fn (Module $module): bool => $module->stage === null && $module->visibleTo($roles),
        ));
    }

    /**
     * Menu menurut jenis akun: tugas utama peran yang paling tinggi, disaring dengan hak akses.
     *
     * @param  list<Role>  $roles
     * @return list<Module>
     */
    public static function byRole(AssessmentStatus $status, array $roles): array
    {
        $primary = Role::primary($roles);
        if ($primary === null) {
            return [];
        }
        $byKey = [];
        foreach (ModuleCatalog::all($status) as $module) {
            $byKey[$module->key] = $module;
        }
        $tasks = [];
        foreach (self::ROLE_TASKS[$primary->value] as $key) {
            if (isset($byKey[$key]) && $byKey[$key]->visibleTo($roles)) {
                $tasks[] = $byKey[$key];
            }
        }

        return $tasks;
    }

    /**
     * Menu tingkat akun (di luar asesmen tertentu), menurut jenis akun.
     *
     * @param  list<Role>  $roles  Seluruh peran pengguna di semua organisasi dan asesmen.
     * @return list<array{key: string, path: string, ready: bool, buildPhase: string}>
     */
    public static function account(array $roles): array
    {
        $has = static fn (Role ...$any): bool => (bool) array_filter($roles, static fn (Role $r): bool => in_array($r, $any, true));
        $items = [['key' => 'assessments', 'path' => '/assessments', 'ready' => true, 'buildPhase' => 'R0']];
        if ($has(Role::LeadAssessor)) {
            $items[] = ['key' => 'newAssessment', 'path' => '/assessments/create', 'ready' => true, 'buildPhase' => 'R1'];
        }
        if ($has(Role::SuperAdmin, Role::LeadAssessor, Role::ClientAdmin)) {
            $items[] = ['key' => 'organizations', 'path' => '/organizations', 'ready' => true, 'buildPhase' => 'R1'];
        }
        if ($has(Role::SuperAdmin)) {
            $items[] = ['key' => 'retention', 'path' => '/retention', 'ready' => true, 'buildPhase' => 'R11'];
            $items[] = ['key' => 'systemStatus', 'path' => '/system-status', 'ready' => true, 'buildPhase' => 'R0'];
        }
        $items[] = ['key' => 'account', 'path' => '/settings/profile', 'ready' => true, 'buildPhase' => 'R0'];

        return $items;
    }
}
