# 04. Privasi, Keamanan, dan Retensi

## 1. Dasar

- Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi: Nusa Safety bertindak sebagai prosesor data atas nama klien sebagai pengendali data, berdasarkan perjanjian pemrosesan data.
- Peraturan Pemerintah Nomor 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik. Kewajiban penempatan data di Indonesia terutama berlaku bagi penyelenggara lingkup publik, tetapi proposal kepada klien menjanjikan penyimpanan di pusat data Indonesia, sehingga janji itu mengikat.
- Komitmen proposal: identitas responden dipisahkan dari jawaban, hasil hanya dilaporkan agregat, minimal 5 responden per sel laporan, data disimpan di Indonesia, dan data mentah dimusnahkan dengan berita acara.

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

Seluruh pemeriksaan dilakukan di server melalui `requireRole(assessmentId, allowedRoles, { unitId? })` di `src/lib/auth/guard.ts`. Tes e2e wajib mencakup upaya akses lintas organisasi dan lintas unit yang harus ditolak.

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
- Validasi jenis berkas dengan pemeriksaan isi (magic bytes), bukan hanya ekstensi.

## 6. Jejak audit

Aksi yang wajib dicatat:

| Kategori | Aksi |
|---|---|
| Akses | masuk, gagal masuk, aktivasi dan reset TOTP, perubahan peran |
| Asesmen | pembuatan, perubahan parameter, penguncian, setiap transisi status |
| Responden | impor daftar, penerbitan, pencabutan, dan pengiriman ulang token |
| Data | pengeluaran respons dari analisis beserta alasannya |
| Bukti | unggah, versi baru, penghapusan logis |
| Penilaian | setiap nilai asesor, eksekusi mesin, penyesuaian panel, finalisasi |
| Laporan | pembuatan, penandatanganan, pengunduhan |
| Retensi | pemusnahan beserta berita acara |

Tabel `AuditLog` dilindungi pemicu PostgreSQL yang menolak UPDATE dan DELETE. Lead assessor dapat mengekspor jejak audit asesmennya ke CSV.

## 7. Retensi dan pemusnahan

- Masa simpan data mentah bawaan 36 bulan sejak laporan final.
- Tugas mingguan menandai asesmen yang melewati masa simpan; pemusnahan dijalankan SUPER_ADMIN setelah konfirmasi tertulis klien.
- Yang dimusnahkan: `RosterEntry`, `AccessToken`, `SurveyResponse` beserta jawabannya, `SelfAssessment`, berkas bukti, observasi, dan rekaman.
- Yang disimpan: hasil agregat, `ScoreRun` final, laporan final, `DestructionRecord`, dan jejak audit.
- Berita acara pemusnahan dibuat sebagai PDF dan dicatat di `DestructionRecord`.

## 8. Teks persetujuan responden (templat, dapat disesuaikan sebelum dikunci)

> Survei ini diselenggarakan oleh Nusa Safety atas permintaan {nama organisasi} untuk mengukur budaya keselamatan dan kesehatan kerja. Jawaban Anda tidak dapat dihubungkan dengan identitas Anda. Hasil hanya disajikan secara gabungan untuk kelompok paling sedikit lima orang. Data disimpan di pusat data di Indonesia dan dimusnahkan setelah {masa simpan} bulan. Keikutsertaan bersifat sukarela dan Anda dapat berhenti kapan saja. Dengan menekan tombol Setuju, Anda menyetujui pemrosesan jawaban sesuai Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.
