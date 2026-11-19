# 04. Privasi, Keamanan, dan Retensi

Catatan versi 2. Ketentuan pada dokumen ini tetap berlaku. Rujukan ke berkas `src/...` menunjuk implementasi versi 1 (riwayat Git `8ad6b3d`) dan diganti dengan padanan Laravel saat modulnya dibangun ulang. Bagian 1.1 tentang lokasi data adalah ketentuan baru.

## 1. Dasar

- Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi: Nusa Safety bertindak sebagai prosesor data atas nama klien sebagai pengendali data, berdasarkan perjanjian pemrosesan data.
- Peraturan Pemerintah Nomor 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik. Kewajiban penempatan data di Indonesia terutama berlaku bagi penyelenggara lingkup publik.
- Komitmen proposal: identitas responden dipisahkan dari jawaban, hasil hanya dilaporkan agregat, minimal 5 responden per sel laporan, dan data mentah dimusnahkan dengan berita acara. Komitmen lokasi data diatur di bagian 1.1.

### 1.1 Lokasi data: DigitalOcean wilayah Singapura

Keputusan pemilik proyek, 19 November 2026: produksi NSCAS ditempatkan di DigitalOcean. DigitalOcean tidak memiliki pusat data di Indonesia; wilayah terdekat adalah Singapura (`sgp1`). Basis data, penyimpanan berkas, dan cadangan berada di wilayah itu.

Keputusan ini mengubah komitmen proposal awal kepada klien, yang menjanjikan penyimpanan di pusat data Indonesia. Karena itu berlaku ketentuan berikut.

| No. | Syarat sebelum ada data responden nyata | Dasar | Penanggung jawab | Status |
|---|---|---|---|---|
| 1 | Persetujuan tertulis klien atas lokasi Singapura, sebagai adendum proposal atau klausul perjanjian pemrosesan data | Komitmen proposal; UU 27/2022 tentang kewajiban prosesor bertindak atas perintah pengendali | Nusa Safety | Belum |
| 2 | Perjanjian pemrosesan data menyebut lokasi, penyedia layanan, dan langkah pengamanan | UU 27/2022 | Nusa Safety dan klien | Belum |
| 3 | Dasar transfer ke luar negeri didokumentasikan: tingkat pelindungan di negara tujuan, atau pelindungan yang memadai dan mengikat, atau persetujuan subjek data | UU 27/2022 Pasal 56 | Klien sebagai pengendali, dibantu Nusa Safety | Belum |
| 4 | Teks persetujuan responden menyebut Singapura | UU 27/2022 tentang persetujuan yang jelas dan spesifik | Nusa Safety | Sudah di bagian 8; berlaku di aplikasi lewat `NSCAS_DATA_LOCATION` |
| 5 | Enkripsi saat transit dan saat tersimpan, serta cadangan terenkripsi di wilayah yang sama | Praktik pengamanan | Nusa Safety | Disiapkan di `docs/08` |

Keputusan pemilik proyek, 19 November 2026: persetujuan atas lokasi Singapura tetap mengikuti rencana awal. Nusa Safety menyerahkan rumusan adendum atau klausul perjanjian pemrosesan data kepada klien untuk dibaca dan disetujui; tidak ada perubahan rancangan aplikasi.

Selama syarat 1 sampai 3 belum terpenuhi, server DigitalOcean hanya boleh dipakai untuk uji coba dengan data buatan. Rancangan aplikasi tetap dapat dipindah ke penyedia lain karena seluruhnya berjalan di Docker dengan PostgreSQL dan penyimpanan kompatibel S3.

Catatan untuk penasihat hukum. Uraian ini adalah pembacaan praktisi K3 atas ketentuan pelindungan data, bukan pendapat hukum. Rumusan adendum dan dasar transfer sebaiknya ditinjau penasihat hukum perusahaan.

### 1.2 Subprosesor

Pihak yang menerima data pribadi responden atas nama Nusa Safety. Daftar ini dicantumkan pada perjanjian pemrosesan data; penambahan subprosesor memerlukan persetujuan tertulis klien (CLAUDE.md aturan 7).

