# 05. Panduan Tampilan dan Bahasa

## 1. Identitas visual

Mengikuti templat paparan Nusa Safety yang dipakai pada penawaran ke PT Adhi Karya.

| Token | Nilai | Pemakaian |
|---|---|---|
| `--brand-navy` | `#000B9D` | Warna utama, judul, tombol utama, batang grafik |
| `--brand-yellow` | `#FDC830` | Aksen, sorotan, nilai di bawah sasaran pada grafik |
| `--brand-purple` | `#5B4BD6` | Warna pendukung, kategori kedua |
| `--text` | `#1B1B33` | Teks utama |
| `--text-muted` | `#5E6075` | Teks sekunder |
| `--surface` | `#FFFFFF` | Latar kartu |
| `--surface-alt` | `#F6F7FC` | Latar halaman |
| `--tint` | `#EBEDFA` | Latar sorotan lembut |
| `--border` | `#D3D6E8` | Garis tepi |
| `--success` | `#1E9E6A` | Status baik |
| `--warning` | `#B45309` | Peringatan |
| `--danger` | `#C2410C` | Galat, kesenjangan besar |

Peta warna hasil: hijau muda `#D7F0E3` untuk 3,3 ke atas, kuning muda `#FFF1C7` untuk 2,8 sampai 3,2, merah muda `#F8D7D5` untuk di bawah 2,8. Sel yang disembunyikan karena kurang dari 5 responden diberi arsir abu-abu dengan keterangan.

Gradasi lima tingkat kematangan (1 ke 5): `#B8BBCF`, `#9A9EC4`, `#6F74C2`, `#3B40B8`, `#000B9D`.

Huruf: Plus Jakarta Sans (next/font, dimuat lokal) untuk seluruh antarmuka. Angka besar memakai `font-variant-numeric: tabular-nums`.

Logo: `public/brand/logo-long-color.png` untuk kepala konsol dan laporan, `logo-short-color.png` untuk ikon aplikasi, `logo-short-white.png` untuk latar gelap. Berkas asal tersedia di folder `aset-logo/`.

## 2. Pola komponen

- Kartu dengan sudut 12 piksel, garis tepi tipis, tanpa bayangan tebal.
- Ikon di dalam lingkaran berwarna sebagai penanda bagian, sama seperti paparan.
- Kartu indeks: angka besar dua desimal, nama tingkat di bawahnya, status kemantapan sebagai lencana.
- Tabel padat untuk konsol asesor; kartu bertumpuk untuk tampilan telepon genggam.
- Setiap halaman konsol menampilkan nama organisasi, nama asesmen, dan status asesmen di bagian atas.
- Hasil yang belum final diberi pita "Draf, belum ditetapkan rapat panel".

## 3. Halaman survei (prioritas tertinggi)

- Dirancang untuk telepon genggam lebih dulu, lebar 360 piksel.
- Satu karakteristik per layar. Kelima pernyataan tampil sebagai kartu pilihan berukuran penuh dengan target sentuh minimal 48 piksel, urutan acak per responden, tanpa nomor tingkat.
- Pilihan "Tidak tahu" tampil terpisah di bawah, dengan gaya lebih ringan.
- Bilah kemajuan dan teks "Pertanyaan 5 dari 18".
- Tombol Kembali dan Lanjut tetap di bagian bawah layar.
- Huruf dasar 17 piksel; jarak baris 1,5.
- Tidak ada animasi berat; halaman harus ringan untuk sinyal lemah di lokasi proyek.
- Layar terakhir: ucapan terima kasih dan penegasan bahwa jawaban anonim.

## 4. Aturan bahasa antarmuka

1. Bahasa Indonesia baku dan formal, tetapi mudah dipahami pekerja lapangan. Kalimat pendek, kata kerja aktif.
2. Tidak memakai singkatan. Tulis "alat pelindung diri", "diskusi kelompok terarah", "Pajak Pertambahan Nilai", "nomor". Pengecualian: K3 (dijelaskan sebagai keselamatan dan kesehatan kerja pada kemunculan pertama di setiap alur), NSCAS, dan nama lembaga resmi.
3. Tidak memakai tanda pisah panjang. Gunakan koma atau titik.
4. Istilah tetap:

| Gunakan | Hindari |
|---|---|
| asesmen | assessment, penilaian (untuk keseluruhan proses) |
| asesor | assessor, auditor |
| responden | partisipan |
| penilaian mandiri | self-assessment |
| bukti | evidence |
| kunjungan lapangan virtual | virtual site visit, penelusuran lapangan virtual |
| rapat panel asesor | panel konsensus |
| daftar kesenjangan | register kesenjangan, gap register |
| rencana aksi | action plan |
| tingkat kematangan | maturity level |
| aturan selisih persepsi dan bukti | aturan divergensi |
| kemantapan tingkat | konsolidasi |
| dasbor | dashboard |

5. Pesan galat menjelaskan apa yang terjadi dan apa yang perlu dilakukan. Contoh: "Berkas melebihi 25 MB. Kompres berkas atau bagi menjadi beberapa bagian."
6. Angka memakai format Indonesia: 3,14 dan 3.000.
7. Tanggal ditulis "23 Oktober 2026"; waktu "08.00 WIB".
