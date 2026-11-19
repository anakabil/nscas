<?php

declare(strict_types=1);

namespace App\Domain\Setup;

/**
 * Kesiapan organisasi sebelum pengukuran (docs/12 temuan T2, IAEA 2016): komitmen pimpinan tercatat, pekerja telah
 * diberi penjelasan tujuan dan jaminan kerahasiaan, dan seluruh tim asesor telah dikalibrasi.
 */
final class Kickoff
{
    /**
     * Komitmen pimpinan dan penjelasan kepada pekerja sama-sama tercatat lengkap.
     *
     * @param  array<string, mixed>|null  $kickoff
     */
    public static function isComplete(?array $kickoff): bool
    {
        $leadership = $kickoff['leadership'] ?? [];
        $briefing = $kickoff['briefing'] ?? [];

        return self::filled($leadership['date'] ?? null)
            && self::filled($leadership['leader'] ?? null)
            && self::filled($briefing['date'] ?? null)
            && self::filled($briefing['note'] ?? null);
    }

    /**
     * Kalibrasi tercatat dan diikuti seluruh anggota tim asesor saat ini. Anggota yang ditugaskan setelah kalibrasi
     * membuat syarat ini kembali belum terpenuhi sampai kehadirannya dicatat.
     *
     * @param  array<string, mixed>|null  $calibration
     * @param  list<int>  $teamUserIds
     */
    public static function calibrationComplete(?array $calibration, array $teamUserIds): bool
    {
        if ($teamUserIds === [] || ! self::filled($calibration['date'] ?? null)) {
            return false;
        }
        $attended = array_map('intval', $calibration['attendees'] ?? []);

        return array_diff($teamUserIds, $attended) === [];
    }

    private static function filled(mixed $value): bool
    {
        return is_string($value) && trim($value) !== '';
    }
}
