<?php

declare(strict_types=1);

namespace App\Domain\Access;

/**
 * Peran pengguna NSCAS (docs/01 bagian 2). SUPER_ADMIN, LEAD_ASSESSOR, dan ASSESSOR milik Nusa Safety
 * (organisasi operator); tiga peran lain milik organisasi klien.
 */
enum Role: string
{
    case SuperAdmin = 'SUPER_ADMIN';
    case LeadAssessor = 'LEAD_ASSESSOR';
    case Assessor = 'ASSESSOR';
    case ClientAdmin = 'CLIENT_ADMIN';
    case UnitCoordinator = 'UNIT_COORDINATOR';
    case ExecutiveViewer = 'EXECUTIVE_VIEWER';

    /** Peran milik Nusa Safety; hanya sah di organisasi operator. */
    public function isOperator(): bool
    {
        return in_array($this, [self::SuperAdmin, self::LeadAssessor, self::Assessor], true);
    }

    /** Peran milik klien; hanya sah di organisasi klien. */
    public function isClient(): bool
    {
        return ! $this->isOperator();
    }

    /** Verifikasi dua langkah wajib untuk peran ini (docs/04 bagian 3). */
    public function requiresTwoFactor(): bool
    {
        return in_array($this, [self::SuperAdmin, self::LeadAssessor, self::Assessor, self::ClientAdmin], true);
    }

    /** Keanggotaan sah bila peran operator berada di organisasi operator dan peran klien di organisasi klien. */
    public function isValidFor(bool $organizationIsOperator): bool
    {
        return $organizationIsOperator ? $this->isOperator() : $this->isClient();
    }

    /**
     * Urutan untuk menentukan peran utama pengguna yang memiliki lebih dari satu peran.
     *
     * @return list<self>
     */
    public static function byPrecedence(): array
    {
        return [self::SuperAdmin, self::LeadAssessor, self::Assessor, self::ClientAdmin, self::UnitCoordinator, self::ExecutiveViewer];
    }

    /**
     * @param  iterable<self>  $roles
     */
    public static function primary(iterable $roles): ?self
    {
        $held = [];
        foreach ($roles as $role) {
            $held[$role->value] = true;
        }
        foreach (self::byPrecedence() as $role) {
            if (isset($held[$role->value])) {
                return $role;
            }
        }

        return null;
    }
}