| Subprosesor | Data yang diterima | Keperluan | Lokasi | Status |
|---|---|---|---|---|
| DigitalOcean | Seluruh data aplikasi: daftar responden (kontak terenkripsi), token, jawaban, bukti, cadangan terenkripsi | Server, basis data, penyimpanan berkas | Singapura (`sgp1`) | Keputusan pemilik proyek, 19 November 2026 |
| Hostinger (Hostinger Mail, kotak surat `admin@nusasafety.co.id`) | Nama dan alamat surel responden, tautan survei pribadi, nama organisasi | Pengiriman undangan dan pengingat survei, serta surel akun pengguna | Lokasi server surel dicatat dari hPanel sebelum undangan pertama | Keputusan pemilik proyek, fase R2 |

Surel undangan tidak memuat gambar dari server luar dan tidak memakai pelacak pembukaan. Nomor telepon responden tidak dikirim ke pihak mana pun; pada fase R2 nomor itu hanya disimpan terenkripsi untuk dipakai koordinator.

## 2. Matriks hak akses

Tanda: B = baca, U = ubah, X = tidak ada akses.

| Sumber daya | SUPER_ADMIN | LEAD_ASSESSOR | ASSESSOR | CLIENT_ADMIN | UNIT_COORDINATOR | EXECUTIVE_VIEWER |
|---|---|---|---|---|---|---|
| Organisasi dan pengguna | U | B | X | U (pengguna klien) | X | X |
| Parameter asesmen sebelum dikunci | B | U | B | B | X | X |
| Parameter setelah dikunci | B | B | B | B | X | B |
| Daftar responden | X | B | X | U | U (unitnya) | X |
| Token dan partisipasi | B | B | B | U | B (unitnya) | B (agregat) |
| Jawaban survei mentah | X | B (tanpa identitas) | B (tanpa identitas) | X | X | X |
| Penilaian mandiri | X | B | B | B (milik organisasinya) | X | X |
| Bukti dan observasi | X | B | B | U | U (unitnya) | X |
| Nilai asesor | X | U | U (miliknya) | X | X | X |
| Penyesuaian panel dan finalisasi | X | U | B | X | X | X |
| Dasbor hasil | X | B | B | B | B (unitnya, setelah final) | B |
| Rencana aksi | X | U | U | U | U (unitnya) | B |
| Laporan | X | U | B | B | X | B |
| Jejak audit | B | B (asesmennya) | X | B (asesmennya, tanpa data mentah) | X | X |

SUPER_ADMIN tidak dapat melihat daftar responden dan jawaban mentah agar pengelola sistem tidak dapat menghubungkan identitas dengan jawaban.

Seluruh pemeriksaan dilakukan di server melalui `App\Support\AssessmentAccess::require($user, $assessment, $resource, $mode)`; matriksnya ada di `App\Domain\Access\Permissions`. Pengguna tanpa peran pada sebuah asesmen menerima 404 agar keberadaan asesmen organisasi lain tidak terungkap. Tes wajib mencakup upaya akses lintas organisasi dan lintas unit yang harus ditolak.

## 3. Autentikasi

- Kata sandi minimal 12 karakter, di-hash dengan argon2id.
- TOTP wajib untuk SUPER_ADMIN, LEAD_ASSESSOR, ASSESSOR, dan CLIENT_ADMIN. Disediakan 10 kode cadangan sekali pakai.
- Sesi kedaluwarsa setelah 8 jam, atau setelah 30 menit tidak aktif untuk peran Nusa Safety.
- Penguncian akun setelah 5 kali gagal masuk dalam 15 menit.
- Responden survei tidak memiliki akun; token acak 32 byte (base64url), hanya hash yang disimpan, berlaku sampai survei ditutup.

## 4. Enkripsi

- TLS 1.2 ke atas melalui Caddy; HSTS aktif.
- Kolom `emailEnc`, `phoneEnc`, `totpSecretEnc` dienkripsi AES-256-GCM dengan `DATA_ENCRYPTION_KEY` di `src/lib/privacy/crypto.ts`.
- Volume basis data dan penyimpanan objek dienkripsi pada tingkat disk penyedia.
- Cadangan basis data dienkripsi sebelum dikirim ke penyimpanan cadangan.

