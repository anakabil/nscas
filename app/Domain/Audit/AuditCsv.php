<?php

declare(strict_types=1);

namespace App\Domain\Audit;

/**
 * Penulisan CSV ekspor jejak audit, dibawa dari v1 (src/lib/audit-trail/csv.ts). Pemisah titik koma dan tanda urutan
 * bita UTF-8 agar berkas terbuka benar di Excel berlokal Indonesia (koma dipakai sebagai pemisah desimal). Murni.
 */
final class AuditCsv
{
    public const DELIMITER = ';';

    /**
     * Menetralkan injeksi rumus spreadsheet (CWE-1236): sel yang diawali =, +, -, @, tab, atau carriage return diberi
     * awalan tanda kutip tunggal sehingga dibaca sebagai teks.
     */
    public static function neutralize(string $value): string
    {
        return preg_match('/^[=+\-@\t\r]/', $value) === 1 ? "'".$value : $value;
    }

    public static function cell(string|int|float|null $value): string
    {
        if ($value === null) {
            return '';
        }
        $text = self::neutralize((string) $value);

        return preg_match('/[";\r\n,]/', $text) === 1 ? '"'.str_replace('"', '""', $text).'"' : $text;
    }

    /** @param  list<list<string|int|float|null>>  $rows */
    public static function document(array $rows): string
    {
        return "\u{FEFF}".implode("\r\n", array_map(fn (array $row) => implode(self::DELIMITER, array_map(self::cell(...), $row)), $rows))."\r\n";
    }
}
