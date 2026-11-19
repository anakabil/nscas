<?php

declare(strict_types=1);

namespace App\Domain\Respondents;

/**
 * Token akses dan kode QR: 32 byte acak dalam base64url (43 karakter). Basis data hanya menyimpan SHA-256-nya, sehingga
 * kebocoran basis data tidak membuka tautan survei siapa pun (docs/02 bagian 4).
 */
final class TokenCodec
{
    public static function generate(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    public static function hash(string $raw): string
    {
        return hash('sha256', $raw);
    }

    /** Bentuk token yang sah; dipakai untuk menolak masukan acak sebelum menyentuh basis data. */
    public static function looksValid(string $raw): bool
    {
        return preg_match('/^[A-Za-z0-9_-]{43}$/', $raw) === 1;
    }
}
