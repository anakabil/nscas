<?php

declare(strict_types=1);

namespace App\Domain\Workflow;

/**
 * Enam tahap penilaian budaya K3 (docs/12 bagian 4). Tahap adalah pengelompokan status untuk manusia:
 * menu beranda, penanda kemajuan, dan laporan memakai tahap; aturan transisi tetap memakai status.
 */
enum Stage: string
{
    case Planning = 'PLANNING';
    case DataCollection = 'DATA_COLLECTION';
    case Validation = 'VALIDATION';
    case Rating = 'RATING';
    case Reporting = 'REPORTING';
    case Monitoring = 'MONITORING';

    /** Nomor tahap, 1 sampai 6. */
    public function number(): int
    {
        return (int) array_search($this, self::cases(), true) + 1;
    }

    /** @return list<AssessmentStatus> */
    public function statuses(): array
    {
        return match ($this) {
            self::Planning => [AssessmentStatus::Draft, AssessmentStatus::Configured],
            self::DataCollection => [AssessmentStatus::Locked, AssessmentStatus::DataCollection],
            self::Validation => [AssessmentStatus::Validation],
            self::Rating => [AssessmentStatus::Scoring, AssessmentStatus::PanelReview],
            self::Reporting => [AssessmentStatus::ActionPlanning, AssessmentStatus::Reported],
            self::Monitoring => [AssessmentStatus::Monitoring],
        };
    }

    /** Tahap yang memuat status ini; null bila asesmen sudah ditutup (ARCHIVED, PURGED). */
    public static function of(AssessmentStatus $status): ?self
    {
        foreach (self::cases() as $stage) {
            if (in_array($status, $stage->statuses(), true)) {
                return $stage;
            }
        }

        return null;
    }

    public function stateFor(AssessmentStatus $status): StageState
    {
        $current = self::of($status);
        if ($current === null) {
            return StageState::Done;
        }

        return match ($this->number() <=> $current->number()) {
            -1 => StageState::Done,
            0 => StageState::Current,
            default => StageState::Upcoming,
        };
    }
}
