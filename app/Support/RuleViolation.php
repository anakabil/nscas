<?php

namespace App\Support;

use RuntimeException;

/**
 * Pelanggaran aturan bisnis yang ditemukan layanan. Status 409 berarti data sudah terkunci atau status asesmen tidak
 * mengizinkan perubahan (docs/01 M1, penerimaan); 422 berarti isian melanggar aturan dan ditampilkan pada isian
 * terkait. Teksnya ada di lang/<bahasa>/setup.php bagian errors.
 */
final class RuleViolation extends RuntimeException
{
    public function __construct(public readonly int $status, public readonly string $key, public readonly string $field = 'form')
    {
        parent::__construct($key);
    }

    public static function locked(string $key = 'CONFIGURATION_LOCKED'): self
    {
        return new self(409, $key);
    }

    public static function invalid(string $field, string $key): self
    {
        return new self(422, $key, $field);
    }
}
