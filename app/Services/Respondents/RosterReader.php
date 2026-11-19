<?php

namespace App\Services\Respondents;

use App\Domain\Respondents\RosterValidator;
use DateTimeInterface;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use Throwable;

/**
 * Pembacaan berkas daftar responden (docs/01 M2), dibawa dari v1 readRosterFile: .xlsx (lembar "Daftar responden"
 * bila ada) atau CSV UTF-8 berpemisah titik koma, koma, atau tab. Berkas .xls lama ditolak. Hasilnya baris teks yang
 * divalidasi App\Domain\Respondents\RosterValidator.
 */
final class RosterReader
{
    public const MAX_BYTES = 10 * 1024 * 1024;

    public const TEMPLATE_SHEET = 'Daftar responden';

    /** @return array{rows: list<list<string>>}|array{error: 'FILE_TYPE'|'FILE_EMPTY'|'FILE_UNREADABLE'|'FILE_TOO_LARGE'} */
    public static function read(string $path): array
    {
        $size = @filesize($path);
        if ($size === false || $size === 0) {
            return ['error' => 'FILE_EMPTY'];
        }
        if ($size > self::MAX_BYTES) {
            return ['error' => 'FILE_TOO_LARGE'];
        }
        $head = (string) file_get_contents($path, false, null, 0, 8);
        if (str_starts_with($head, "\xD0\xCF\x11\xE0")) {
            return ['error' => 'FILE_TYPE'];
        }
        $rows = str_starts_with($head, "PK\x03\x04") ? self::readXlsx($path) : self::readCsv($path);
        if (isset($rows['error'])) {
            return $rows;
        }
        $rows = self::trimTrailingEmpty($rows);

        return $rows === [] ? ['error' => 'FILE_EMPTY'] : ['rows' => $rows];
    }

    /** @return list<list<string>>|array{error: string} */
    private static function readXlsx(string $path): array
    {
        $reader = new XlsxReader;
        try {
            $reader->open($path);
            $chosen = null;
            foreach ($reader->getSheetIterator() as $sheet) {
                if ($chosen === null || $sheet->getName() === self::TEMPLATE_SHEET) {
                    $chosen = $sheet->getIndex();
                }
                if ($sheet->getName() === self::TEMPLATE_SHEET) {
                    break;
                }
            }
            $rows = [];
            foreach ($reader->getSheetIterator() as $sheet) {
                if ($sheet->getIndex() !== $chosen) {
                    continue;
                }
                foreach ($sheet->getRowIterator() as $row) {
                    $values = array_map(self::text(...), $row->toArray());
                    $rows[] = array_pad($values, count(RosterValidator::COLUMNS), '');
                }
            }
            $reader->close();

            return $rows;
        } catch (Throwable) {
            return ['error' => 'FILE_UNREADABLE'];
        }
    }

    /** Nilai sel sebagai teks: angka bulat tanpa desimal, tanggal sebagai Y-m-d. */
    private static function text(mixed $value): string
    {
        return trim(match (true) {
            $value === null => '',
            $value instanceof DateTimeInterface => $value->format('Y-m-d'),
            is_bool($value) => $value ? 'TRUE' : 'FALSE',
            is_float($value) && floor($value) === $value && abs($value) < 1e15 => sprintf('%.0f', $value),
            default => (string) $value,
        });
    }

    /** @return list<list<string>>|array{error: string} */
    private static function readCsv(string $path): array
    {
        $text = (string) file_get_contents($path);
        if (str_contains($text, "\0")) {
            return ['error' => 'FILE_TYPE'];
        }
        $text = (string) preg_replace('/^\xEF\xBB\xBF/', '', $text);
        if (! mb_check_encoding($text, 'UTF-8')) {
            // Ekspor CSV Excel versi lama memakai Windows-1252.
            $text = (string) mb_convert_encoding($text, 'UTF-8', 'Windows-1252');
        }
        $firstLine = strtok($text, "\n") ?: '';
        $counts = [';' => substr_count($firstLine, ';'), ',' => substr_count($firstLine, ','), "\t" => substr_count($firstLine, "\t")];
        arsort($counts);
        $delimiter = (string) array_key_first($counts);

        $stream = fopen('php://temp', 'r+');
        fwrite($stream, $text);
        rewind($stream);
        $rows = [];
        while (($cells = fgetcsv($stream, null, $delimiter, '"', '')) !== false) {
            $rows[] = array_map(static fn ($v) => trim((string) $v), $cells === [null] ? [''] : $cells);
        }
        fclose($stream);

        return $rows;
    }

    /**
     * Baris kosong di tengah dipertahankan agar nomor baris sama dengan berkas; baris kosong di akhir dibuang.
     *
     * @param  list<list<string>>  $rows
     * @return list<list<string>>
     */
    private static function trimTrailingEmpty(array $rows): array
    {
        while ($rows !== [] && implode('', end($rows)) === '') {
            array_pop($rows);
        }

        return $rows;
    }
}
