<?php

declare(strict_types=1);

namespace App\Domain\Evidence;

use App\Domain\Workflow\AssessmentStatus;

/** Aturan waktu dan cakupan unggah bukti (docs/01 M5), dibawa dari v1 src/lib/evidence/service.ts. */
final class EvidenceRules
{
    public const TITLE_MIN = 2;

    public const TITLE_MAX = 300;

    public const DESCRIPTION_MAX = 2000;

    /**
     * Bukti dapat diunggah sejak parameter dikunci sampai rapat panel, karena validasi lapangan dan panel dapat meminta
     * bukti tambahan.
     */
    public static function uploadOpen(AssessmentStatus $status): bool
    {
        return in_array($status, [
            AssessmentStatus::Locked,
            AssessmentStatus::DataCollection,
            AssessmentStatus::Validation,
            AssessmentStatus::Scoring,
            AssessmentStatus::PanelReview,
        ], true);
    }

    /**
     * Koordinator unit hanya mengunggah untuk unit dalam cakupannya; bukti tingkat organisasi (tanpa unit) hanya oleh
     * administrator klien.
     *
     * @param  list<string>|null  $unitScope  null bila tidak dibatasi unit
     */
    public static function unitAllowed(?array $unitScope, ?string $unitId): bool
    {
        return $unitScope === null || ($unitId !== null && in_array($unitId, $unitScope, true));
    }
}
