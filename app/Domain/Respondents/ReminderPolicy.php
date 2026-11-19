<?php

declare(strict_types=1);

namespace App\Domain\Respondents;

use DateTimeImmutable;
use DateTimeInterface;

/**
 * Pengingat survei (docs/01 M2): hanya untuk undangan surel, paling banyak tiga kali per responden, dengan jarak paling
 * sedikit tiga hari sejak undangan atau pengingat sebelumnya. Dibawa dari v1 src/lib/jobs/reminders.ts.
 */
final class ReminderPolicy
{
    public const MAX_REMINDERS = 3;

    public const GAP_DAYS = 3;

    public static function eligible(
        ?string $channel,
        ?DateTimeInterface $revokedAt,
        ?DateTimeInterface $completedAt,
        int $reminderCount,
        DateTimeInterface $issuedAt,
        ?DateTimeInterface $lastReminderAt,
        DateTimeInterface $now,
    ): bool {
        if ($channel !== 'EMAIL' || $revokedAt !== null || $completedAt !== null || $reminderCount >= self::MAX_REMINDERS) {
            return false;
        }
        $since = DateTimeImmutable::createFromInterface($lastReminderAt ?? $issuedAt);

        return $since->modify('+'.self::GAP_DAYS.' days') <= DateTimeImmutable::createFromInterface($now);
    }
}
