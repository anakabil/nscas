<?php

declare(strict_types=1);

namespace App\Domain\Respondents;

use App\Domain\Workflow\AssessmentStatus;
use DateTimeInterface;

/** Survei terbuka hanya selama pengumpulan data dan di dalam masa survei bila masa survei diisi. */
final class SurveyWindow
{
    public static function isOpen(AssessmentStatus $status, ?DateTimeInterface $opensAt, ?DateTimeInterface $closesAt, DateTimeInterface $now): bool
    {
        return $status === AssessmentStatus::DataCollection
            && ($opensAt === null || $opensAt <= $now)
            && ($closesAt === null || $closesAt > $now);
    }

    /**
     * Keadaan masa survei untuk responden: OPEN, NOT_OPEN (belum dimulai atau belum dibuka), atau CLOSED (sudah
     * ditutup, termasuk setelah asesmen melewati pengumpulan data).
     *
     * @return 'OPEN'|'NOT_OPEN'|'CLOSED'
     */
    public static function state(AssessmentStatus $status, ?DateTimeInterface $opensAt, ?DateTimeInterface $closesAt, DateTimeInterface $now): string
    {
        if ($status !== AssessmentStatus::DataCollection) {
            return $status->position() > AssessmentStatus::DataCollection->position() ? 'CLOSED' : 'NOT_OPEN';
        }
        if ($opensAt !== null && $opensAt > $now) {
            return 'NOT_OPEN';
        }

        return $closesAt !== null && $closesAt <= $now ? 'CLOSED' : 'OPEN';
    }

    /** Daftar responden dan token dikelola setelah parameter dikunci dan selama pengumpulan data. */
    public static function distributionOpen(AssessmentStatus $status): bool
    {
        return $status === AssessmentStatus::Locked || $status === AssessmentStatus::DataCollection;
    }
}
