<?php

namespace App\Support;

use App\Domain\Access\Permissions;
use App\Domain\Access\Resource;
use App\Domain\Access\Role;
use App\Models\Assessment;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Penjaga akses asesmen (aturan 4: isolasi tenant). Setiap pengendali yang menyentuh data asesmen wajib
 * memanggil require() atau memakai visibleTo(); pemeriksaan di sisi peramban tidak pernah diandalkan.
 *
 * Sumber peran atas satu asesmen:
 *   1. pengelola sistem (SUPER_ADMIN) untuk semua asesmen, sebatas hak pada matriks docs/04;
 *   2. penugasan tim asesor pada asesmen itu (LEAD_ASSESSOR, ASSESSOR);
 *   3. keanggotaan klien di organisasi pemilik asesmen (CLIENT_ADMIN, UNIT_COORDINATOR, EXECUTIVE_VIEWER).
 * Keanggotaan sebagai asesor di organisasi operator saja tidak memberi akses ke asesmen yang tidak ditugaskan.
 */
final class AssessmentAccess
{
    /** @return list<Role> */
    public static function rolesFor(User $user, Assessment $assessment): array
    {
        $roles = $user->is_super_admin ? [Role::SuperAdmin] : [];

        foreach ($user->teamAssignments as $assignment) {
            if ($assignment->assessment_id === $assessment->id) {
                $roles[] = $assignment->role;
            }
        }
        foreach ($user->memberships as $membership) {
            if ($membership->organization_id === $assessment->organization_id && $membership->role->isClient()) {
                $roles[] = $membership->role;
            }
        }

        return array_values(array_unique($roles, SORT_REGULAR));
    }

    /**
     * Asesmen yang boleh dilihat pengguna. Selalu dipakai sebagai dasar kueri daftar asesmen.
     *
     * @return Builder<Assessment>
     */
    public static function visibleTo(User $user): Builder
    {
        $query = Assessment::query();
        if ($user->is_super_admin) {
            return $query;
        }

        $clientOrganizations = $user->memberships
            ->filter(fn ($membership) => $membership->role->isClient())
            ->pluck('organization_id')
            ->all();
        $assigned = $user->teamAssignments->pluck('assessment_id')->all();

        return $query->where(function (Builder $q) use ($clientOrganizations, $assigned) {
            $q->whereIn('organization_id', $clientOrganizations)->orWhereIn('id', $assigned);
        });
    }

    /**
     * Peran pengguna pada asesmen ini. Pengguna tanpa peran menerima 404, bukan 403, agar keberadaan asesmen
     * milik organisasi lain tidak terungkap.
     *
     * @return list<Role>
     */
    public static function requireMember(User $user, Assessment $assessment): array
    {
        $roles = self::rolesFor($user, $assessment);
        if ($roles === []) {
            throw new NotFoundHttpException;
        }

        return $roles;
    }

    /**
     * Peran pengguna pada asesmen ini, atau 403 bila tidak berhak atas sumber daya tersebut.
     *
     * @param  'read'|'write'  $mode
     * @return list<Role>
     */
    public static function require(User $user, Assessment $assessment, Resource $resource, string $mode = 'read'): array
    {
        $roles = self::requireMember($user, $assessment);
        $allowed = $mode === 'write' ? Permissions::canWrite($roles, $resource) : Permissions::canRead($roles, $resource);
        if (! $allowed) {
            throw new HttpException(403);
        }

        return $roles;
    }
}
