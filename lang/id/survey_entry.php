<?php

// Halaman publik responden: pemindaian kode QR dan pembukaan tautan survei (fase R2 dan R3).

return [
    'title' => 'Survei budaya keselamatan dan kesehatan kerja (K3)',
    'titleSelfAssessment' => 'Penilaian mandiri budaya keselamatan dan kesehatan kerja (K3)',
    'states' => [
        'SA_INVALID' => 'Tautan penilaian mandiri ini tidak dikenali atau sudah diganti. Hubungi administrator asesmen di organisasi Anda untuk tautan terbaru.',
        'SA_CLOSED' => 'Masa pengisian penilaian mandiri sudah berakhir.',
        'QR_INVALID' => 'Kode QR ini tidak berlaku atau sudah diganti. Mintalah kode terbaru kepada koordinator unit Anda.',
        'QR_CLOSED' => 'Survei sedang tidak dibuka. Periksa jadwal survei dari koordinator unit Anda.',
        'QR_LIMIT' => 'Kuota pengisian untuk kode QR ini sudah habis. Hubungi koordinator unit Anda.',
        'INVALID' => 'Tautan survei ini tidak berlaku. Tautan mungkin sudah diganti dengan tautan yang lebih baru. Periksa surel atau pesan terakhir yang Anda terima, atau hubungi koordinator unit Anda.',
        'USED' => 'Jawaban survei dari tautan ini sudah diterima. Terima kasih atas partisipasi Anda.',
        'NOT_OPEN' => 'Survei sedang tidak dibuka. Tautan Anda tetap berlaku selama masa survei.',
        'CLOSED' => 'Survei sudah ditutup. Terima kasih atas perhatian Anda.',
    ],
    'opens' => 'Survei dibuka mulai :date.',
    'closes' => 'Survei dibuka sampai :date.',
    'anonymous' => 'Jawaban Anda tidak dapat dihubungkan dengan identitas Anda dan hanya disajikan secara gabungan untuk kelompok paling sedikit lima orang.',
    'privacy' => 'Halaman ini tidak menyimpan identitas maupun alamat perangkat Anda.',
    'noScript' => 'Survei ini memerlukan JavaScript. Aktifkan JavaScript di peramban Anda, lalu muat ulang halaman ini.',
    'footer' => 'Nusa Safety',
];
