<?php

declare(strict_types=1);

namespace App\Domain\Survey;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;

/** Aturan waktu dan urutan survei (docs/02 bagian 4), dibawa dari v1 src/lib/survey/rules.ts dan tokens.ts. */
final class SurveyRules
{
    /** Waktu pada token dibulatkan ke jam terdekat agar tidak dapat dicocokkan dengan jawaban. */
    public static function roundToNearestHour(DateTimeInterface $at): DateTimeImmutable
    {
        $seconds = $at->getTimestamp();

        return (new DateTimeImmutable('@'.(int) (round($seconds / 3600) * 3600)))->setTimezone($at->getTimezone());
    }

    /** Tanggal kalender WIB tanpa jam (Y-m-d) untuk tanggal kirim jawaban. */
    public static function wibDate(DateTimeInterface $at): string
    {
        return DateTimeImmutable::createFromInterface($at)->setTimezone(new DateTimeZone('Asia/Jakarta'))->format('Y-m-d');
    }

    /**
     * Urutan acak yang tetap untuk satu responden: butir diurutkan menurut SHA-256 dari benih (hash token) dan id
     * butir. Urutan yang sama muncul setiap kali tautan dibuka, tetapi berbeda antarresponden.
     *
     * @template T of array{id: string, ...}
     *
     * @param  list<T>  $items
     * @return list<T>
     */
    public static function respondentOrder(array $items, string $seed): array
    {
        $keyed = array_map(static fn (array $item): array => [hash('sha256', $seed.':'.$item['id']), $item], $items);
        usort($keyed, static fn (array $a, array $b): int => strcmp($a[0], $b[0]));

        return array_map(static fn (array $pair): array => $pair[1], $keyed);
    }
}
