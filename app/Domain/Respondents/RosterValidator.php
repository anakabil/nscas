<?php

declare(strict_types=1);

namespace App\Domain\Respondents;

use Normalizer;

/**
 * Validasi baris daftar responden (docs/01 M2), dibawa dari v1 src/lib/respondents/roster-file.ts. Murni: baris berkas
 * sudah dibaca menjadi teks oleh pemanggil; data pembanding (unit, strata, nomor induk dan surel yang sudah ada)
 * diberikan sebagai larik.
 *
 * Daftar responden mencakup semua orang yang bekerja di bawah tanggung jawab organisasi: pekerja sendiri, alih daya,
 * harian, dan subkontraktor (docs/13 bagian 3.5).
 */
final class RosterValidator
{
    public const COLUMNS = ['name', 'employeeNo', 'email', 'phone', 'unit', 'stratum', 'contractor'];

    public const REQUIRED = ['name', 'unit', 'stratum'];

    public const MAX_ROWS = 20_000;

    /** Judul kolom templat (bahasa Indonesia). */
    public const TEMPLATE_HEADERS = [
        'name' => 'Nama',
        'employeeNo' => 'Nomor induk',
        'email' => 'Surel',
        'phone' => 'Telepon',
        'unit' => 'Unit',
        'stratum' => 'Strata',
        'contractor' => 'Penyedia jasa',
    ];

    /** Nama lain judul kolom yang juga dikenali, sudah dinormalkan. */
    private const ALIASES = [
        'name' => ['nama', 'nama lengkap', 'name', 'full name'],
        'employeeNo' => ['nomor induk', 'nomor induk pegawai', 'nomor pegawai', 'nip', 'nik', 'employee number', 'employee no', 'employee id'],
        'email' => ['surel', 'alamat surel', 'email', 'e-mail', 'e mail'],
        'phone' => ['telepon', 'nomor telepon', 'nomor ponsel', 'phone', 'phone number', 'no hp', 'hp'],
        'unit' => ['unit', 'nama unit', 'unit name'],
        'stratum' => ['strata', 'kode strata', 'stratum', 'stratum code'],
        'contractor' => ['penyedia jasa', 'status penyedia jasa', 'pekerja penyedia jasa', 'contractor'],
    ];

    public static function normalizeKey(string $value): string
    {
        $value = class_exists(Normalizer::class) ? (string) Normalizer::normalize($value, Normalizer::FORM_KC) : $value;
        $value = mb_strtolower($value);
        $value = (string) preg_replace('/\(.*?\)|\*/u', '', $value);
        $value = (string) preg_replace('/\s+/u', ' ', $value);

        return trim($value);
    }

    /**
     * Pemetaan judul kolom ke indeks, dan kolom wajib yang tidak ditemukan.
     *
     * @param  list<string>  $header
     * @return array{columns: array<string, int>, missing: list<string>}
     */
    public static function mapHeader(array $header): array
    {
        $columns = [];
        foreach ($header as $index => $cell) {
            $key = self::normalizeKey((string) $cell);
            foreach (self::COLUMNS as $column) {
                if (! isset($columns[$column]) && in_array($key, self::ALIASES[$column], true)) {
                    $columns[$column] = $index;
                }
            }
        }

        return ['columns' => $columns, 'missing' => array_values(array_diff(self::REQUIRED, array_keys($columns)))];
    }

    /** Nomor telepon dinormalkan ke format internasional (+62...). Null bila tidak sah. */
    public static function normalizePhone(string $raw): ?string
    {
        $compact = (string) preg_replace('/[\s().-]/', '', $raw);
        if (preg_match('/^\+?\d{8,15}$/', $compact) !== 1) {
            return null;
        }

        return match (true) {
            str_starts_with($compact, '+') => $compact,
            str_starts_with($compact, '62') => '+'.$compact,
            str_starts_with($compact, '0') => '+62'.substr($compact, 1),
            default => '+'.$compact,
        };
    }

    /** true, false, null (kosong), atau 'INVALID'. */
    public static function parseContractor(string $raw): bool|string|null
    {
        $value = self::normalizeKey($raw);

        return match (true) {
            $value === '' => null,
            in_array($value, ['ya', 'y', 'yes', 'true', '1', 'penyedia jasa'], true) => true,
            in_array($value, ['tidak', 't', 'no', 'n', 'false', '0', 'bukan'], true) => false,
            default => 'INVALID',
        };
    }

