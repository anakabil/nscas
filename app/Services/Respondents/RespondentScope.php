<?php

namespace App\Services\Respondents;

use App\Domain\Access\Permissions;
use App\Domain\Access\Resource;
use App\Domain\Access\Role;
use App\Domain\Setup\UnitTree;
use App\Models\Assessment;
use App\Models\Unit;
use App\Models\UnitAssignment;
use App\Models\User;

/**
 * Cakupan unit seorang pengguna pada satu asesmen (docs/04 bagian 2, catatan "unitnya"). Koordinator unit hanya
 * melihat unit yang ditugaskan kepadanya beserta unit di bawahnya; peran lain yang memberi hak atas sumber daya yang
 * sama melihat semua unit (null). Peran yang tidak memberi hak atas sumber daya itu, misalnya peninjau eksekutif pada
 * daftar responden, tidak melonggarkan batas unit (sama dengan v1). Koordinator yang belum ditugaskan ke unit mana
 * pun tidak melihat satu orang pun.
 */
final class RespondentScope
{
    /**
     * @param  list<Role>  $roles
     * @return list<string>|null
     */
    public static function units(User $user, Assessment $assessment, array $roles, Resource $resource, bool $write = false): ?array
    {
        if (! Permissions::unitRestricted($roles, $resource, $write)) {
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
