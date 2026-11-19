<?php

declare(strict_types=1);

namespace App\Domain\Progress;

use App\Domain\Setup\ConditionResult;
use App\Domain\Workflow\AssessmentStatus;
use App\Domain\Workflow\Stage;
use DateTimeImmutable;

/**
 * Penghitung progres pengukuran untuk dasbor beranda (fase R1). Murni: tanggal hari ini diberikan pemanggil.
 *
 * Progres tidak diringkas menjadi satu persentase karena bobot setiap tahap berbeda dan sebagian besar ukurannya baru
 * tersedia setelah modulnya dibangun. Yang dihitung: tahap saat ini, kesiapan menuju status berikutnya, jadwal, dan
 * penanda yang perlu ditindaklanjuti.
 */
final class ProgressCalculator
{
    /** Penanda "periode segera berakhir" bila sisa periode sebanyak ini hari atau kurang. */
    public const ENDING_SOON_DAYS = 14;

    public static function schedule(DateTimeImmutable $start, DateTimeImmutable $end, DateTimeImmutable $today): Schedule
    {
        $day = static fn (DateTimeImmutable $d): int => intdiv($d->setTime(0, 0)->getTimestamp(), 86400);
        $s = $day($start);
        $e = $day($end);
        $t = $day($today);
        $total = max(1, $e - $s + 1);
        $phase = $t < $s ? 'notStarted' : ($t > $e ? 'ended' : 'running');
        $elapsed = $phase === 'notStarted' ? 0.0 : ($phase === 'ended' ? 1.0 : ($t - $s + 1) / $total);

        return new Schedule($phase, $elapsed, $e - $t, $total);
    }

    /**
     * Kesiapan menuju status berikutnya: syarat yang terpenuhi, yang dapat diperiksa, dan seluruhnya.
     *
     * @param  list<ConditionResult>  $conditions
     * @return array{met: int, checkable: int, total: int}
     */
    public static function readiness(array $conditions): array
    {
        $checkable = array_filter($conditions, static fn (ConditionResult $c): bool => $c->met !== null);
        $met = array_filter($conditions, static fn (ConditionResult $c): bool => $c->met === true);

        return ['met' => count($met), 'checkable' => count($checkable), 'total' => count($conditions)];
    }

    /**
     * Penanda yang perlu ditindaklanjuti pengelola. Kunci teks: dashboard.attention.*.
     *
     * @param  array{met: int, checkable: int, total: int}  $readiness
     * @return list<string>
     */
    public static function attention(AssessmentStatus $status, Schedule $schedule, array $readiness): array
    {
        if ($status->isClosed()) {
            return [];
        }
        $flags = [];
        $reported = $status->position() >= AssessmentStatus::Reported->position();
        if ($schedule->phase === 'ended' && ! $reported) {
            $flags[] = 'periodEnded';
        } elseif ($schedule->phase === 'running' && ! $reported && $schedule->daysRemaining <= self::ENDING_SOON_DAYS) {
            $flags[] = 'endingSoon';
        }
        if ($schedule->phase !== 'notStarted' && Stage::of($status) === Stage::Planning) {
            $flags[] = 'planningLate';
        }
        if ($readiness['total'] > 0 && $readiness['met'] === $readiness['total']) {
            $flags[] = 'readyToAdvance';
        }

        return $flags;
    }
}
