# 16. Bahan Validasi Lapangan dan Triangulasi

Dokumen ini menjelaskan bahan kerja asesor pada tahap validasi: pertanyaan wawancara, panduan diskusi kelompok terarah, dan lembar kerja kunjungan proyek. Dokumen ini juga menjelaskan cara hasilnya dikodekan untuk analisis. Bahan ini disusun atas permintaan pemilik proyek pada 20 November 2026. Isinya ada di `seed/panduan-validasi-v2.json`.

## 1. Dasar

Pengukuran budaya keselamatan yang hanya bersandar pada kuesioner cenderung menangkap iklim, yaitu persepsi sesaat, bukan praktik yang sebenarnya berjalan (Guldenmund, 2000; Cooper, 2000). Karena itu NSCAS menguji hasil survei dan penilaian mandiri dengan tiga sumber lapangan:

1. **Wawancara:** menggali contoh perilaku nyata dari manajemen dan penyelia.
2. **Diskusi kelompok terarah:** menangkap pengalaman bersama pekerja dalam bahasa sehari-hari.
3. **Kunjungan proyek:** memeriksa apakah praktik yang diceritakan memang terlihat di lapangan.

Membandingkan beberapa sumber untuk satu pertanyaan disebut triangulasi sumber. Cara ini lazim dipakai untuk menguji kredibilitas temuan kualitatif (Patton, 1999). Panduan diskusi kelompok mengikuti praktik baku: kelompok kecil dari jabatan yang setara, tanpa atasan langsung, dengan alur pembuka, pertanyaan inti, pendalaman, dan penutup (Krueger & Casey, 2015).

Butir lembar kunjungan disusun dari nama karakteristik instrumen NSCAS. Butir yang menyangkut kondisi fisik dan dokumen merujuk pada peraturan nasional:

- PP 50/2012 tentang SMK3;
- Permen PUPR 10/2021 tentang Sistem Manajemen Keselamatan Konstruksi;
- Permenakertrans 8/2010 tentang alat pelindung diri;
- Permenaker 9/2016 tentang pekerjaan pada ketinggian;
- Permenaker 5/2018 tentang K3 lingkungan kerja.

Bahan ini tidak menyalin kriteria skema sertifikasi Safety Culture Ladder (aturan 8 CLAUDE.md).

## 2. Isi bahan

| Bahan | Isi | Dipakai pada |
|---|---|---|
| Wawancara | Pembukaan dan penutup; per karakteristik: pertanyaan utama (dari panduan asesmen yang dapat diubah asesor utama), dua pertanyaan pendalaman, serta petunjuk jawaban kuat dan jawaban lemah | Sesi wawancara manajemen dan penyelia |
| Diskusi kelompok terarah | Aturan diskusi, pembukaan, pemanasan, per karakteristik: pertanyaan berbahasa sehari-hari dan dua pertanyaan pendalaman, penutup | Sesi diskusi kelompok; pertanyaan untuk kelompok pekerja otomatis memakai bahasa diskusi pada asesmen baru |
| Lembar kerja kunjungan proyek | 37 butir dalam tiga bagian: periksa dokumen (15), amati area kerja (13), tanya pekerja di lokasi (9). Setiap butir terpetakan ke satu karakteristik, dan setiap karakteristik paling sedikit punya satu butir | Sesi kunjungan proyek, baik langsung maupun daring |

Lembar kunjungan dibuat baku untuk semua asesmen, tidak dapat diubah per asesmen. Bahan ini disusun untuk kode karakteristik instrumen versi 1; butir dan pertanyaan yang karakteristiknya tidak ada di instrumen asesmen tidak ditampilkan. Pada antarmuka bahasa Inggris, bahan ditampilkan dalam bahasa Indonesia dengan catatan sampai terjemahannya ditelaah. Tujuannya agar hasil antarproyek dan antarperiode dapat dibandingkan. Setiap sesi juga dapat dicetak dari menu kerja asesor untuk dipakai di lapangan tanpa sambungan.

## 3. Kode untuk analisis

| Data | Kode | Arti |
|---|---|---|
| Nilai sesi (sudah ada sejak R6) | 1,0 sampai 5,0, kelipatan 0,5 | Penilaian asesor atas karakteristik dalam sesi itu |
| Kode bukti (wawancara dan diskusi) | CONSISTENT, PARTIAL, NONE | Contoh nyata dan konsisten; contoh ada tetapi belum konsisten; tidak ada contoh atau jawaban hanya normatif |
| Kesepakatan kelompok (diskusi saja) | AGREED, MIXED, DIVIDED | Peserta sepakat; sebagian berbeda pendapat; pendapat terbelah |
| Hasil butir kunjungan | MEETS, PARTIAL, NOT_MET, NOT_OBSERVED | Sesuai; sebagian; tidak sesuai; tidak dapat diperiksa |

