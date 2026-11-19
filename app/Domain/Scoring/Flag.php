<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Tanda pada hasil karakteristik (docs/03 bagian 2, 3, dan 9). Nilai string sama dengan yang tertulis di dokumen. */
enum Flag: string
{
    case SelisihPersepsiBukti = 'SELISIH_PERSEPSI_BUKTI';
    case LapisanTidakLengkap = 'LAPISAN_TIDAK_LENGKAP';
    case SemuaLapisanKosong = 'SEMUA_LAPISAN_KOSONG';
    case PenilaiTunggal = 'PENILAI_TUNGGAL';
    case PerluRekonsiliasi = 'PERLU_REKONSILIASI';

    /**
     * @param  list<self>  $flags
     * @return list<string>
     */
    public static function values(array $flags): array
    {
        return array_map(static fn (self $flag): string => $flag->value, array_values($flags));
    }
}
