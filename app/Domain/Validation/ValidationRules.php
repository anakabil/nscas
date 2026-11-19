<?php

declare(strict_types=1);

namespace App\Domain\Validation;

use App\Domain\Workflow\AssessmentStatus;

/** Aturan validasi lapangan (docs/01 M7, docs/12 tahap 3), dibawa dari v1 src/lib/validation. Murni. */
final class ValidationRules
{
    public const MAX_FOCUS_GROUP_PARTICIPANTS = 8;

    /** Nilai validasi 1,0 sampai 5,0 kelipatan 0,5. */
    public const RATING_LEVELS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];

    public const NOTE_MAX = 10_000;

    /** Sesi disusun sejak parameter dikunci sampai validasi berakhir. */
    public static function planningOpen(AssessmentStatus $status): bool
    {
        return in_array($status, [AssessmentStatus::Locked, AssessmentStatus::DataCollection, AssessmentStatus::Validation], true);
    }

    /** Sesi dilaksanakan dan dinilai pada tahap validasi; nilai masih dapat dilengkapi saat penilaian, terkunci sejak rapat panel. */
    public static function ratingOpen(AssessmentStatus $status): bool
    {
        return $status === AssessmentStatus::Validation || $status === AssessmentStatus::Scoring;
    }

    public static function isValidRating(float $level): bool
    {
        return $level >= 1.0 && $level <= 5.0 && abs($level * 2 - round($level * 2)) < 1e-9;
    }

    /**
     * Semua sesi yang tidak dibatalkan sudah selesai, dan paling sedikit satu sesi selesai memiliki nilai.
     *
     * @param  list<array{status: string, ratings: int}>  $sessions
     */
    public static function sessionsCompleted(array $sessions): bool
    {
        $active = array_values(array_filter($sessions, fn (array $s) => $s['status'] !== 'CANCELLED'));
        if ($active === []) {
            return false;
        }
        foreach ($active as $s) {
            if ($s['status'] !== 'COMPLETED') {
                return false;
            }
        }

        return array_filter($active, fn (array $s) => $s['ratings'] > 0) !== [];
    }

    /**
     * Rencana validasi tersusun: ada sesi wawancara atau diskusi kelompok dengan karakteristik fokus, dan paling
     * sedikit satu kunjungan fisik direncanakan (D6).
     *
     * @param  list<array{type: string, status: string, focus: int}>  $sessions
     */
    public static function planSet(array $sessions): bool
    {
        $active = array_filter($sessions, fn (array $s) => $s['status'] !== 'CANCELLED');
        $talks = array_filter($active, fn (array $s) => in_array($s['type'], [SessionProposal::INTERVIEW, SessionProposal::FOCUS_GROUP], true) && $s['focus'] > 0);
        $visits = array_filter($active, fn (array $s) => $s['type'] === SessionProposal::SITE_VISIT);

        return $talks !== [] && $visits !== [];
    }
}
