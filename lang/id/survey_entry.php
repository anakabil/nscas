<?php

// Halaman publik responden: pemindaian kode QR dan pembukaan tautan survei (fase R2; formulir survei di fase R3).

return [
    'title' => 'Survei budaya keselamatan dan kesehatan kerja (K3)',
    'states' => [
        'QR_INVALID' => 'Kode QR ini tidak berlaku atau sudah diganti. Mintalah kode terbaru kepada koordinator unit Anda.',
        'QR_CLOSED' => 'Survei sedang tidak dibuka. Periksa jadwal survei dari koordinator unit Anda.',
        'QR_LIMIT' => 'Kuota pengisian untuk kode QR ini sudah habis. Hubungi koordinator unit Anda.',
        'INVALID' => 'Tautan survei ini tidak berlaku. Tautan mungkin sudah diganti dengan tautan yang lebih baru. Periksa surel atau pesan terakhir yang Anda terima, atau hubungi koordinator unit Anda.',
        'COMPLETED' => 'Jawaban survei dari tautan ini sudah diterima. Terima kasih atas partisipasi Anda.',
        'CLOSED' => 'Survei sedang tidak dibuka. Tautan Anda tetap berlaku selama jendela survei.',
        'READY' => 'Tautan survei Anda berlaku. Simpan tautan ini; formulir survei dapat diisi melalui tautan yang sama selama jendela survei.',
    ],
    'closes' => 'Survei dibuka sampai :date.',
    'anonymous' => 'Jawaban Anda tidak dapat dihubungkan dengan identitas Anda dan hanya disajikan secara gabungan untuk kelompok paling sedikit lima orang.',
    'privacy' => 'Halaman ini tidak menyimpan identitas maupun alamat perangkat Anda.',
    'footer' => 'Nusa Safety',
];
