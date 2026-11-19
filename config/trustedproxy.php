<?php

/*
 * Proksi tepercaya (docs/08 bagian 6, docs/09 bagian 8).
 *
 * Di belakang penyeimbang beban atau penerus port, alamat klien dan skema HTTPS dibaca dari header X-Forwarded-*
 * hanya bila koneksi datang dari proksi yang tercantum di sini. TRUSTED_PROXIES berisi alamat atau rentang dipisah
 * koma, misalnya rentang VPC penyeimbang beban. Nilai '*' memercayai pemanggil langsung, hanya untuk server yang tidak
 * dapat dijangkau selain lewat proksi, misalnya GitHub Codespaces. Kosongkan bila server menerima koneksi langsung.
 *
 * Nilai dibaca middleware TrustProxies pada setiap permintaan, setelah .env dimuat, sehingga berlaku baik dari
 * variabel lingkungan sistem maupun dari berkas .env, dan ikut tersimpan oleh config:cache.
 */

return [
    'proxies' => env('TRUSTED_PROXIES') ?: null,
];
