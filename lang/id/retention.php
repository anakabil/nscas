<?php

// Berita acara pemusnahan data mentah dan surel penanda masa simpan (docs/04 bagian 7). Dibawa dari v1
// (messages/id.json, retentionDoc).
return [
    'doc' => [
        'file' => 'Berita acara pemusnahan',
        'title' => 'Berita Acara Pemusnahan Data Mentah Asesmen',
        'number' => 'Nomor catatan :id',
        'opening' => 'Pada :date telah dilaksanakan pemusnahan data mentah :assessment milik :organization, dengan rincian sebagai berikut.',
        'basis' => [
            'title' => 'Dasar pemusnahan',
            'law' => 'Dasar hukum',
            'lawValue' => 'Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi',
            'baseline' => 'Awal masa simpan',
            'months' => 'Masa simpan data mentah',
            'monthsValue' => ':months bulan sejak laporan final',
            'end' => 'Masa simpan berakhir',
        ],
        'confirmation' => [
            'title' => 'Konfirmasi tertulis klien',
            'ref' => 'Nomor surat',
            'date' => 'Tanggal surat',
            'by' => 'Ditandatangani oleh',
        ],
        'destroyed' => [
            'title' => 'Data yang dimusnahkan',
            'category' => 'Jenis data',
            'count' => 'Jumlah',
        ],
        'categories' => [
            'rosterEntries' => 'Daftar responden',
            'accessTokens' => 'Token akses survei dan penilaian mandiri',
            'surveyResponses' => 'Respons survei',
            'characteristicAnswers' => 'Jawaban karakteristik',
            'climateAnswers' => 'Jawaban skala iklim',
            'selfAssessments' => 'Penilaian mandiri',
            'selfAssessmentAnswers' => 'Jawaban penilaian mandiri',
            'evidenceItems' => 'Catatan berkas bukti',
            'evidenceLinks' => 'Pemetaan bukti ke karakteristik',
            'observationCaptures' => 'Rekaman observasi lapangan',
            'validationParticipants' => 'Daftar narasumber validasi',
            'pendingUploads' => 'Unggahan yang belum selesai',
            'actionOwnerEmails' => 'Alamat surel penanggung jawab rencana aksi',
            'storageObjects' => 'Berkas di penyimpanan objek',
        ],
        'retained' => [
            'title' => 'Data yang tetap disimpan',
            'body' => 'Hasil agregat, hasil final rapat panel, laporan final, berita acara ini, dan jejak audit.',
        ],
        'notes' => 'Catatan',
        'execution' => [
            'title' => 'Pelaksanaan',
            'by' => 'Pelaksana',
            'at' => 'Waktu pelaksanaan',
            'witness' => 'Saksi',
            'objectsPurged' => 'Penghapusan berkas selesai',
        ],
        'signature' => 'Tanda tangan',
        'footer' => 'Berita acara ini dibuat oleh NSCAS dan tidak dapat diubah.',
    ],
    'mail' => [
        'subject' => 'Masa simpan data mentah berakhir untuk :count asesmen',
        'greeting' => 'Yth. :name,',
        'intro' => 'Tugas mingguan NSCAS menandai asesmen berikut karena masa simpan data mentahnya telah berakhir.',
        'item' => ':assessment (:organization), berakhir :date',
        'action' => 'Mintalah konfirmasi tertulis klien sebelum pemusnahan. Pemusnahan dijalankan dari halaman Retensi data.',
        'button' => 'Buka halaman Retensi data',
        'closing' => 'Hormat kami,',
        'signature' => 'NSCAS, Nusa Safety',
    ],
];
