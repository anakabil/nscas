<?php

namespace App\Support;

/**
 * Nama berkas sementara yang unik dengan akhiran tertentu. tempnam() membuat berkas kosong tanpa akhiran; berkas itu
 * dihapus agar tidak tertinggal di direktori sementara ketika berkas sebenarnya ditulis dengan akhiran.
 */
final class TempFile
{
    public static function path(string $prefix, string $extension): string
    {
        $base = tempnam(sys_get_temp_dir(), $prefix);
        if ($base === false) {
            throw new \RuntimeException('Direktori sementara tidak dapat ditulisi.');
        }
        @unlink($base);

        return $base.'.'.$extension;
    }
}
