<?php

declare(strict_types=1);

namespace App\Domain\Workflow;

/**
 * Status asesmen. Urutan case adalah urutan siklus (docs/01 bagian 3). VALIDATION ditambahkan pada rombak v2:
 * validasi lapangan dilakukan setelah survei ditutup dan temuan awal tersedia (docs/12 bagian 4).
 */
enum AssessmentStatus: string
{
    case Draft = 'DRAFT';
    case Configured = 'CONFIGURED';
    case Locked = 'LOCKED';
    case DataCollection = 'DATA_COLLECTION';
    case Validation = 'VALIDATION';
    case Scoring = 'SCORING';
    case PanelReview = 'PANEL_REVIEW';
    case ActionPlanning = 'ACTION_PLANNING';
    case Reported = 'REPORTED';
    case Monitoring = 'MONITORING';
    case Archived = 'ARCHIVED';
    case Purged = 'PURGED';

    /** Posisi dalam siklus, mulai dari 0. */
    public function position(): int
    {
        return (int) array_search($this, self::cases(), true);
    }

    /** Parameter, bobot, ambang, versi instrumen, dan strata tidak dapat diubah lagi (CLAUDE.md aturan 5). */
    public function parametersLocked(): bool
    {
        return $this->position() >= self::Locked->position();
    }

    /** Asesmen sudah ditutup: diarsipkan atau data mentahnya sudah dimusnahkan. */
    public function isClosed(): bool
    {
        return $this === self::Archived || $this === self::Purged;
    }

    /** Hasil sudah ditetapkan rapat panel, sehingga boleh ditampilkan kepada klien tanpa pita draf. */
    public function resultsFinal(): bool
    {
        return $this->position() >= self::ActionPlanning->position();
    }
}
