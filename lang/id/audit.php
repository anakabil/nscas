<?php

// Teks ekspor jejak audit (docs/04 bagian 6). Kepala kolom CSV memakai huruf kecil tanpa spasi agar mudah diolah.
return [
    'system' => 'Sistem',
    'csv' => [
        'at' => 'waktu_utc',
        'atWib' => 'waktu_wib',
        'action' => 'aksi',
        'entityType' => 'jenis_entitas',
        'entityId' => 'id_entitas',
        'actor' => 'pelaku',
        'actorEmail' => 'surel_pelaku',
        'role' => 'peran',
        'ipHash' => 'hash_ip',
        'changes' => 'perubahan',
    ],
    'file' => 'jejak-audit',
];
