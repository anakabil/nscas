# 01. Kebutuhan Produk

## 1. Tujuan

NSCAS menjalankan seluruh siklus pengukuran tingkat kematangan budaya K3 secara daring: konfigurasi, pengumpulan data dari tiga lapisan, penilaian asesor, penetapan tingkat, daftar kesenjangan, rencana aksi, dan pelaporan. Sistem harus memungkinkan pengukuran ulang berkala dengan instrumen yang sama agar perubahan budaya dapat dibaca antarperiode.

### Kedudukan hasil

Hasil berupa indeks kematangan 1,00 sampai 5,00, tingkat indikatif setara Safety Culture Ladder, daftar kesenjangan, dan rencana aksi. Hasil **bukan** sertifikat. Teks berikut wajib muncul di halaman hasil, laporan, dan pernyataan hasil:

> Hasil ini merupakan pengukuran dan diagnosis internal yang menggunakan kerangka Safety Culture Ladder sebagai rujukan, dan bukan sertifikat maupun pernyataan resmi Safety Culture Ladder yang diterbitkan lembaga sertifikasi yang diakui NEN.

## 2. Peran pengguna

| Kode peran | Pihak | Tugas utama | Batasan |
|---|---|---|---|
| `SUPER_ADMIN` | Nusa Safety | Mengelola tenant, pengguna, konfigurasi sistem, keamanan | Tidak menilai; tidak dapat melihat identitas responden survei |
| `LEAD_ASSESSOR` | Nusa Safety | Menetapkan lingkup, mengunci parameter, memimpin rapat panel, menyetujui skor akhir dan laporan | Tidak dapat mengubah jawaban mentah responden |
| `ASSESSOR` | Nusa Safety | Menilai bukti, melaksanakan wawancara, diskusi kelompok, dan kunjungan virtual | Tidak dapat mengubah bobot dan ambang |
| `CLIENT_ADMIN` | Klien | Mengelola daftar responden, mengunggah bukti, memantau partisipasi | Tidak dapat melihat jawaban perorangan atau mengubah skor |
| `UNIT_COORDINATOR` | Klien | Mendorong partisipasi unitnya, mengunggah bukti dan observasi digital | Hanya unit yang ditugaskan |
| `EXECUTIVE_VIEWER` | Klien | Melihat dasbor hasil dan laporan | Hanya baca; tanpa data mentah |
| Responden | Klien dan penyedia jasa | Mengisi survei melalui tautan bertoken | Tanpa akun; anonim |
| Responden penilaian mandiri | Manajemen dan fungsi K3 klien | Mengisi penilaian mandiri berjenjang dengan alasan | Teridentifikasi; diberi tahu di layar |

Satu pengguna dapat memiliki peran berbeda pada organisasi berbeda. Peran asesor ditugaskan per asesmen.

## 3. Siklus status asesmen

```
DRAFT -> CONFIGURED -> LOCKED -> DATA_COLLECTION -> SCORING -> PANEL_REVIEW -> ACTION_PLANNING -> REPORTED -> MONITORING -> ARCHIVED -> PURGED
```

| Transisi | Syarat | Pelaku |
|---|---|---|
| DRAFT ke CONFIGURED | Unit, strata, populasi strata, dan instrumen terisi | LEAD_ASSESSOR |
| CONFIGURED ke LOCKED | Teks persetujuan responden dan status perjanjian pemrosesan data terisi; kalkulator sampel dijalankan | LEAD_ASSESSOR |
| LOCKED ke DATA_COLLECTION | Daftar responden diimpor; token diterbitkan | LEAD_ASSESSOR |
| DATA_COLLECTION ke SCORING | Survei ditutup; setiap karakteristik memiliki nilai dari dua asesor | LEAD_ASSESSOR |
| SCORING ke PANEL_REVIEW | Mesin penilaian dijalankan; hasil tersimpan sebagai `ScoreRun` | LEAD_ASSESSOR |
| PANEL_REVIEW ke ACTION_PLANNING | Setiap penyesuaian panel memiliki alasan tertulis; hasil dikunci | LEAD_ASSESSOR |
| ACTION_PLANNING ke REPORTED | Laporan final dibuat dan ditandatangani | LEAD_ASSESSOR |
| REPORTED ke MONITORING | Rencana aksi diterbitkan ke klien | LEAD_ASSESSOR |
| ARCHIVED ke PURGED | Masa retensi habis; berita acara pemusnahan dibuat | SUPER_ADMIN |

Pengumpulan data dari tiga lapisan berjalan bersamaan selama `DATA_COLLECTION`. Setiap transisi tercatat di jejak audit.

## 4. Dua belas modul