Kode disimpan per asesor untuk wawancara dan diskusi, sehingga kesepakatan antarpenilai dapat dihitung. Hasil kunjungan disimpan satu per butir per sesi. Nama narasumber tidak ikut dalam data analisis maupun ekspor.

## 4. Ringkasan triangulasi

Untuk setiap karakteristik, `App\Domain\Validation\Triangulation` menghitung:

1. **Rerata nilai sesi:** keseluruhan dan per kelompok jabatan, beserta sebaran kode bukti dan kesepakatan kelompok. Hanya nilai dari wawancara dan diskusi kelompok yang dihitung; nilai yang diberikan pada sesi kunjungan proyek sudah terwakili lembar kerjanya sehingga tidak dihitung dua kali, dan sesi yang dibatalkan tidak ikut di ringkasan maupun ekspor (audit 21 November 2026).
2. **Indeks kunjungan:** (jumlah Sesuai + 0,5 × jumlah Sebagian) dibagi jumlah butir yang dapat diperiksa, dengan rentang 0 sampai 1. Butir yang tidak dapat diperiksa tidak dihitung.
3. **Penanda perlu dibahas:**
   - Nilai sesi dinormalkan ke rentang 0 sampai 1 dengan rumus (nilai − 1) / 4.
   - Bila selisihnya dengan indeks kunjungan paling sedikit 0,40, karakteristik ditandai untuk dibahas.
   - Contoh: wawancara memberi rerata 4,5 (setara 0,875) sedangkan indeks kunjungan 0,40. Selisihnya 0,475, jadi ditandai.

Ambang 0,40 adalah pilihan awal untuk menandai perbedaan yang cukup besar agar dibahas. Angka ini bukan batas statistik, dan dapat ditinjau setelah data beberapa proyek terkumpul.

Ringkasan ini bukan nilai. Mesin penilaian (`app/Domain/Scoring`) dan fixture-nya tidak berubah, sesuai keputusan pemilik proyek. Ringkasan dipakai di dua tempat:

- **Ruang kerja penilaian asesor:** panel Triangulasi sumber beserta butir kunjungan per karakteristik.
- **Ekspor Excel dari menu Wawancara dan diskusi kelompok:** empat lembar, yaitu Sesi, Kode sesi, Kunjungan proyek, dan Triangulasi.

## 5. Keterbatasan

1. Kode bukti dan hasil butir adalah penilaian asesor. Kalibrasi asesor (tahap 1) tetap diperlukan agar kode dipakai dengan arti yang sama.
2. Lembar kunjungan menangkap kondisi pada hari kunjungan. Satu kunjungan per proyek belum tentu mewakili keadaan sehari-hari.
3. Isi bahan versi 2 perlu ditelaah ahli Nusa Safety sebelum dipakai pada klien, sama seperti skala iklim (tugas di luar fase di `PROMPTS.md`).

## 6. Referensi

Cooper, M. D. (2000). Towards a model of safety culture. *Safety Science, 36*(2), 111-136. https://doi.org/10.1016/S0925-7535(00)00035-7

Guldenmund, F. W. (2000). The nature of safety culture: A review of theory and research. *Safety Science, 34*(1-3), 215-257. https://doi.org/10.1016/S0925-7535(00)00014-X

Krueger, R. A., & Casey, M. A. (2015). *Focus groups: A practical guide for applied research* (5th ed.). SAGE Publications.

Patton, M. Q. (1999). Enhancing the quality and credibility of qualitative analysis. *Health Services Research, 34*(5 Pt 2), 1189-1208.

Peraturan Menteri Ketenagakerjaan Republik Indonesia Nomor 5 Tahun 2018 tentang Keselamatan dan Kesehatan Kerja Lingkungan Kerja. (2018).

Peraturan Menteri Ketenagakerjaan Republik Indonesia Nomor 9 Tahun 2016 tentang Keselamatan dan Kesehatan Kerja dalam Pekerjaan pada Ketinggian. (2016).

Peraturan Menteri Pekerjaan Umum dan Perumahan Rakyat Republik Indonesia Nomor 10 Tahun 2021 tentang Pedoman Sistem Manajemen Keselamatan Konstruksi. (2021).

Peraturan Menteri Tenaga Kerja dan Transmigrasi Republik Indonesia Nomor PER.08/MEN/VII/2010 tentang Alat Pelindung Diri. (2010).

Peraturan Pemerintah Republik Indonesia Nomor 50 Tahun 2012 tentang Penerapan Sistem Manajemen Keselamatan dan Kesehatan Kerja. (2012).