## 5. Header dan pembatasan

- Content-Security-Policy ketat tanpa skrip pihak ketiga. Tidak ada Google Analytics, Hotjar, atau sejenisnya.
- `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` pada rute survei agar token tidak bocor melalui perujuk.
- Pembatas laju: masuk 10 per menit per akun; rute survei 60 permintaan per menit per hash IP; unggah 30 per menit per pengguna.
- Validasi jenis berkas dengan pemeriksaan isi (magic bytes), bukan hanya ekstensi. Fase R5: `App\Domain\Files\FileType`; bukti juga harus sesuai ekstensi namanya; batas 25 MB per berkas; SHA-256 dihitung server dari seluruh isi.
- Unggah bukti dan observasi: izin unggah 60 per menit per pengguna; URL unggah bertanda tangan berlaku 15 menit dan URL unduh 5 menit; bucket privat. Berkas yang tidak pernah diselesaikan dihapus setiap jam.

## 6. Jejak audit

Aksi yang wajib dicatat:

| Kategori | Aksi |
|---|---|
| Akses | masuk, gagal masuk, aktivasi dan reset TOTP, perubahan peran |
| Asesmen | pembuatan, perubahan parameter, penguncian, setiap transisi status |
| Responden | impor daftar, penerbitan, pencabutan, dan pengiriman ulang token |
| Data | pengeluaran respons dari analisis beserta alasannya |
| Bukti | unggah (`evidence.upload`), versi baru (`evidence.version`), perubahan pemetaan (`evidence.map`), penghapusan logis (`evidence.delete`) |
| Observasi | pembukaan masa observasi (`observation.window_create`), setiap rekaman (`observation.capture`) |
| Penilaian | setiap nilai asesor, eksekusi mesin, penyesuaian panel, finalisasi |
| Laporan | pembuatan, penandatanganan, pengunduhan |
| Retensi | pemusnahan beserta berita acara |

Tabel `AuditLog` dilindungi pemicu PostgreSQL yang menolak UPDATE dan DELETE. Lead assessor dapat mengekspor jejak audit asesmennya ke CSV.

## 7. Retensi dan pemusnahan

- Masa simpan data mentah bawaan 36 bulan sejak laporan final.
- Tugas mingguan menandai asesmen yang melewati masa simpan; pemusnahan dijalankan SUPER_ADMIN setelah konfirmasi tertulis klien.
- Yang dimusnahkan: `RosterEntry`, `AccessToken`, `SurveyResponse` beserta jawabannya, `SelfAssessment`, berkas bukti, observasi, dan rekaman.
- Bukti yang dihapus pengguna hanya dihapus secara logis (fase R5): tidak lagi dihitung dan tidak tampil di daftar, tetapi berkasnya tetap tersimpan dan dapat diunduh pihak yang berhak sampai pemusnahan data asesmen, agar jejak penilaian utuh.
- Rekaman observasi memuat data pribadi: nama pengunggah, waktu, dan lokasi perangkat, serta kemungkinan wajah pekerja pada foto atau video. Rekaman tidak anonim (diberitahukan di halaman kamera), hanya dapat dilihat peran pada matriks bagian 2, dan dimusnahkan bersama data mentah asesmen.
- Yang disimpan: hasil agregat, `ScoreRun` final, laporan final, `DestructionRecord`, dan jejak audit.
- Berita acara pemusnahan dibuat sebagai PDF dan dicatat di `DestructionRecord`.

## 8. Teks persetujuan responden (templat, dapat disesuaikan sebelum dikunci)

> Survei ini diselenggarakan oleh Nusa Safety atas permintaan {nama organisasi} untuk mengukur budaya keselamatan dan kesehatan kerja. Jawaban Anda tidak dapat dihubungkan dengan identitas Anda. Hasil hanya disajikan secara gabungan untuk kelompok paling sedikit lima orang. Data disimpan di pusat data di {lokasi data} dan dimusnahkan setelah {masa simpan} bulan. Keikutsertaan bersifat sukarela dan Anda dapat berhenti kapan saja. Dengan menekan tombol Setuju, Anda menyetujui pemrosesan jawaban sesuai Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.