    /**
     * @param  list<list<string>>  $rows  Baris berkas, baris pertama adalah judul kolom.
     * @param  array<string, string>  $units  Kunci normalizeKey(nama unit) => id unit.
     * @param  array<string, array{id: string, isContractor: bool}>  $strata  Kunci normalizeKey(kode) dan normalizeKey(nama).
     * @param  list<string>|null  $unitScope  Id unit yang boleh diimpor (koordinator unit); null untuk semua unit.
     * @param  list<string>  $existingEmployeeNos  Nomor induk yang sudah terdaftar, huruf kecil.
     * @param  list<string>  $existingEmails  Surel yang sudah terdaftar, huruf kecil.
     * @return array{missingColumns: list<string>, totalRows: int, tooManyRows: bool, valid: list<array<string, mixed>>, errors: list<array{row: int, column: string|null, code: string}>}
     */
    public static function validate(array $rows, array $units, array $strata, ?array $unitScope, array $existingEmployeeNos, array $existingEmails): array
    {
        $header = $rows[0] ?? [];
        ['columns' => $columns, 'missing' => $missing] = self::mapHeader($header);
        if ($missing !== []) {
            return ['missingColumns' => $missing, 'totalRows' => 0, 'tooManyRows' => false, 'valid' => [], 'errors' => []];
        }

        $data = [];
        foreach (array_slice($rows, 1) as $i => $cells) {
            if (array_filter($cells, fn ($c) => trim((string) $c) !== '') !== []) {
                $data[] = ['cells' => $cells, 'row' => $i + 2];
            }
        }
        if (count($data) > self::MAX_ROWS) {
            return ['missingColumns' => [], 'totalRows' => count($data), 'tooManyRows' => true, 'valid' => [], 'errors' => []];
        }

        $cell = static fn (array $cells, string $column): string => isset($columns[$column]) ? trim((string) ($cells[$columns[$column]] ?? '')) : '';
        $existingNos = array_fill_keys($existingEmployeeNos, true);
        $existingMails = array_fill_keys($existingEmails, true);
        $scope = $unitScope === null ? null : array_fill_keys($unitScope, true);
        $seenNos = [];
        $seenMails = [];
        $valid = [];
        $errors = [];

        foreach ($data as ['cells' => $cells, 'row' => $row]) {
            $rowErrors = [];
            $add = static function (?string $column, string $code) use (&$rowErrors, $row): void {
                $rowErrors[] = ['row' => $row, 'column' => $column, 'code' => $code];
            };

            $name = $cell($cells, 'name');
            if ($name === '') {
                $add('name', 'NAME_REQUIRED');
            } elseif (mb_strlen($name) > 200) {
                $add('name', 'TEXT_TOO_LONG');
            }

            $unitName = $cell($cells, 'unit');
            $unitId = $unitName === '' ? null : ($units[self::normalizeKey($unitName)] ?? null);
            if ($unitName === '') {
                $add('unit', 'UNIT_REQUIRED');
            } elseif ($unitId === null) {
                $add('unit', 'UNIT_NOT_FOUND');
            } elseif ($scope !== null && ! isset($scope[$unitId])) {
                $add('unit', 'UNIT_OUT_OF_SCOPE');
            }

            $stratumKey = $cell($cells, 'stratum');
            $stratum = $stratumKey === '' ? null : ($strata[self::normalizeKey($stratumKey)] ?? null);
            if ($stratumKey === '') {
                $add('stratum', 'STRATUM_REQUIRED');
            } elseif ($stratum === null) {
                $add('stratum', 'STRATUM_NOT_FOUND');
            }

            $employeeNo = $cell($cells, 'employeeNo');
            $employeeNo = $employeeNo === '' ? null : $employeeNo;
            if ($employeeNo !== null) {
                $key = mb_strtolower($employeeNo);
                if (mb_strlen($employeeNo) > 64) {
                    $add('employeeNo', 'TEXT_TOO_LONG');
                } elseif (isset($seenNos[$key])) {
                    $add('employeeNo', 'DUPLICATE_IN_FILE');
                } elseif (isset($existingNos[$key])) {
                    $add('employeeNo', 'ALREADY_REGISTERED');
                }
                $seenNos[$key] = true;
            }

            $emailRaw = $cell($cells, 'email');
            $email = $emailRaw === '' ? null : mb_strtolower($emailRaw);
            if ($email !== null) {
                if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || mb_strlen($email) > 254) {
                    $add('email', 'EMAIL_INVALID');
                } elseif (isset($seenMails[$email])) {
                    $add('email', 'DUPLICATE_IN_FILE');
                } elseif (isset($existingMails[$email])) {
                    $add('email', 'ALREADY_REGISTERED');
                }
                $seenMails[$email] = true;
            }

            $phoneRaw = $cell($cells, 'phone');
            $phone = $phoneRaw === '' ? null : self::normalizePhone($phoneRaw);
            if ($phoneRaw !== '' && $phone === null) {
                $add('phone', 'PHONE_INVALID');
            }

            $contractor = self::parseContractor($cell($cells, 'contractor'));
            if ($contractor === 'INVALID') {
                $add('contractor', 'CONTRACTOR_INVALID');
            }

            if ($rowErrors !== [] || $unitId === null || $stratum === null) {
                array_push($errors, ...$rowErrors);

                continue;
            }
            $valid[] = [
                'row' => $row,
                'fullName' => $name,
                'employeeNo' => $employeeNo,
                'email' => $email,
                'phone' => $phone,
                'unitId' => $unitId,
                'stratumId' => $stratum['id'],
                'isContractor' => $contractor === null ? $stratum['isContractor'] : (bool) $contractor,
            ];
        }

        return ['missingColumns' => [], 'totalRows' => count($data), 'tooManyRows' => false, 'valid' => $valid, 'errors' => $errors];
    }
}
