// Teks halaman survei responden (fase R3), dibawa dari v1 messages/id.json bagian survey. Hanya dimuat paket survei
// (resources/js/survey), tidak oleh konsol, agar halaman survei tetap ringan. Aturan bahasa: docs/05 bagian 4.

export const survey = {
    heading: 'Survei budaya keselamatan dan kesehatan kerja (K3)',
    switchLanguage: 'English',
    language: {
        title: 'Pilih bahasa',
        intro: 'Bahasa dapat diganti kapan saja.',
        id: 'Bahasa Indonesia',
        en: 'English',
    },
    consent: {
        title: 'Persetujuan pemrosesan data',
        accept: 'Saya setuju dan mulai survei',
        decline: 'Saya tidak setuju',
        declinedTitle: 'Terima kasih',
        declinedBody: 'Anda memilih tidak mengikuti survei. Tidak ada jawaban yang disimpan.',
        changeMind: 'Kembali ke persetujuan',
    },
    stratum: {
        title: 'Kelompok jabatan Anda',
        intro: 'Pilihan ini hanya untuk mengelompokkan hasil, bukan untuk mengenali Anda.',
        examples: 'Contoh jabatan: {titles}',
    },
    intro: {
        title: 'Petunjuk singkat',
        partA: 'Bagian A, {count} pertanyaan: pilih satu pernyataan yang paling sesuai dengan keadaan tempat kerja Anda saat ini.',
        partB: 'Bagian B, {count} pernyataan: pilih seberapa setuju Anda.',
        change: 'Jawaban dapat diubah lewat Daftar pertanyaan sebelum dikirim.',
        anonymous: 'Tidak ada jawaban benar atau salah. Jawaban tidak dapat dihubungkan dengan identitas Anda.',
        start: 'Mulai',
    },
    partA: {
        label: 'Bagian A',
        question: 'Pertanyaan {current} dari {total}',
        instruction: 'Pilih satu yang paling sesuai dengan keadaan tempat kerja Anda saat ini.',
        dontKnow: 'Tidak tahu',
    },
    partB: {
        label: 'Bagian B',
        screen: 'Layar {current} dari {total}',
        instruction: 'Seberapa setuju Anda dengan pernyataan berikut?',
    },
    scale: {
        '1': 'Sangat tidak setuju',
        '2': 'Tidak setuju',
        '3': 'Ragu-ragu',
        '4': 'Setuju',
        '5': 'Sangat setuju',
    },
    progress: 'Kemajuan {percent} persen',
    remaining: 'Sisa sekitar {minutes} menit',
    remainingLessThanOne: 'Sisa kurang dari 1 menit',
    allAnswered: 'Semua sudah dijawab',
    nav: {
        label: 'Navigasi pertanyaan',
        back: 'Kembali',
        next: 'Lanjut',
        toReview: 'Ke ringkasan',
        answerFirst: 'Pilih jawaban untuk melanjutkan.',
    },
    list: {
        open: 'Daftar pertanyaan',
        title: 'Daftar pertanyaan',
        close: 'Tutup',
        stratum: 'Kelompok jabatan',
        partA: 'Bagian A',
        partB: 'Bagian B',
        screen: 'Layar {current}, {count} pernyataan',
        statuses: {
            done: 'Terjawab',
            partial: '{answered} dari {total}',
            todo: 'Belum dijawab',
        },
        review: 'Ringkasan dan kirim',
    },
    review: {
        title: 'Periksa jawaban',
        body: 'Ketuk Ubah untuk mengganti jawaban. Setelah dikirim, jawaban tidak dapat diubah.',
        stratum: 'Kelompok jabatan',
        partA: 'Bagian A, {count} pertanyaan',
        partB: 'Bagian B, {count} pernyataan',
        edit: 'Ubah',
        editLabel: 'Ubah jawaban: {label}',
        submit: 'Kirim jawaban',
        sending: 'Mengirim',
    },
    offline: {
        banner: 'Sambungan terputus. Jawaban tetap tersimpan di perangkat ini.',
        waiting:
            'Belum terkirim karena sambungan terputus. Jawaban akan dikirim otomatis begitu sambungan kembali. Jangan menutup halaman ini.',
        retry: 'Coba kirim sekarang',
    },
    done: {
        title: 'Terima kasih',
        body: 'Jawaban Anda sudah kami terima. Jawaban tidak dapat dihubungkan dengan identitas Anda dan hanya disajikan secara gabungan untuk kelompok paling sedikit lima orang.',
        close: 'Anda dapat menutup halaman ini.',
    },
    status: {
        INVALID: {
            title: 'Tautan tidak berlaku',
            body: 'Tautan survei ini tidak dikenali atau sudah diganti. Gunakan tautan terbaru dari undangan, atau hubungi koordinator unit Anda.',
        },
        USED: {
            title: 'Survei sudah dikirim',
            body: 'Jawaban untuk tautan ini sudah kami terima. Setiap tautan hanya dapat dipakai satu kali. Terima kasih atas partisipasi Anda.',
        },
        NOT_OPEN: {
            title: 'Survei belum dibuka',
            body: 'Survei belum dapat diisi. Silakan buka kembali tautan ini setelah survei dibuka.',
        },
        CLOSED: {
            title: 'Survei sudah ditutup',
            body: 'Masa pengisian survei sudah berakhir. Terima kasih atas perhatian Anda.',
        },
        ERROR: {
            title: 'Jawaban belum dapat dikirim',
            body: 'Terjadi kesalahan saat mengirim. Jawaban tetap tersimpan di perangkat ini. Coba lagi beberapa saat lagi.',
        },
    },
    closesAt: 'Survei dibuka sampai {date} WIB.',
    contentInIndonesian: 'Pernyataan survei saat ini tersedia dalam bahasa Indonesia.',
};
