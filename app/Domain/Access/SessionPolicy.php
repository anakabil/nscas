<?php

declare(strict_types=1);

namespace App\Domain\Access;

/**
 * Batas sesi masuk (docs/04 bagian 3): sesi berakhir 8 jam sejak masuk untuk semua pengguna, dan setelah 30 menit
 * tanpa aktivitas untuk pengguna Nusa Safety (pengelola sistem dan anggota organisasi operator), yang memegang akses
 * ke data banyak klien. Murni.
 */
final class SessionPolicy
{
    public const ABSOLUTE_SECONDS = 8 * 3600;

    public const STRICT_IDLE_SECONDS = 30 * 60;

    /** 'absolute' bila melewati batas 8 jam, 'idle' bila melewati batas tanpa aktivitas, null bila sesi masih sah. */
    public static function expiry(int $startedAt, int $lastSeenAt, int $now, bool $strictIdle): ?string
    {
        if ($now - $startedAt >= self::ABSOLUTE_SECONDS) {
            return 'absolute';
        }
        if ($strictIdle && $now - $lastSeenAt >= self::STRICT_IDLE_SECONDS) {
            return 'idle';
        }

        return null;
    }
}
