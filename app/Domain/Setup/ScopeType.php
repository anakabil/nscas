<?php

declare(strict_types=1);

namespace App\Domain\Setup;

/** Lingkup asesmen (docs/01 M1). */
enum ScopeType: string
{
    case Corporate = 'CORPORATE';
    case Division = 'DIVISION';
    case Project = 'PROJECT';
}
