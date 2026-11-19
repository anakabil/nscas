// Teks halaman masuk dan pengaturan akun, bahasa Indonesia (sumber). Aturan bahasa: docs/05 bagian 4.
// Istilah tetap: surel, kata sandi, verifikasi dua langkah, kode verifikasi, kode pemulihan,
// aplikasi autentikator, kunci penyiapan, Masuk, Keluar.

export const account = {
    auth: {
        fields: {
            email: 'Alamat surel',
            emailPlaceholder: 'nama@example.com',
            password: 'Kata sandi',
            passwordConfirmation: 'Ulangi kata sandi',
        },
        passwordVisibility: {
            show: 'Tampilkan kata sandi',
            hide: 'Sembunyikan kata sandi',
        },
        login: {
            title: 'Masuk',
            heading: 'Masuk ke akun Anda',
            description: 'Masukkan alamat surel dan kata sandi akun Anda.',
            forgotPassword: 'Lupa kata sandi?',
            submit: 'Masuk',
            sessionExpired: 'Sesi Anda berakhir setelah 8 jam. Silakan masuk kembali.',
            sessionIdle: 'Sesi Anda berakhir karena tidak ada aktivitas selama 30 menit. Silakan masuk kembali.',
        },
        forgotPassword: {
            title: 'Lupa kata sandi',
            description:
                'Masukkan alamat surel akun Anda. Tautan untuk mengatur ulang kata sandi akan dikirim ke alamat tersebut.',
            submit: 'Kirim tautan pengaturan ulang',
            returnTo: 'Atau kembali ke',
            returnLink: 'halaman masuk',
        },
        resetPassword: {
            title: 'Atur ulang kata sandi',
            description: 'Masukkan kata sandi baru untuk akun Anda.',
            submit: 'Atur ulang kata sandi',
        },
        confirmPassword: {
            title: 'Konfirmasi kata sandi',
            description: 'Halaman yang Anda tuju dilindungi. Masukkan kembali kata sandi Anda untuk melanjutkan.',
            submit: 'Konfirmasi kata sandi',
        },
        twoFactorChallenge: {
            title: 'Verifikasi dua langkah',
            code: {
                heading: 'Kode verifikasi',
                description: 'Masukkan kode verifikasi yang tampil di aplikasi autentikator Anda.',
            },
            recovery: {
                heading: 'Kode pemulihan',
                description: 'Masukkan salah satu kode pemulihan untuk membuktikan bahwa akun ini milik Anda.',
                placeholder: 'Masukkan kode pemulihan',
            },
            submit: 'Lanjutkan',
            alternative: 'Atau Anda dapat',
            useRecoveryCode: 'masuk dengan kode pemulihan',
            useCode: 'masuk dengan kode verifikasi',
        },
    },
    settings: {
        twoFactorRequired: 'Peran Anda mewajibkan verifikasi dua langkah. Aktifkan sebelum melanjutkan.',
        save: 'Simpan',
        errorTitle: 'Terjadi kesalahan',
        profile: {
            title: 'Pengaturan profil',
            heading: 'Profil',
            description: 'Perbarui nama dan alamat surel Anda.',
            name: 'Nama',
            namePlaceholder: 'Nama lengkap',
            email: 'Alamat surel',
        },
        security: {
            title: 'Pengaturan keamanan',
        },
        password: {
            heading: 'Perbarui kata sandi',
            description: 'Gunakan kata sandi yang panjang dan acak agar akun Anda tetap aman.',
            current: 'Kata sandi saat ini',
            new: 'Kata sandi baru',
            confirmation: 'Ulangi kata sandi baru',
        },
        twoFactor: {
            heading: 'Verifikasi dua langkah',
            description: 'Kelola pengaturan verifikasi dua langkah Anda.',
            enabledHelp:
                'Setiap kali masuk, Anda akan diminta memasukkan kode verifikasi yang tampil di aplikasi autentikator pada telepon genggam Anda.',
            disabledHelp:
                'Setelah verifikasi dua langkah diaktifkan, Anda akan diminta memasukkan kode verifikasi setiap kali masuk. Kode tersebut tampil di aplikasi autentikator pada telepon genggam Anda.',
            enable: 'Aktifkan verifikasi dua langkah',
            disable: 'Nonaktifkan verifikasi dua langkah',
            continueSetup: 'Lanjutkan penyiapan',
            loadError: 'Data verifikasi dua langkah tidak dapat dimuat. Muat ulang halaman, lalu coba lagi.',
        },
        twoFactorSetup: {
            enableTitle: 'Aktifkan verifikasi dua langkah',
            enableDescription:
                'Untuk menyelesaikan pengaktifan verifikasi dua langkah, pindai kode QR atau masukkan kunci penyiapan di aplikasi autentikator Anda.',
            enabledTitle: 'Verifikasi dua langkah telah aktif',
            enabledDescription: 'Pindai kode QR atau masukkan kunci penyiapan di aplikasi autentikator Anda.',
            verifyTitle: 'Konfirmasi kode verifikasi',
            verifyDescription: 'Masukkan kode {length} angka dari aplikasi autentikator Anda.',
            manualEntry: 'Atau masukkan kunci penyiapan secara manual',
            continue: 'Lanjutkan',
            close: 'Tutup',
            back: 'Kembali',
            confirm: 'Konfirmasi',
        },
        recoveryCodes: {
            heading: 'Kode pemulihan',
            description:
                'Kode pemulihan memungkinkan Anda masuk kembali jika Anda kehilangan perangkat tempat aplikasi autentikator terpasang. Simpan kode ini di aplikasi pengelola kata sandi yang aman.',
            show: 'Tampilkan kode pemulihan',
            hide: 'Sembunyikan kode pemulihan',
            regenerate: 'Buat ulang kode',
            listLabel: 'Kode pemulihan',
            loading: 'Memuat kode pemulihan',
            usageBefore:
                'Setiap kode pemulihan hanya dapat digunakan satu kali untuk masuk ke akun Anda, lalu dihapus. Jika memerlukan kode baru, pilih',
            usageAfter: 'di atas.',
        },
    },
} as const;
