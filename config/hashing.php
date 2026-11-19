<?php

/*
| Hash kata sandi (docs/04 bagian 3): argon2id. Kata sandi lama dengan algoritme lain di-hash ulang otomatis saat
| pemiliknya berhasil masuk (rehash_on_login), selama HASH_VERIFY dinonaktifkan sementara untuk migrasi.
*/

return [

    'driver' => env('HASH_DRIVER', 'argon2id'),

    'bcrypt' => [
        'rounds' => env('BCRYPT_ROUNDS', 12),
        'verify' => env('HASH_VERIFY', true),
        'limit' => env('BCRYPT_LIMIT', null),
    ],

    // Memori 64 MiB, 3 putaran, 1 jalur; di atas batas minimum OWASP Password Storage Cheat Sheet (19 MiB, 2, 1).
    'argon' => [
        'memory' => (int) env('ARGON_MEMORY', 65536),
        'threads' => (int) env('ARGON_THREADS', 1),
        'time' => (int) env('ARGON_TIME', 3),
        'verify' => env('HASH_VERIFY', true),
    ],

    'rehash_on_login' => true,

];
