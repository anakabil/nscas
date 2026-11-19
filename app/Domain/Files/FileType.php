<?php

declare(strict_types=1);

namespace App\Domain\Files;

/**
 * Jenis berkas dari isinya (magic bytes), bukan dari nama berkas atau header Content-Type kiriman peramban (docs/02
 * bagian 5). Dibawa dari v1 src/lib/files/content-type.ts. Murni, sehingga dapat diuji tanpa penyimpanan objek.
 */
final class FileType
{
    /** Batas satu berkas bukti atau hasil observasi (docs/01 M5). */
    public const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

    /** Potongan awal berkas yang dibaca untuk mengenali jenisnya. */
    public const HEAD_BYTES = 64 * 1024;

    /** Bukti (docs/01 M5): PDF, gambar, Excel, dan Word. */
    public const EVIDENCE = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/msword',
        'application/vnd.ms-excel',
    ];

    /** Observasi (docs/01 M6): foto dan video dari kamera perangkat. */
    public const OBSERVATION = ['image/jpeg', 'image/png', 'image/webp', 'video/webm', 'video/mp4', 'video/quicktime'];

    /** Ekstensi yang dianggap sama dengan jenis yang dikenali. */
    private const EXTENSION_GROUPS = ['jpg' => ['jpg', 'jpeg'], 'heic' => ['heic', 'heif']];

    private const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'];

    private const MP4_BRANDS = ['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'dash'];

    /**
     * Jenis berkas dari sekitar 64 KB pertama. Dokumen Office lama (.doc, .xls) berformat OLE yang sama, sehingga
     * dibedakan dari ekstensi nama berkas yang dinyatakan pengunggah.
     *
     * @return array{mime: string, ext: string, kind: 'document'|'image'|'video'}|null
     */
    public static function detect(string $head, string $declaredName = ''): ?array
    {
        if (strlen($head) < 4) {
            return null;
        }
        if (str_starts_with($head, '%PDF-')) {
            return ['mime' => 'application/pdf', 'ext' => 'pdf', 'kind' => 'document'];
        }
        if (str_starts_with($head, "\xFF\xD8\xFF")) {
            return ['mime' => 'image/jpeg', 'ext' => 'jpg', 'kind' => 'image'];
        }
        if (str_starts_with($head, "\x89PNG\r\n\x1A\n")) {
            return ['mime' => 'image/png', 'ext' => 'png', 'kind' => 'image'];
        }
        if (substr($head, 0, 4) === 'RIFF' && substr($head, 8, 4) === 'WEBP') {
            return ['mime' => 'image/webp', 'ext' => 'webp', 'kind' => 'image'];
        }
        if (str_starts_with($head, "\x1A\x45\xDF\xA3")) {
            return ['mime' => 'video/webm', 'ext' => 'webm', 'kind' => 'video'];
        }
        if (substr($head, 4, 4) === 'ftyp') {
            $brand = substr($head, 8, 4);
            if (in_array($brand, self::HEIC_BRANDS, true)) {
                return ['mime' => 'image/heic', 'ext' => 'heic', 'kind' => 'image'];
            }
            if ($brand === 'qt  ') {
                return ['mime' => 'video/quicktime', 'ext' => 'mov', 'kind' => 'video'];
            }
            if (in_array($brand, self::MP4_BRANDS, true)) {
                return ['mime' => 'video/mp4', 'ext' => 'mp4', 'kind' => 'video'];
            }

            return null;
        }
        if (str_starts_with($head, "PK\x03\x04")) {
            // Dokumen Office berbasis ZIP dibedakan dari nama entri di awal arsip.
            if (str_contains($head, 'word/')) {
                return ['mime' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'ext' => 'docx', 'kind' => 'document'];
            }
            if (str_contains($head, 'xl/')) {
                return ['mime' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'ext' => 'xlsx', 'kind' => 'document'];
            }

            return null;
        }
        if (str_starts_with($head, "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1")) {
            return match (self::declaredExtension($declaredName)) {
                'doc' => ['mime' => 'application/msword', 'ext' => 'doc', 'kind' => 'document'],
                'xls' => ['mime' => 'application/vnd.ms-excel', 'ext' => 'xls', 'kind' => 'document'],
                default => null,
            };
        }

        return null;
    }

    /** Ekstensi nama berkas dalam huruf kecil (1 sampai 5 karakter), atau string kosong. */
    public static function declaredExtension(string $fileName): string
    {
        return preg_match('/\.([a-z0-9]{1,5})$/', strtolower($fileName), $m) === 1 ? $m[1] : '';
    }

    /** Ekstensi yang dinyatakan cocok dengan jenis yang dikenali; nama tanpa ekstensi dianggap cocok. */
    public static function extensionMatches(string $detectedExt, string $declaredExt): bool
    {
        return $declaredExt === '' || in_array($declaredExt, self::EXTENSION_GROUPS[$detectedExt] ?? [$detectedExt], true);
    }

    /** Ekstensi berkas yang disimpan untuk jenis yang diizinkan, misalnya jpg untuk image/jpeg. */
    public static function extensionFor(string $mime): string
    {
        return match ($mime) {
            'application/pdf' => 'pdf',
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/heic' => 'heic',
            'video/webm' => 'webm',
            'video/mp4' => 'mp4',
            'video/quicktime' => 'mov',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
            'application/msword' => 'doc',
            'application/vnd.ms-excel' => 'xls',
            default => 'bin',
        };
    }
}
