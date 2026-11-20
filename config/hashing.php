<?php

/*
| Hash kata sandi (docs/04 bagian 3): argon2id. Akun yang dibuat sebelum fase R11 masih ber-hash bcrypt. Pemeriksaan
| algoritme (verify) dimatikan agar hash lama tetap dapat diperiksa dengan password_verify, yang membaca algoritme dari
| hash itu sendiri, lalu langsung di-hash ulang ke argon2id saat pemiliknya berhasil masuk (rehash_on_login). Bila
| verify menyala, hash bcrypt menimbulkan galat server 500 pada halaman masuk.
*/

return [

    'driver' => env('HASH_DRIVER', 'argon2id'),

    'bcrypt' => [
        'rounds' => env('BCRYPT_ROUNDS', 12),
        'verify' => env('HASH_VERIFY', false),
        'limit' => env('BCRYPT_LIMIT', null),
    ],

    // Memori 64 MiB, 3 putaran, 1 jalur; di atas batas minimum OWASP Password Storage Cheat Sheet (19 MiB, 2, 1).
    'argon' => [
        'memory' => (int) env('ARGON_MEMORY', 65536),
        'threads' => (int) env('ARGON_THREADS', 1),
        'time' => (int) env('ARGON_TIME', 3),
        'verify' => env('HASH_VERIFY', false),
    ],

    'rehash_on_login' => true,

];
