// Teks halaman masuk dan pengaturan akun, bahasa Indonesia (sumber). Aturan bahasa: docs/05 bagian 4.
// Istilah tetap: surel, kata sandi, verifikasi dua langkah, kode pemulihan, aplikasi autentikator, Masuk, Keluar.

export const account = {
    auth: {
        fields: {
            email: 'Alamat surel',
            emailPlaceholder: 'nama@example.com',
            password: 'Kata sandi',
            passwordConfirmation: 'Konfirmasi kata sandi',
        },
        passwordVisibility: {
            show: 'Tampilkan kata sandi',
            hide: 'Sembunyikan kata sandi',
        },
        login: {
            title: 'Masuk',
            heading: 'Masuk ke akun Anda',
            description: 'Masukkan alamat surel dan kata sandi Anda untuk masuk.',
            forgotPassword: 'Lupa kata sandi?',
            remember: 'Ingat saya',
            submit: 'Masuk',
        },
        forgotPassword: {
            title: 'Lupa kata sandi',
            description: 'Masukkan alamat surel Anda untuk menerima tautan pengaturan ulang kata sandi.',
            submit: 'Kirim tautan pengaturan ulang kata sandi',
            returnTo: 'Atau kembali ke',
            returnLink: 'halaman masuk',
        },
        resetPassword: {
            title: 'Atur ulang kata sandi',
            description: 'Masukkan kata sandi baru Anda di bawah ini.',
            submit: 'Atur ulang kata sandi',
        },
        confirmPassword: {
            title: 'Konfirmasi kata sandi',
            description: 'Halaman yang Anda tuju dilindungi. Masukkan kembali kata sandi Anda sebelum melanjutkan.',
            submit: 'Konfirmasi kata sandi',
        },
        twoFactorChallenge: {
            title: 'Verifikasi dua langkah',
            code: {
                heading: 'Kode verifikasi',
                description: 'Masukkan kode verifikasi yang ditampilkan aplikasi autentikator Anda.',
            },
            recovery: {
                heading: 'Kode pemulihan',
                description: 'Masukkan salah satu kode pemulihan Anda untuk memastikan bahwa akun ini milik Anda.',
                placeholder: 'Masukkan kode pemulihan',
            },
            submit: 'Lanjutkan',
            alternative: 'atau Anda dapat',
            useRecoveryCode: 'masuk dengan kode pemulihan',
            useCode: 'masuk dengan kode verifikasi',
        },
    },
    settings: {
        twoFactorRequired: 'Peran Anda mewajibkan verifikasi dua langkah. Aktifkan sebelum melanjutkan.',
        save: 'Simpan',
        errorTitle: 'Terjadi kesalahan.',
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
            confirmation: 'Konfirmasi kata sandi',
        },
        twoFactor: {
            heading: 'Verifikasi dua langkah',
            description: 'Kelola pengaturan verifikasi dua langkah Anda.',
            enabledHelp:
                'Setiap kali masuk, Anda akan diminta memasukkan kode verifikasi yang ditampilkan aplikasi autentikator di telepon genggam Anda.',
            disabledHelp:
                'Setelah verifikasi dua langkah diaktifkan, Anda akan diminta memasukkan kode verifikasi setiap kali masuk. Kode tersebut ditampilkan aplikasi autentikator di telepon genggam Anda.',
            enable: 'Aktifkan verifikasi dua langkah',
            disable: 'Nonaktifkan verifikasi dua langkah',
            continueSetup: 'Lanjutkan penyiapan',
            loadError: 'Data verifikasi dua langkah tidak dapat dimuat. Muat ulang halaman, lalu coba lagi.',
        },
        twoFactorSetup: {
            enableTitle: 'Aktifkan verifikasi dua langkah',
            enableDescription:
                'Untuk menyelesaikan pengaktifan verifikasi dua langkah, pindai kode QR atau masukkan kunci penyiapan di aplikasi autentikator Anda.',
            enabledTitle: 'Verifikasi dua langkah sudah aktif',
            enabledDescription:
                'Verifikasi dua langkah sekarang aktif. Pindai kode QR atau masukkan kunci penyiapan di aplikasi autentikator Anda.',
            verifyTitle: 'Periksa kode verifikasi',
            verifyDescription: 'Masukkan kode {length} angka dari aplikasi autentikator Anda.',
            manualEntry: 'atau masukkan kunci penyiapan secara manual',
            continue: 'Lanjutkan',
            close: 'Tutup',
            back: 'Kembali',
            confirm: 'Konfirmasi',
        },
        recoveryCodes: {
            heading: 'Kode pemulihan',
            description:
                'Kode pemulihan memungkinkan Anda masuk kembali apabila kehilangan perangkat yang memuat aplikasi autentikator. Simpan kode ini di pengelola kata sandi yang aman.',
            show: 'Tampilkan kode pemulihan',
            hide: 'Sembunyikan kode pemulihan',
            regenerate: 'Buat ulang kode',
            listLabel: 'Kode pemulihan',
            loading: 'Memuat kode pemulihan',
            usageBefore:
                'Setiap kode pemulihan hanya dapat dipakai satu kali untuk masuk ke akun Anda dan dihapus setelah dipakai. Jika memerlukan kode baru, pilih',
            usageAfter: 'di atas.',
        },
    },
} as const;