### M1. Administrasi dan konfigurasi asesmen
- Membuat organisasi klien dan asesmen dengan lingkup KORPORAT, DIVISI, atau PROYEK, periode, dan tingkat sasaran.
- Mengelola struktur unit (kantor pusat, divisi, proyek, cabang) secara bertingkat, termasuk lokasi geografis proyek untuk observasi digital.
- Mengelola strata jabatan (bawaan lima strata dari seed) dan populasi tiap strata.
- Memilih versi instrumen dan menampilkan parameter bawaan dari seed; parameter dapat disesuaikan sebelum dikunci.
- Tombol kunci menyalin seluruh parameter ke `Assessment.parameterSnapshot`.

**Penerimaan:** setelah dikunci, formulir parameter menjadi baca saja dan upaya mengubah melalui API ditolak dengan kode 409.

### M2. Manajemen responden
- Impor daftar responden dari Excel atau CSV dengan kolom: nama, nomor induk, surel, telepon, unit, strata, status penyedia jasa. Tampilkan pratinjau, galat per baris, dan ringkasan sebelum disimpan.
- Kalkulator sampel menampilkan kebutuhan minimum dan sasaran per strata sesuai `docs/03`.
- Penerbitan token per responden. Distribusi melalui surel, tautan salin, dan kode QR yang dapat dicetak untuk ditempel di lokasi proyek.
- Untuk pekerja penyedia jasa tanpa surel, koordinator dapat membagikan kode QR unit yang menerbitkan token sekali pakai saat dibuka; strata dipilih responden dari daftar tertutup.
- Pengingat otomatis terjadwal (pg-boss) kepada token yang belum selesai, paling banyak tiga kali.
- Dasbor partisipasi harian per strata dan per unit, dengan penanda strata di bawah 30 persen.

**Penerimaan:** impor 3.000 baris selesai di bawah 30 detik; token yang dicabut tidak dapat dipakai.

### M3. Survei persepsi budaya
- Diakses melalui tautan bertoken, tanpa akun, ramah telepon genggam.
- Layar persetujuan pemrosesan data sebelum mulai. Menolak berarti selesai tanpa data tersimpan.
- Bagian A: satu karakteristik per layar, lima pernyataan berjenjang dalam urutan acak per responden, nomor tingkat tidak ditampilkan, ditambah pilihan "Tidak tahu".
- Bagian B: butir skala iklim Likert lima titik, beberapa butir per layar.
- Pilihan bahasa Indonesia dan Inggris.
- Jawaban tersimpan sementara hanya di perangkat (IndexedDB) dan dikirim sekali di akhir. Bila sinyal terputus, pengiriman diulang otomatis.
- Indikator kemajuan dan perkiraan sisa waktu.

**Penerimaan:** survei tetap dapat diisi setelah sambungan terputus di tengah jalan; token tidak dapat dipakai dua kali; ukuran muatan halaman survei di bawah 350 KB terkompresi.

### M4. Penilaian mandiri terstruktur
- Diisi manajemen dan fungsi K3 yang ditunjuk, teridentifikasi.
- Per karakteristik: pilih satu pernyataan berjenjang, tulis alasan minimal 50 karakter, dan tautkan bukti dari M5. Jawaban tanpa alasan tidak dapat dikirim.
- Dapat disimpan sebagai draf di server karena tidak anonim.

### M5. Penyimpanan bukti
- Unggah dokumen (PDF, gambar, Excel, Word, maksimal 25 MB per berkas) dan petakan ke satu atau lebih karakteristik.
- Daftar periksa bukti per karakteristik dari `evidenceExamples` pada seed instrumen, dengan status lengkap atau belum.
- Penomoran versi; versi lama tetap tersimpan.
- Hash SHA-256 tersimpan untuk setiap berkas.
- Indikator karakteristik yang belum memiliki minimal dua jenis bukti.

### M6. Observasi digital
- Asesor membuat jendela observasi per proyek: waktu buka, waktu tutup, daftar periksa observasi, dan titik koordinat proyek dengan radius toleransi.
- Koordinator proyek mengambil foto atau video melalui kamera perangkat di dalam aplikasi. Waktu dicatat oleh server; lokasi dari peramban beserta akurasinya.
- Unggahan di luar jendela waktu ditolak. Unggahan di luar radius diterima tetapi ditandai.
- Pengunggahan berkas dari galeri tidak diizinkan untuk observasi.

### M7. Wawancara dan diskusi kelompok daring
- Penjadwalan sesi: jenis (WAWANCARA, DISKUSI_KELOMPOK, KUNJUNGAN_VIRTUAL), unit, strata, waktu, tautan rapat eksternal (Zoom, Google Meet, atau Microsoft Teams).
- Aplikasi tidak membangun layanan konferensi video sendiri.
- Panduan pertanyaan terstruktur per lapisan jabatan, disimpan sebagai templat yang dapat diubah lead assessor.
- Formulir asesor per sesi: nilai 1 sampai 5 per karakteristik yang dibahas, catatan, dan persetujuan perekaman.
- Daftar nama narasumber disimpan terpisah untuk lampiran laporan; pernyataan dalam catatan tidak dikaitkan ke nama.

