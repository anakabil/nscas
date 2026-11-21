<?php

declare(strict_types=1);

namespace App\Domain\Access;

/**
 * Matriks hak akses docs/04 bagian 2, ditulis sebagai data agar dapat diuji. "read" memuat peran dengan hak
 * baca atau ubah; "write" memuat peran dengan hak ubah. Catatan dalam kurung di docs/04 ("unitnya", "miliknya",
 * "tanpa identitas", "agregat") ditegakkan oleh penjaga akses dan oleh kueri tiap fitur, bukan di sini.
 */
final class Permissions
{
    /** @return array{read: list<Role>, write: list<Role>} */
    public static function of(Resource $resource): array
    {
        [$sa, $la, $as, $ca, $uc, $ev] = Role::byPrecedence();

        return match ($resource) {
            Resource::OrganizationsAndUsers => ['read' => [$sa, $la, $ca], 'write' => [$sa, $ca]],
            Resource::ParametersBeforeLock => ['read' => [$sa, $la, $as, $ca], 'write' => [$la]],
            Resource::ParametersAfterLock => ['read' => [$sa, $la, $as, $ca, $ev], 'write' => []],
            Resource::Roster => ['read' => [$la, $ca, $uc], 'write' => [$ca, $uc]],
            Resource::TokensAndParticipation => ['read' => [$sa, $la, $as, $ca, $uc, $ev], 'write' => [$ca]],
            Resource::RawSurveyAnswers => ['read' => [$la, $as], 'write' => []],
            Resource::SelfAssessments => ['read' => [$la, $as, $ca], 'write' => []],
            Resource::EvidenceAndObservations => ['read' => [$la, $as, $ca, $uc], 'write' => [$ca, $uc]],
            Resource::AssessorRatings => ['read' => [$la, $as], 'write' => [$la, $as]],
            Resource::PanelAndFinalization => ['read' => [$la, $as], 'write' => [$la]],
            Resource::ResultsDashboard => ['read' => [$la, $as, $ca, $uc, $ev], 'write' => []],
            Resource::ActionPlans => ['read' => [$la, $as, $ca, $uc, $ev], 'write' => [$la, $as, $ca, $uc]],
            Resource::Reports => ['read' => [$la, $as, $ca, $ev], 'write' => [$la]],
            Resource::AuditTrail => ['read' => [$sa, $la, $ca], 'write' => []],
        };
    }

    /**
     * Apakah akses pengguna pada sumber daya ini dibatasi ke unitnya: ya bila setiap peran yang memberi hak (baca
     * atau ubah) atas sumber daya itu adalah koordinator unit. Peran lain yang tidak memberi hak atas sumber daya
     * itu tidak melonggarkan batas unit. Bila tidak ada peran yang memberi hak, hasilnya juga ya (paling ketat).
     *
     * @param  iterable<Role>  $roles
     */
    public static function unitRestricted(iterable $roles, Resource $resource, bool $write = false): bool
    {
        $allowed = self::of($resource)[$write ? 'write' : 'read'];
        foreach ($roles as $role) {
            if ($role !== Role::UnitCoordinator && in_array($role, $allowed, true)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  iterable<Role>  $roles
     */
    public static function canRead(iterable $roles, Resource $resource): bool
    {
        return self::intersects($roles, self::of($resource)['read']);
    }

    /**
     * @param  iterable<Role>  $roles
     */
    public static function canWrite(iterable $roles, Resource $resource): bool
    {
        return self::intersects($roles, self::of($resource)['write']);
    }

    /**
     * @param  iterable<Role>  $held
     * @param  list<Role>  $allowed
     */
    private static function intersects(iterable $held, array $allowed): bool
    {
        foreach ($held as $role) {
            if (in_array($role, $allowed, true)) {
                return true;
            }
        }

        return false;
    }
}
