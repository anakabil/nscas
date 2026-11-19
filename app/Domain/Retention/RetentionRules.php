<?php

declare(strict_types=1);

namespace App\Domain\Retention;

use App\Domain\Workflow\AssessmentStatus;
use DateTimeImmutable;
use DateTimeInterface;

/**
 * Masa simpan data mentah (docs/04 bagian 7): bawaan 36 bulan sejak laporan final ditandatangani; bila laporan final
 * belum ada, sejak hasil ditetapkan rapat panel. Murni.
 */
final class RetentionRules
{
    public const DEFAULT_MONTHS = 36;

    /** Titik awal masa simpan; null bila hasil belum ditetapkan. */
    public static function baseline(?DateTimeInterface $finalReportSignedAt, ?DateTimeInterface $resultsFinalizedAt): ?DateTimeImmutable
    {
        $base = $finalReportSignedAt ?? $resultsFinalizedAt;

        return $base === null ? null : DateTimeImmutable::createFromInterface($base);
    }

    public static function dueAt(?DateTimeInterface $baseline, int $months): ?DateTimeImmutable
    {
        return $baseline === null ? null : DateTimeImmutable::createFromInterface($baseline)->modify(sprintf('+%d months', max(1, $months)));
    }

    public static function expired(?DateTimeInterface $dueAt, DateTimeInterface $now): bool
    {
        return $dueAt !== null && $dueAt <= $now;
    }

    /** Pemusnahan dijalankan pada asesmen yang sudah diarsipkan dan masa simpannya berakhir. */
    public static function destructionAllowed(AssessmentStatus $status, ?DateTimeInterface $dueAt, DateTimeInterface $now): bool
    {
        return $status === AssessmentStatus::Archived && self::expired($dueAt, $now);
    }
}
