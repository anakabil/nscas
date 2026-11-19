<?php

namespace App\Services\Respondents;

use App\Domain\Access\Role;
use App\Domain\Setup\UnitTree;
use App\Models\Assessment;
use App\Models\Unit;
use App\Models\UnitAssignment;
use App\Models\User;

/**
 * Cakupan unit seorang pengguna pada satu asesmen (docs/04 bagian 2, catatan "unitnya"). Koordinator unit hanya
 * melihat unit yang ditugaskan kepadanya beserta unit di bawahnya; peran lain melihat semua unit (null). Koordinator
 * yang belum ditugaskan ke unit mana pun tidak melihat satu orang pun.
 */
final class RespondentScope
{
    /**
     * @param  list<Role>  $roles
     * @return list<string>|null
     */
    public static function units(User $user, Assessment $assessment, array $roles): ?array
    {
        if (array_filter($roles, fn (Role $r) => $r !== Role::UnitCoordinator) !== []) {
            return null;
        }
        $roots = UnitAssignment::where('assessment_id', $assessment->id)->where('user_id', $user->id)->pluck('unit_id')->all();
        if ($roots === []) {
            return [];
        }
        $units = Unit::where('assessment_id', $assessment->id)->get(['id', 'parent_id'])
            ->map(fn (Unit $u) => ['id' => $u->id, 'parentId' => $u->parent_id])->all();

        return UnitTree::withDescendants($units, $roots);
    }
}
