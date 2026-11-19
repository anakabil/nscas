// Teks formulir penilaian mandiri bertoken (fase R4), dibawa dari v1 messages/id.json bagian selfAssessmentForm.
// Hanya dimuat paket formulir (resources/js/self-assessment), tidak oleh konsol.

export const selfAssessmentForm = {
    heading: 'Penilaian mandiri budaya keselamatan dan kesehatan kerja (K3)',
    identified: {
        title: 'Penilaian mandiri ini teridentifikasi',
        body: 'Nama dan jabatan Anda tersimpan bersama jawaban. Penilaian mandiri menjadi bahan pertanggungjawaban: asesor Nusa Safety menelusuri alasan dan bukti yang Anda berikan, lalu mengonfirmasinya dalam wawancara atau diskusi. Karena itu penilaian ini tidak anonim, berbeda dengan survei pekerja.',
        access: 'Jawaban dapat dibaca asesor Nusa Safety dan administrator asesmen di organisasi Anda, dan tidak digabung dengan jawaban survei pekerja.',
    },
    profile: {
        title: 'Identitas pengisi',
        name: 'Nama lengkap',
        position: 'Jabatan',
        save: 'Simpan identitas',
        saved: 'Identitas tersimpan.',
    },
    start: 'Mulai penilaian',
    characteristic: {
        label: 'Karakteristik {current} dari {total}',
        instruction: 'Pilih satu pernyataan yang paling menggambarkan keadaan organisasi Anda saat ini.',
        justification: 'Alasan',
        justificationHint:
            'Jelaskan dasar pilihan Anda, misalnya praktik, data, atau kejadian yang mendukung. Minimal {min} karakter.',
        counter: '{count} dari minimal {min} karakter',
        evidence: 'Bukti pendukung',
        noEvidence:
            'Belum ada bukti yang ditautkan. Anda tetap dapat melanjutkan, tetapi asesor akan menilai tanpa bukti pendukung.',
        noEvidenceUploaded:
            'Bukti dokumen dapat ditautkan setelah modul Bukti tersedia. Jelaskan dasar penilaian Anda pada kolom alasan.',
    },
    jump: 'Lompat ke karakteristik',
    nav: {
        previous: 'Sebelumnya',
        saveNext: 'Simpan dan lanjut',
        saveReview: 'Simpan dan periksa',
        saving: 'Menyimpan',
        saved: 'Draf tersimpan.',
    },
    review: {
        title: 'Periksa sebelum mengirim',
        complete: 'Semua karakteristik sudah lengkap.',
        incomplete: '{count} karakteristik belum lengkap:',
        reasons: {
            LEVEL: 'belum memilih pernyataan',
            JUSTIFICATION: 'alasan kurang dari {min} karakter',
        },
        warning: 'Setelah dikirim, jawaban terkunci dan tidak dapat diubah.',
        submit: 'Kirim penilaian mandiri',
        submitting: 'Mengirim',
        edit: 'Ubah',
    },
    submitted: {
        title: 'Penilaian mandiri sudah dikirim',
        body: 'Terima kasih. Jawaban Anda terkunci sejak {date}.',
        answers: 'Jawaban Anda',
    },
    status: {
        INVALID: {
            title: 'Tautan tidak berlaku',
            body: 'Tautan penilaian mandiri ini tidak dikenali atau sudah diganti. Hubungi administrator asesmen di organisasi Anda untuk tautan terbaru.',
        },
        CLOSED: {
            title: 'Penilaian mandiri sudah ditutup',
            body: 'Masa pengisian penilaian mandiri sudah berakhir.',
        },
    },
    errors: {
        INVALID_INPUT: 'Periksa kembali isian Anda.',
        INVALID_TOKEN: 'Tautan tidak berlaku lagi. Hubungi administrator asesmen untuk tautan terbaru.',
        SELF_ASSESSMENT_SUBMITTED: 'Penilaian mandiri sudah dikirim dan tidak dapat diubah.',
        DISTRIBUTION_CLOSED: 'Masa pengisian sudah berakhir.',
        UNKNOWN_ITEM: 'Pilihan tidak dikenali. Muat ulang halaman.',
        UNKNOWN_EVIDENCE: 'Salah satu bukti sudah tidak tersedia. Muat ulang halaman.',
        INCOMPLETE: 'Masih ada karakteristik yang belum lengkap.',
        NETWORK: 'Tidak dapat terhubung ke server. Periksa sambungan, lalu coba lagi. Isian di layar ini belum hilang.',
    },
    readOnly: 'Jawaban hanya dapat dibaca.',
    level: 'Pernyataan yang dipilih',
    switchLanguage: 'English',
    contentInIndonesian: 'Pernyataan saat ini tersedia dalam bahasa Indonesia.',
};