### M8. Mesin penilaian
- Implementasi `docs/03` sebagai modul murni dengan tes fixture.
- Setiap eksekusi menyimpan `ScoreRun` berisi snapshot masukan, parameter, versi mesin, dan hasil.
- Rapat panel: lead assessor dapat menyesuaikan nilai akhir karakteristik dengan alasan wajib. Nilai mesin dan nilai panel keduanya tersimpan dan tampil di laporan.
- Masukan jalur setara Safety Culture Ladder: persentase pemenuhan per aspek per tingkat beserta alasan.

### M9. Analitik dan dasbor
- Kartu indeks organisasi, tingkat indikatif, status kemantapan tingkat, kesenjangan terhadap sasaran.
- Grafik batang indeks per aspek dan per karakteristik terhadap sasaran.
- Peta warna aspek terhadap strata dan aspek terhadap unit, dengan penyembunyian sel di bawah lima responden.
- Daftar karakteristik terkena aturan selisih persepsi dan bukti.
- Kesenjangan persepsi manajemen terhadap pelaksana per aspek.
- Statistik mutu: partisipasi, alfa Cronbach per dimensi, rwg per unit, jawaban yang ditandai.
- Pembandingan antarperiode bila organisasi memiliki asesmen sebelumnya dengan versi instrumen yang sama.

### M10. Daftar kesenjangan dan rencana aksi
- Daftar kesenjangan dibentuk otomatis untuk setiap karakteristik dengan indeks akhir di bawah tingkat sasaran, diurutkan menurut bobot aspek dikali besar kesenjangan.
- Setiap butir: analisis penyebab, prioritas, dan satu atau lebih tindakan dengan penanggung jawab (nama dan jabatan), tenggat, indikator keberhasilan, dan status.
- Pemantauan triwulanan: pembaruan kemajuan, verifikasi asesor, riwayat perubahan.

### M11. Pelaporan
- Laporan HTML yang dapat dicetak dan diekspor ke PDF melalui Playwright di server, memakai identitas Nusa Safety.
- Struktur laporan mengikuti `docs/01` bagian 6.
- Ringkasan eksekutif dan pernyataan hasil sebagai dokumen terpisah.
- Penomoran versi laporan; versi final ditandatangani lead assessor (nama, jabatan, waktu) dan tidak dapat diubah.

### M12. Tata kelola data dan keamanan
Lihat `docs/04`.

## 5. Kebutuhan nonfungsional

| Aspek | Sasaran |
|---|---|
| Kapasitas | 3.000 responden per asesmen; 300 pengisian bersamaan tanpa penurunan berarti |
| Kinerja survei | Halaman pertama tampil di bawah 3 detik pada jaringan 3G |
| Ketersediaan | 99 persen selama jendela survei |
| Peramban | Chrome dan Safari versi dua tahun terakhir, termasuk Android 9 ke atas |
| Aksesibilitas | Kontras teks memenuhi WCAG AA; target sentuh minimal 44 piksel |
| Cadangan data | Harian, disimpan 30 hari, diuji pemulihannya setiap bulan |

## 6. Struktur laporan asesmen

1. Lingkup, batas organisasi, periode data
2. Metode, instrumen, kerangka sampel, bobot, ambang
3. Partisipasi per strata dan unit, penilaian keterwakilan
4. Uji keandalan instrumen dan kesepakatan dalam kelompok
5. Indeks per karakteristik, per aspek, dan organisasi, beserta matriks triangulasi
6. Karakteristik terkena aturan selisih, dengan penjelasan
7. Kesenjangan persepsi manajemen dan pelaksana
8. Tingkat kematangan indikatif, status kemantapan, catatan rapat panel
9. Hasil dua dimensi kontekstual nasional, dilaporkan terpisah
10. Daftar kesenjangan dan rekomendasi prioritas
11. Pernyataan keterbatasan
12. Lampiran: daftar narasumber, daftar bukti, parameter terkunci

## 7. Di luar lingkup versi pertama

- Konferensi video bawaan
- Sertifikasi Safety Culture Ladder dalam bentuk apa pun
- Fitur kecerdasan buatan yang mengirim data ke layanan luar negeri
- Aplikasi seluler asli; cukup aplikasi web yang dapat dipasang (PWA) untuk observasi digital
- Pengingat WhatsApp; disiapkan antarmukanya, implementasi menyusul
