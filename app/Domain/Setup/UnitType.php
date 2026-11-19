<?php

declare(strict_types=1);

namespace App\Domain\Setup;

/** Jenis unit yang diukur. Koordinat hanya untuk proyek, karena observasi digital dilakukan di lokasi proyek. */
enum UnitType: string
{
    case HeadOffice = 'HEAD_OFFICE';
    case Division = 'DIVISION';
    case Project = 'PROJECT';
    case Branch = 'BRANCH';

    public function hasCoordinates(): bool
    {
        return $this === self::Project;
    }
}
