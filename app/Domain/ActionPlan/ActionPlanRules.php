<?php

declare(strict_types=1);

namespace App\Domain\ActionPlan;

use App\Domain\Workflow\AssessmentStatus;
use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;

/**
 * Daftar kesenjangan, rencana aksi, dan pemantauan (docs/01 M10), dibawa dari v1 src/lib/action-plan/rules.ts.
 * Murni.
 */
final class ActionPlanRules
{
    public const OPEN = ['PLANNED', 'IN_PROGRESS'];

    public const STATUSES = ['PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'VERIFIED'];

    /** Status yang boleh dipilih pelaksana pada pembaruan kemajuan; VERIFIED hanya lewat verifikasi asesor. */
    public const UPDATE_STATUSES = ['PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED'];

    public const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];

    public const DUE_SOON_DAYS = 7;

    public const REMINDER_INTERVAL_DAYS = 7;

    private const EPS = 1e-9;

    /** Rencana aksi disusun dan dipantau sejak hasil ditetapkan sampai pemantauan selesai. */
    public static function planOpen(AssessmentStatus $status): bool
    {
        return in_array($status, [AssessmentStatus::ActionPlanning, AssessmentStatus::Reported, AssessmentStatus::Monitoring], true);
    }

    public static function publishOpen(AssessmentStatus $status): bool
    {
        return $status === AssessmentStatus::ActionPlanning || $status === AssessmentStatus::Reported;
    }

    /**
     * Karakteristik dengan nilai akhir (nilai panel bila ada) di bawah tingkat sasaran, diurutkan menurut bobot aspek
     * dikali besar kesenjangan. Karakteristik kontekstual tidak berbobot aspek sehingga berada di akhir daftar. Seri
     * diputus menurut kesenjangan, lalu kode.
     *
     * @param  list<array{code: string, aspectCode: string, isContextual: bool, final: float|null, panelAdjusted: float|null}>  $characteristics
     * @param  array<string, float>  $aspectWeights
     * @return list<array{code: string, aspectCode: string, isContextual: bool, currentIndex: float, gap: float, aspectWeight: float, priorityScore: float, rank: int}>
     */
    public static function gapList(array $characteristics, array $aspectWeights, float $targetLevel): array
    {
        $out = [];
        foreach ($characteristics as $c) {
            $value = $c['panelAdjusted'] ?? $c['final'];
            if ($value === null || $value >= $targetLevel - self::EPS) {
                continue;
            }
            $weight = $c['isContextual'] ? 0.0 : (float) ($aspectWeights[$c['aspectCode']] ?? 0.0);
            $gap = $targetLevel - (float) $value;
            $out[] = [
                'code' => $c['code'],
                'aspectCode' => $c['aspectCode'],
                'isContextual' => $c['isContextual'],
                'currentIndex' => (float) $value,
                'gap' => $gap,
                'aspectWeight' => $weight,
                'priorityScore' => $weight * $gap,
                'rank' => 0,
            ];
        }
        usort($out, fn (array $a, array $b) => $b['priorityScore'] <=> $a['priorityScore'] ?: $b['gap'] <=> $a['gap'] ?: strcmp($a['code'], $b['code']));
        foreach ($out as $i => &$row) {
            $row['rank'] = $i + 1;
        }

        return $out;
    }

    /** Tanggal kalender WIB sebagai yyyy-mm-dd. */
    public static function wibDay(DateTimeInterface $at): string
    {
        return DateTimeImmutable::createFromInterface($at)->setTimezone(new DateTimeZone('Asia/Jakarta'))->format('Y-m-d');
    }

    /** Triwulan dari tanggal tenggat, misalnya 2026-Q4. */
    public static function quarterOf(string $dueDate): string
    {
        [$year, $month] = array_map('intval', explode('-', $dueDate));

        return sprintf('%d-Q%d', $year, intdiv($month - 1, 3) + 1);
    }

    /** @return 'closed'|'overdue'|'dueSoon'|'onTrack' */
    public static function dueState(string $status, string $dueDate, DateTimeInterface $now): string
    {
        if (! in_array($status, self::OPEN, true)) {
            return 'closed';
        }
        $today = self::wibDay($now);
        if ($dueDate < $today) {
            return 'overdue';
        }
        $days = (strtotime($dueDate.' 00:00:00 UTC') - strtotime($today.' 00:00:00 UTC')) / 86400;

        return $days <= self::DUE_SOON_DAYS ? 'dueSoon' : 'onTrack';
    }

    /** Pengingat untuk tindakan terbuka yang mendekati atau melewati tenggat, paling sering seminggu sekali. */
    public static function reminderDue(string $status, string $dueDate, ?DateTimeInterface $lastReminderAt, DateTimeInterface $now): bool
    {
        $state = self::dueState($status, $dueDate, $now);
        if ($state !== 'overdue' && $state !== 'dueSoon') {
            return false;
        }

        return $lastReminderAt === null || $lastReminderAt->getTimestamp() <= $now->getTimestamp() - self::REMINDER_INTERVAL_DAYS * 86400;
    }

    /**
     * Kesenjangan yang belum siap diterbitkan: tanpa analisis penyebab atau tanpa tindakan yang tidak dibatalkan.
     *
     * @param  list<array{code: string, rootCause: string|null, activeActions: int}>  $gaps
     * @return list<string>
     */
    public static function incomplete(array $gaps): array
    {
        return array_values(array_map(fn (array $g) => $g['code'], array_filter($gaps, fn (array $g) => trim((string) $g['rootCause']) === '' || $g['activeActions'] === 0)));
    }

    /**
     * Pemantauan selesai: setiap tindakan sudah diverifikasi atau dibatalkan, dan tinjauan penutup tercatat.
     *
     * @param  list<string>  $actionStatuses
     */
    public static function monitoringClosed(array $actionStatuses, bool $closingReview): bool
    {
        if (! $closingReview || $actionStatuses === []) {
            return false;
        }
        foreach ($actionStatuses as $s) {
            if ($s !== 'VERIFIED' && $s !== 'CANCELLED') {
                return false;
            }
        }

        return true;
    }
}
