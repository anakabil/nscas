<?php

declare(strict_types=1);

namespace App\Domain\Respondents;

use App\Domain\Workflow\AssessmentStatus;
use DateTimeInterface;

/** Survei terbuka hanya selama pengumpulan data dan di dalam jendela survei bila jendela diisi. */
final class SurveyWindow
{
    public static function isOpen(AssessmentStatus $status, ?DateTimeInterface $opensAt, ?DateTimeInterface $closesAt, DateTimeInterface $now): bool
    {
        return $status === AssessmentStatus::DataCollection
            && ($opensAt === null || $opensAt <= $now)
            && ($closesAt === null || $closesAt > $now);
    }

    /** Daftar responden dan token dikelola setelah parameter dikunci dan selama pengumpulan data. */
    public static function distributionOpen(AssessmentStatus $status): bool
    {
        return $status === AssessmentStatus::Locked || $status === AssessmentStatus::DataCollection;
    }
}
