<?php

declare(strict_types=1);

namespace App\Domain\Setup;

use App\Domain\Respondents\RosterValidator;

/**
 * Daftar nama jabatan organisasi pada setiap strata, misalnya "Site Manager" atau "Mandor". Dipakai sebagai contoh
 * pada pilihan kelompok jabatan di survei dan untuk memetakan kolom Jabatan pada impor daftar responden ke strata.
 * Nama jabatan tidak pernah disimpan pada jawaban survei. Murni.
 */
final class JobTitles
{
    public const MAX_TITLES = 40;

    public const MIN_LENGTH = 2;

    public const MAX_LENGTH = 80;

    /**
     * Isian dipisah per baris, koma, atau titik koma; spasi dirapikan, isian kosong dibuang, dan nama yang sama
     * (tanpa membedakan huruf besar) hanya diambil sekali.
     *
     * @param  string|list<mixed>|null  $input
     * @return list<string>
     */
    public static function parse(string|array|null $input): array
    {
        $parts = is_array($input) ? $input : preg_split('/[\r\n,;]+/u', (string) $input);
        $titles = [];
        foreach ($parts === false ? [] : $parts as $part) {
            $title = trim((string) preg_replace('/\s+/u', ' ', (string) $part));
            $key = RosterValidator::normalizeKey($title);
            if ($key !== '' && ! isset($titles[$key])) {
                $titles[$key] = $title;
            }
        }

        return array_values($titles);
    }

    /**
     * Kode galat isian satu strata, atau null bila sah.
     *
     * @param  list<string>  $titles
     */
    public static function error(array $titles): ?string
    {
        if (count($titles) > self::MAX_TITLES) {
            return 'JOB_TITLES_TOO_MANY';
        }
        foreach ($titles as $title) {
            $length = mb_strlen($title);
            if ($length < self::MIN_LENGTH || $length > self::MAX_LENGTH) {
                return 'JOB_TITLE_LENGTH';
            }
        }

        return null;
    }

    /**
     * Nama jabatan yang juga dipakai strata lain. Satu nama jabatan hanya boleh menunjuk satu strata agar pemetaan
     * impor tidak bermakna ganda.
     *
     * @param  list<string>  $titles  isian strata yang sedang diubah
     * @param  list<list<string>>  $others  daftar jabatan strata lain pada asesmen yang sama
     * @return list<string>
     */
    public static function conflicts(array $titles, array $others): array
    {
        $taken = [];
        foreach ($others as $list) {
            foreach ($list as $title) {
                $taken[RosterValidator::normalizeKey((string) $title)] = true;
            }
        }

        return array_values(array_filter($titles, fn (string $t) => isset($taken[RosterValidator::normalizeKey($t)])));
    }

    /**
     * Peta impor: kunci normalizeKey(nama jabatan) ke strata.
     *
     * @param  list<array{id: string, isContractor: bool, jobTitles: list<string>}>  $strata
     * @return array<string, array{id: string, isContractor: bool}>
     */
    public static function lookup(array $strata): array
    {
        $map = [];
        foreach ($strata as $s) {
            foreach ($s['jobTitles'] as $title) {
                $map[RosterValidator::normalizeKey($title)] ??= ['id' => $s['id'], 'isContractor' => $s['isContractor']];
            }
        }

        return $map;
    }
}
