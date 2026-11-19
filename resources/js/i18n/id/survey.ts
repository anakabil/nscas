// Teks halaman survei responden (fase R3), dibawa dari v1 messages/id.json bagian survey. Hanya dimuat paket survei
// (resources/js/survey), tidak oleh konsol, agar halaman survei tetap ringan. Aturan bahasa: docs/05 bagian 4.

export const survey = {
    heading: 'Survei budaya keselamatan dan kesehatan kerja (K3)',
    switchLanguage: 'English',
    language: {
        title: 'Pilih bahasa',
        intro: 'Survei tersedia dalam bahasa Indonesia dan bahasa Inggris. Bahasa dapat diganti kapan saja.',
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
        intro: 'Pilih kelompok jabatan yang paling sesuai. Pilihan ini hanya dipakai untuk mengelompokkan hasil dan tidak menunjukkan siapa Anda.',
    },
    intro: {
        title: 'Petunjuk pengisian',
        partA: 'Bagian A berisi {count} pertanyaan. Setiap pertanyaan memuat lima pernyataan. Pilih satu pernyataan yang paling menggambarkan keadaan di tempat kerja Anda saat ini. Bila tidak tahu, pilih Tidak tahu.',
        partB: 'Bagian B berisi {count} pernyataan. Pilih seberapa setuju Anda dengan setiap pernyataan.',
        honest: 'Tidak ada jawaban benar atau salah. Jawablah sesuai keadaan yang Anda alami.',
        anonymous:
            'Jawaban tersimpan sementara di perangkat ini dan baru dikirim di akhir. Jawaban tidak dapat dihubungkan dengan identitas Anda.',
        start: 'Mulai',
    },
    partA: {
        label: 'Bagian A',
        question: 'Pertanyaan {current} dari {total}',
        instruction: 'Pilih satu pernyataan yang paling sesuai dengan keadaan di tempat kerja Anda saat ini.',
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
    remaining: 'Perkiraan sisa waktu {minutes} menit',
    remainingLessThanOne: 'Perkiraan sisa waktu kurang dari 1 menit',
    nav: {
        back: 'Kembali',
        next: 'Lanjut',
        answerFirst: 'Pilih jawaban untuk melanjutkan.',
    },
    review: {
        title: 'Siap dikirim',
        body: 'Semua pertanyaan sudah dijawab. Jawaban dikirim satu kali dan tidak dapat diubah setelah dikirim.',
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
