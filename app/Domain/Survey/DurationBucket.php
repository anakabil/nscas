<?php

declare(strict_types=1);

namespace App\Domain\Survey;

/**
 * Durasi pengisian hanya disimpan sebagai rentang lima menit agar tidak dapat dicocokkan dengan waktu token
 * (docs/02 bagian 4 butir 3). Dibawa dari v1 src/lib/survey/rules.ts.
 */
enum DurationBucket: string
{
    case Under5 = 'UNDER_5';
    case From5To10 = 'FROM_5_TO_10';
    case From10To15 = 'FROM_10_TO_15';
    case From15To20 = 'FROM_15_TO_20';
    case Over20 = 'OVER_20';

    /** Perkiraan durasi yang disampaikan kepada responden (surel, lembar kode QR, layar pengantar). */
    public const NOMINAL_MINUTES = 15;

    /** Median dari rentang baru dipakai setelah cukup banyak jawaban; sebelumnya memakai durasi nominal. */
    public const MIN_RESPONSES_FOR_MEDIAN = 10;

    public static function fromSeconds(int $seconds): self
    {
        $minutes = $seconds / 60;

        return match (true) {
            $minutes < 5 => self::Under5,
            $minutes < 10 => self::From5To10,
            $minutes < 15 => self::From10To15,
            $minutes < 20 => self::From15To20,
            default => self::Over20,
        };
    }

    /** Titik tengah rentang (menit); rentang terbuka di atas 20 dianggap 25. */
    public function midpointMinutes(): float
    {
        return match ($this) {
            self::Under5 => 2.5,
            self::From5To10 => 7.5,
            self::From10To15 => 12.5,
            self::From15To20 => 17.5,
            self::Over20 => 25.0,
        };
    }

    /**
     * Median durasi asesmen untuk tanda TERLALU_CEPAT, ditaksir dari titik tengah rentang jawaban yang sudah masuk
     * karena durasi tepat tidak pernah disimpan.
     *
     * @param  array<string, int>  $counts  Kunci nilai enum => jumlah jawaban.
     */
    public static function estimatedMedianMinutes(array $counts): float
    {
        $total = 0;
        foreach (self::cases() as $bucket) {
            $total += $counts[$bucket->value] ?? 0;
        }
        if ($total < self::MIN_RESPONSES_FOR_MEDIAN) {
            return (float) self::NOMINAL_MINUTES;
        }
        $half = $total / 2;
        $seen = 0;
        $cases = self::cases();
        foreach ($cases as $i => $bucket) {
            $n = $counts[$bucket->value] ?? 0;
            // Jumlah genap yang tepat terbelah di batas rentang: rata-rata dua titik tengah.
            if ($seen + $n === $half && $n > 0) {
                foreach (array_slice($cases, $i + 1) as $next) {
                    if (($counts[$next->value] ?? 0) > 0) {
                        return ($bucket->midpointMinutes() + $next->midpointMinutes()) / 2;
                    }
                }

                return $bucket->midpointMinutes();
            }
            if ($seen + $n > $half) {
                return $bucket->midpointMinutes();
            }
            $seen += $n;
        }

        return (float) self::NOMINAL_MINUTES;
    }
}
