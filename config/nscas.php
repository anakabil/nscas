<?php

return [
    /*
     | Peran SUPER_ADMIN, LEAD_ASSESSOR, ASSESSOR, dan CLIENT_ADMIN wajib mengaktifkan verifikasi dua langkah
     | sebelum membuka halaman kerja (docs/04 bagian 3). Hanya dimatikan untuk pengujian otomatis tertentu.
     */
    'enforce_two_factor' => (bool) env('NSCAS_ENFORCE_TWO_FACTOR', true),

    /*
     | Lokasi penyimpanan data yang disebut pada teks persetujuan responden dan dokumen privasi (docs/04).
     | Produksi: DigitalOcean Singapura, dengan persetujuan tertulis klien.
     */
    'data_location' => env('NSCAS_DATA_LOCATION', 'Singapura'),
    'data_location_en' => env('NSCAS_DATA_LOCATION_EN', 'Singapore'),
];
