<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Tanda mutu jawaban survei (docs/03 bagian 8). Ditandai otomatis; dikeluarkan hanya setelah ditinjau asesor. */
enum QualityFlag: string
{
    case PolaSeragam = 'POLA_SERAGAM';
    case TerlaluCepat = 'TERLALU_CEPAT';
    case BanyakTidakTahu = 'BANYAK_TIDAK_TAHU';

    /**
     * @param  list<self>  $flags
     * @return list<string>
     */
    public static function values(array $flags): array
    {
        return array_map(static fn (self $flag): string => $flag->value, array_values($flags));
    }
}
