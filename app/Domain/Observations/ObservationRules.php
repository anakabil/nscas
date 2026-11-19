<?php

declare(strict_types=1);

namespace App\Domain\Observations;

use App\Domain\Workflow\AssessmentStatus;
use DateTimeInterface;

/**
 * Aturan masa observasi (docs/01 M6), dibawa dari v1 src/lib/observations/service.ts. Unggahan di luar masa
 * observasi ditolak; di luar radius diterima tetapi ditandai.
 */
final class ObservationRules
{
    public const TITLE_MIN = 2;

    public const TITLE_MAX = 200;

    public const RADIUS_MIN = 10;

    public const RADIUS_MAX = 50_000;

    public const CHECKLIST_MAX_ITEMS = 50;

    public const CHECKLIST_LABEL_MAX = 300;

    public const NOTE_MAX = 1000;

    /** Masa observasi dibuat dan dipakai selama asesmen dikunci atau mengumpulkan data. */
    public static function statusAllows(AssessmentStatus $status): bool
    {
        return $status === AssessmentStatus::Locked || $status === AssessmentStatus::DataCollection;
    }

    public static function windowOpen(AssessmentStatus $status, DateTimeInterface $opensAt, DateTimeInterface $closesAt, DateTimeInterface $now): bool
    {
        return self::statusAllows($status) && $opensAt <= $now && $closesAt > $now;
    }

    /**
     * Daftar periksa observasi dari isian satu butir per baris; kode O1, O2, dan seterusnya. Baris kosong dilewati.
     *
     * @return list<array{code: string, label: string}>
     */
    public static function parseChecklist(string $text): array
    {
        $lines = array_values(array_filter(array_map('trim', preg_split('/\r?\n/', $text) ?: []), fn (string $l) => $l !== ''));
        $items = [];
        foreach (array_slice($lines, 0, self::CHECKLIST_MAX_ITEMS) as $i => $label) {
            $items[] = ['code' => 'O'.($i + 1), 'label' => mb_substr($label, 0, self::CHECKLIST_LABEL_MAX)];
        }

        return $items;
    }
}
