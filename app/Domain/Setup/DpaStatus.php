<?php

declare(strict_types=1);

namespace App\Domain\Setup;

/**
 * Status perjanjian pemrosesan data dengan klien (docs/04 bagian 1.1). Asesmen hanya dapat dikunci setelah perjanjian
 * ditandatangani, karena setelah dikunci daftar responden mulai diimpor.
 */
enum DpaStatus: string
{
    case NotStarted = 'NOT_STARTED';
    case InProgress = 'IN_PROGRESS';
    case Signed = 'SIGNED';
}
