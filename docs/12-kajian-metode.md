# 12. Kajian Metode: Tahapan Penilaian Budaya K3 terhadap Standar dan Teori

Penyusun: Nusa Safety. Tanggal: 19 November 2026. Status: berlaku untuk NSCAS versi 2 (rombak Laravel).

## 1. Tujuan dan lingkup

Dokumen ini menjawab satu pertanyaan: apakah tahapan penilaian budaya keselamatan dan kesehatan kerja (K3) di NSCAS sudah sesuai dengan standar dan teori yang diakui. Kajian dilakukan atas rancangan versi 1 (docs/01 bagian 3 dan docs/03), lalu hasilnya dipakai untuk menetapkan model tahapan versi 2 yang menjadi dasar menu beranda dan mesin status aplikasi.

Kajian ini tidak mengubah instrumen (seed/instrumen-karakteristik-v1.json) dan tidak mengubah rumus penilaian (docs/03). Keduanya tetap, dan mesin penilaian tetap wajib lolos seluruh fixture.

Batasan yang perlu dibaca lebih dulu:

1. NSCAS adalah pengukuran dan diagnosis internal. NSCAS memakai Safety Culture Ladder sebagai kerangka rujukan, bukan skema sertifikasi, dan tidak menyalin kriteria skemanya.
2. Tidak ada satu standar tunggal yang mengatur cara mengukur budaya K3. Karena itu kajian ini membedakan dengan tegas tiga hal: ketentuan regulasi, teori dan praktik baik yang diakui, dan kebijakan penilaian Nusa Safety.

## 2. Dasar yang dipakai

### 2.1 Regulasi dan standar nasional

| Sumber | Isi yang relevan | Pemakaian dalam NSCAS |
|---|---|---|
| Undang-Undang Nomor 1 Tahun 1970 tentang Keselamatan Kerja | Kewajiban dasar keselamatan kerja di tempat kerja | Landasan umum objek pengukuran |
| Peraturan Pemerintah Nomor 50 Tahun 2012 tentang Penerapan SMK3 | Lima prinsip penerapan: penetapan kebijakan, perencanaan, pelaksanaan rencana, pemantauan dan evaluasi kinerja, peninjauan dan peningkatan kinerja | Padanan siklus enam tahap (bagian 4.2) |
| Peraturan Menteri PUPR Nomor 10 Tahun 2021 tentang Pedoman SMKK | Sistem manajemen keselamatan konstruksi, dengan elemen kepemimpinan dan partisipasi tenaga kerja | Konteks klien jasa konstruksi; strata pekerja dan penyedia jasa |
| SNI ISO 45001:2018 | Klausul 5.1 (pimpinan membangun budaya yang mendukung sistem manajemen K3), 5.4 (konsultasi dan partisipasi pekerja), 9.1 (pemantauan, pengukuran, analisis, evaluasi), 9.3 (tinjauan manajemen), 10.3 (perbaikan berkelanjutan) | Dasar bahwa budaya perlu diukur, pekerja perlu dilibatkan, dan hasil perlu ditindaklanjuti |
| Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi | Persetujuan, tujuan pemrosesan, dan pelindungan data | Persetujuan responden, anonimitas, retensi (docs/04) |

### 2.2 Teori dan pedoman internasional

| Sumber | Gagasan pokok | Pemakaian dalam NSCAS |
|---|---|---|
| Schein (2010) | Budaya berlapis: artefak, nilai yang dianut, asumsi dasar | Survei saja tidak menjangkau lapisan terdalam |
| Guldenmund (2000) | Iklim keselamatan adalah wujud budaya yang terukur lewat sikap; budaya memerlukan metode kualitatif | Alasan adanya tahap validasi |
| Zohar (1980); Flin dkk. (2000) | Iklim keselamatan sebagai persepsi bersama; tema yang berulang antarinstrumen | Lapisan persepsi dan kesepakatan dalam kelompok |
| Cooper (2000) | Tiga sisi budaya yang saling memengaruhi: psikologis, perilaku, situasional | Tiga lapisan data NSCAS (bagian 3.2) |
| Hudson (2007); Parker dkk. (2006) | Lima tingkat kematangan, dari patologis sampai generatif | Skala 1 sampai 5 |
| NEN (2023a), Safety Culture Ladder 2.0 | Lima tingkat; penetapan oleh penilai independen melalui wawancara dan observasi | Kerangka rujukan tingkat; bukti lapangan wajib |
| IAEA (2016), Safety Reports Series No. 83 | Urutan asesmen mandiri: persiapan, pengumpulan data dengan banyak metode, analisis deskriptif lalu normatif, pelaporan dan komunikasi, tindak lanjut | Urutan enam tahap (bagian 4) |
| Creswell dan Plano Clark (2018) | Rancangan campuran berurutan: data kuantitatif dijelaskan dengan data kualitatif | Validasi dilakukan setelah survei |
| Denzin (1978) | Triangulasi metode, sumber, dan peneliti | Tiga lapisan, banyak strata, dua asesor dan panel |
| Cochran (1977); Sugiyono (2019) | Ukuran sampel dan penarikan sampel berstrata | Kalkulator sampel (docs/03 bagian 7) |
| James dkk. (1984); LeBreton dan Senter (2008) | Kesepakatan dalam kelompok (rwg) dan tafsirnya | Statistik mutu data (docs/03 bagian 8) |
| Podsakoff dkk. (2003) | Bias metode tunggal dan bias kepatutan sosial pada data laporan diri | Aturan selisih persepsi dan bukti |

Catatan rujukan nasional. Penelitian di Indonesia yang menerapkan model kematangan Hudson pada proyek konstruksi tersedia. Data bibliografinya belum dapat diverifikasi dari lingkungan kerja penyusunan dokumen ini, sehingga belum dikutip. Rujukan tersebut perlu ditambahkan setelah diverifikasi langsung ke jurnalnya.

## 3. Kerangka konseptual

### 3.1 Budaya tidak sama dengan iklim

Survei persepsi mengukur iklim keselamatan, yaitu potret sikap dan persepsi pada satu waktu (Zohar, 1980). Budaya lebih dalam dari itu. Menurut Schein (2010), asumsi dasar yang menggerakkan perilaku tidak dapat ditangkap kuesioner, dan Guldenmund (2000) menyimpulkan hal yang sama untuk budaya keselamatan. Konsekuensinya, pengukuran yang hanya bertumpu pada survei akan mengukur iklim lalu menamainya budaya. NSCAS menghindari hal ini dengan mewajibkan bukti dan validasi lapangan.

### 3.2 Tiga sisi budaya dan tiga lapisan data

| Sisi budaya (Cooper, 2000) | Pertanyaan | Lapisan data NSCAS | Sumber |
|---|---|---|---|
| Psikologis | Apa yang dirasakan dan diyakini orang | Persepsi `P` | Survei pekerja semua strata dan penilaian mandiri manajemen |
| Situasional | Apa yang dimiliki organisasi | Bukti objektif `E` | Dokumen sistem manajemen yang dinilai asesor |
| Perilaku | Apa yang dilakukan orang | Bukti objektif `E` dan validasi `V` | Observasi lapangan, wawancara, diskusi kelompok terarah |

Pemetaan ini menunjukkan bahwa rancangan tiga lapisan pada docs/03 sejalan dengan model Cooper. Satu catatan: sisi perilaku terbagi ke dua lapisan. Observasi masuk ke bukti, sedangkan wawancara dan diskusi kelompok masuk ke validasi. Pembagian ini dapat diterima selama asesor mencatat sumber setiap nilai.

### 3.3 Lima tingkat kematangan

Hudson (2007) dan Parker dkk. (2006) menguraikan lima tingkat: patologis, reaktif, kalkulatif, proaktif, dan generatif. Safety Culture Ladder memakai lima tingkat dengan nama tingkat kelima yang berbeda. NSCAS memakai nama Patologis, Reaktif, Kalkulatif, Proaktif, dan Progresif agar selaras dengan kerangka rujukannya. Skala kematangan bersifat ordinal: jarak antartingkat tidak dijamin sama. Indeks dua desimal pada NSCAS berguna untuk melihat arah dan kesenjangan, tetapi tingkat tetap ditetapkan dengan aturan ambang dan kemantapan (docs/03 bagian 4), bukan dengan pembulatan indeks semata.

### 3.4 Triangulasi

Denzin (1978) membedakan triangulasi metode, sumber, dan peneliti. NSCAS memenuhi ketiganya:

1. Metode: survei, penilaian mandiri, telaah dokumen, observasi, wawancara, dan diskusi kelompok terarah.
2. Sumber: semua strata, dari pimpinan sampai pekerja penyedia jasa, pada beberapa unit dan lokasi.
3. Peneliti: setiap karakteristik dinilai dua asesor, lalu ditetapkan rapat panel.

## 4. Model enam tahap NSCAS versi 2

### 4.1 Tahap, status, dan dasarnya

| Tahap | Status aplikasi | Kegiatan utama | Keluaran | Dasar |
|---|---|---|---|---|
| 1. Perencanaan | `DRAFT`, `CONFIGURED` | Lingkup, unit, strata, parameter, rencana sampel, tim asesor, komitmen pimpinan, komunikasi awal, kalibrasi asesor | Parameter terkunci dan rencana sampel | IAEA (2016): kesiapan organisasi dan tim; Cochran (1977) |
| 2. Pengumpulan data | `LOCKED`, `DATA_COLLECTION` | Survei persepsi, penilaian mandiri, bukti dokumen, observasi lapangan | Data tiga lapisan | Cooper (2000); ISO 45001 klausul 5.4 |
| 3. Validasi dan triangulasi | `VALIDATION` | Tinjauan mutu data, temuan awal, wawancara dan diskusi kelompok terarah yang diarahkan oleh temuan | Temuan deskriptif yang sudah diuji | Creswell dan Plano Clark (2018); Guldenmund (2000); Denzin (1978) |
| 4. Penilaian dan penetapan | `SCORING`, `PANEL_REVIEW` | Penilaian dua asesor, perhitungan mesin, rapat panel | Indeks, tingkat, dan kemantapannya | IAEA (2016): analisis normatif; NEN (2023a) |
| 5. Pelaporan dan rencana aksi | `ACTION_PLANNING`, `REPORTED` | Dasbor, daftar kesenjangan, rencana aksi, laporan, komunikasi hasil kepada pekerja | Laporan bertanda tangan dan rencana aksi | ISO 45001 klausul 9.3 dan 10.3; IAEA (2016) |
| 6. Pemantauan dan perbaikan | `MONITORING` | Pemantauan rencana aksi, perbandingan antarperiode, pengukuran ulang | Bukti perbaikan berkelanjutan | PP 50/2012; ISO 45001 klausul 10.3 |

Setelah tahap 6, asesmen ditutup (`ARCHIVED`), dan data mentah dimusnahkan setelah masa simpan berakhir (`PURGED`). Keduanya adalah tata kelola data, bukan tahap penilaian.

### 4.2 Padanan dengan siklus yang dikenal

| Tahap NSCAS | Urutan IAEA (2016) | Prinsip SMK3 (PP 50/2012) | Siklus ISO 45001 |
|---|---|---|---|
| 1. Perencanaan | Persiapan organisasi, tim, dan rencana | Penetapan kebijakan, perencanaan | Rencanakan |
| 2. Pengumpulan data | Pelaksanaan pengumpulan data | Pelaksanaan rencana | Lakukan |
| 3. Validasi dan triangulasi | Analisis deskriptif | Pemantauan dan evaluasi kinerja | Periksa |
| 4. Penilaian dan penetapan | Analisis normatif | Pemantauan dan evaluasi kinerja | Periksa |
| 5. Pelaporan dan rencana aksi | Pelaporan, komunikasi, penyusunan tindakan | Peninjauan kinerja | Tindak lanjuti |
| 6. Pemantauan dan perbaikan | Tindak lanjut | Peningkatan kinerja | Tindak lanjuti, lalu kembali merencanakan |

## 5. Temuan kajian dan penyesuaian

| No. | Temuan pada rancangan versi 1 | Dasar | Penyesuaian | Pelaksanaan |
|---|---|---|---|---|
| T1 | Ketiga lapisan data dikumpulkan bersamaan dalam satu status. Wawancara dan diskusi kelompok tidak dapat diarahkan oleh hasil survei. | Rancangan campuran berurutan (Creswell dan Plano Clark, 2018); budaya perlu digali secara kualitatif (Guldenmund, 2000) | Tahap 3 berdiri sendiri dengan status baru `VALIDATION`, setelah survei ditutup dan sebelum penilaian | Sudah, fase R0 (`app/Domain/Workflow`) |
| T2 | Kesiapan organisasi dan kalibrasi asesor tidak menjadi syarat. | IAEA (2016): komitmen pimpinan, komunikasi sebelum pengukuran, dan penyamaan pemahaman tim | Dua syarat baru sebelum parameter dikunci: komunikasi awal tercatat dan asesor sudah dikalibrasi | Syarat sudah ada di alur kerja (R0); halaman dan pemeriksaannya fase R1 |
| T3 | Mutu data tidak menjadi gerbang. Survei dengan partisipasi rendah dapat langsung dinilai. | Cochran (1977); LeBreton dan Senter (2008) | Sebelum validasi: partisipasi tiap strata memenuhi batas minimal atau diberi alasan tertulis, dan statistik mutu data ditinjau | Syarat sudah ada (R0); halaman mutu data fase R6 |
| T4 | Gambaran data dan penetapan tingkat tidak dipisah. | IAEA (2016): analisis deskriptif mendahului analisis normatif | Halaman Temuan awal di tahap 3 menyajikan data tanpa tingkat; tingkat baru muncul di tahap 4 | Menu sudah ada (R0); halaman fase R6 |
| T5 | Hasil tidak dikembalikan kepada pekerja yang menjadi sumber data. | ISO 45001 klausul 5.4; IAEA (2016): komunikasi hasil | Halaman Komunikasi hasil dan syarat baru sebelum pemantauan dimulai | Syarat sudah ada (R0); halaman fase R10 |
| T6 | Pemantauan hanya berupa status, belum menjadi tahap yang terlihat. | PP 50/2012; ISO 45001 klausul 10.3 | Tahap 6 memuat pemantauan rencana aksi dan perbandingan antarperiode | Menu sudah ada (R0); halaman fase R8 dan R9 |
| T7 | Bobot lapisan (0,35; 0,40; 0,25) dan ambang tertulis sebagai nilai bawaan tanpa keterangan dasarnya. | Tidak ada standar yang menetapkan bobot antarmetode | Dinyatakan sebagai kebijakan penilaian Nusa Safety, dikunci per asesmen, dan dicantumkan di laporan | Dokumen ini; laporan fase R10 |
| T8 | Rumus Slovin dipakai berdampingan dengan Cochran. | Tejada dan Punzalan (2012) | Dipertahankan karena lazim di Indonesia dan hasilnya lebih hati-hati; dasar statistiknya dijelaskan di bagian 6 | Dokumen ini |
| T9 | Validitas dan reliabilitas instrumen belum diuji dengan data. | Nunnally dan Bernstein (1994); Sugiyono (2019) | Rencana uji instrumen pada bagian 7 | Setelah data asesmen pertama |
| T10 | Kerangka isi dan aturan penetapan tingkat masih mengikuti SCL edisi 2016 (enam aspek, bobot poin, rata-rata tertimbang). | NEN (2023a, 2023b): lima tema, dua puluh subtema, prasyarat dan perilaku dinilai terpisah, tanpa poin, penilaian warna per tema | Instrumen versi 2 dan aturan penetapan nonkompensatoris, rinci di `docs/13` | Menunggu keputusan D1 sampai D6 di `docs/13` bagian 7 |

## 6. Kajian atas aturan penilaian

Tabel berikut memilah aturan pada docs/03 menurut kekuatan dasarnya. Tujuannya agar laporan kepada klien jujur tentang mana yang berasal dari teori dan mana yang merupakan kebijakan penilaian.

| Aturan (docs/03) | Golongan | Dasar dan catatan |
|---|---|---|
| Rata-rata survei ditimbang populasi strata | Teori | Penduga rata-rata pada penarikan sampel berstrata (Cochran, 1977). Mencegah strata dengan partisipasi tinggi mendominasi. |
| Ukuran sampel Cochran dengan koreksi populasi terbatas | Teori | Tingkat kepercayaan 95 persen, galat 5 persen, proporsi 0,5 (Cochran, 1977). |
| Rumus Slovin | Kelaziman | Setara dengan Cochran pada proporsi 0,5 dan nilai z sama dengan 2, sehingga hasilnya selalu sedikit lebih besar. Tejada dan Punzalan (2012) mengingatkan bahwa rumus ini sering dipakai tanpa memahami asumsinya. NSCAS mengambil nilai terbesar dari keduanya, sehingga aman. |
| Sasaran minimal 30 persen per strata | Kebijakan | Menjaga keterwakilan strata kecil. Bukan ketentuan standar. |
| Jumlah wawancara dan lokasi berbasis akar kuadrat | Kebijakan | Mengikuti kelaziman penarikan sampel audit. Dinyatakan sebagai jumlah minimal, bukan jumlah ideal. |
| Kesepakatan dalam kelompok (rwg) | Teori | James dkk. (1984). Tafsir ambang mengikuti LeBreton dan Senter (2008). |
| Sel di bawah 5 responden disembunyikan | Kebijakan berbasis etika | Menjaga anonimitas; sejalan dengan UU 27/2022. |
| Tiga lapisan dengan bobot 0,35; 0,40; 0,25 | Kebijakan | Kerangkanya berdasar Cooper (2000). Besaran bobot adalah pertimbangan profesional: bukti objektif diberi bobot terbesar karena paling sedikit terpengaruh bias laporan diri. |
| Bila selisih persepsi dan bukti mencapai 1,00, nilai tidak boleh melebihi bukti | Kebijakan berbasis teori | Prinsip kehati-hatian terhadap bias kepatutan sosial pada data laporan diri (Podsakoff dkk., 2003). |
| Penilaian mandiri manajemen berbobot 0,30 di dalam persepsi | Kebijakan | Suara manajemen dibatasi agar tidak menutupi suara pekerja. |
| Dua asesor per karakteristik dan tanda rekonsiliasi | Teori | Triangulasi peneliti (Denzin, 1978). |
| Penyesuaian panel wajib beralasan tertulis | Praktik baik | Keputusan bersama tim asesmen (IAEA, 2016); keterlacakan lewat jejak audit. |
| Tingkat dinyatakan mantap bila aspek dan karakteristik terendah tidak tertinggal jauh | Kebijakan berbasis teori | Tingkat kematangan mensyaratkan konsistensi antaraspek (Hudson, 2007). Besaran 0,50 dan 1,00 adalah pertimbangan profesional. |
| Bobot aspek dan jalur setara Safety Culture Ladder | Kerangka rujukan | Memakai struktur pada seed/aspek-dan-parameter.json. Hasilnya indikatif dan bukan penetapan sertifikasi. |

Rekomendasi untuk aturan bergolongan kebijakan:

1. Cantumkan di laporan sebagai parameter penilaian, lengkap dengan nilainya (sudah menjadi isi lampiran laporan).
2. Lakukan analisis kepekaan pada setiap asesmen: hitung ulang indeks organisasi dengan bobot lapisan digeser 0,05 ke setiap arah, lalu laporkan bila tingkat berubah. Dijadwalkan pada fase R8.
3. Tinjau besaran bobot dan ambang setelah tiga asesmen selesai, dengan data nyata.

## 7. Keterbatasan dan rencana uji instrumen

| Aspek | Keadaan saat ini | Rencana |
|---|---|---|
| Validitas isi | Pernyataan instrumen disusun Nusa Safety berdasarkan kerangka rujukan | Telaah oleh paling sedikit tiga ahli K3 di luar tim penyusun, dengan catatan tertulis |
| Keterbacaan | Belum diuji pada pekerja lapangan | Uji coba pada 20 sampai 30 pekerja dari strata operasional sebelum asesmen pertama |
| Reliabilitas | Belum ada data | Koefisien alfa Cronbach per aspek setelah asesmen pertama, dengan acuan 0,70 (Nunnally dan Bernstein, 1994) |
| Validitas konstruk | Belum ada data | Analisis faktor konfirmatori setelah jumlah responden memadai |
| Bias jawaban | Dikendalikan dengan anonimitas, pilihan Tidak tahu, dan aturan selisih persepsi dan bukti | Pantau pola jawaban seragam dan waktu pengisian (docs/03 bagian 8) |
| Daya banding | Hasil hanya sah untuk organisasi dan periode yang diukur | Jangan membandingkan antarorganisasi tanpa lingkup dan parameter yang sama |

Pengukuran ulang disarankan setiap 12 sampai 24 bulan, atau setelah perubahan organisasi yang besar. Angka ini adalah saran praktis agar rencana aksi sempat berjalan, bukan ketentuan standar.

## 8. Dampak pada aplikasi

| Perubahan | Letak | Fase |
|---|---|---|
| Enam tahap dan dua belas status, termasuk `VALIDATION` | `app/Domain/Workflow` | R0, selesai |
| Syarat transisi baru: komunikasi awal, kalibrasi asesor, tinjauan partisipasi, tinjauan mutu data, rencana validasi, komunikasi hasil | `App\Domain\Workflow\Workflow::transitions()` | R0 untuk daftar syarat; pemeriksaan otomatis mengikuti modulnya |
| Menu beranda menurut tahap dan menurut jenis akun | `App\Domain\Navigation`, halaman `home` | R0, selesai |
| Halaman baru: Komunikasi awal, Mutu data, Temuan awal, Komunikasi hasil, Perbandingan antarperiode | Katalog modul | R1, R6, R8, R10 |
| Analisis kepekaan bobot | Dasbor | R8 |

docs/01 bagian 3 perlu dibaca bersama dokumen ini: urutan status pada dokumen itu berlaku dengan tambahan `VALIDATION` di antara `DATA_COLLECTION` dan `SCORING`, dan syarat transisi mengikuti `Workflow::transitions()`.

## Rujukan

Badan Standardisasi Nasional. (2019). *SNI ISO 45001:2018 Sistem manajemen keselamatan dan kesehatan kerja: Persyaratan dan pedoman penggunaan*. Badan Standardisasi Nasional.

Cochran, W. G. (1977). *Sampling techniques* (3rd ed.). John Wiley & Sons.

Cooper, M. D. (2000). Towards a model of safety culture. *Safety Science, 36*(2), 111-136. https://doi.org/10.1016/S0925-7535(00)00035-7

Creswell, J. W., & Plano Clark, V. L. (2018). *Designing and conducting mixed methods research* (3rd ed.). SAGE Publications.

Denzin, N. K. (1978). *The research act: A theoretical introduction to sociological methods* (2nd ed.). McGraw-Hill.

Flin, R., Mearns, K., O'Connor, P., & Bryden, R. (2000). Measuring safety climate: Identifying the common features. *Safety Science, 34*(1-3), 177-192. https://doi.org/10.1016/S0925-7535(00)00012-6

Guldenmund, F. W. (2000). The nature of safety culture: A review of theory and research. *Safety Science, 34*(1-3), 215-257. https://doi.org/10.1016/S0925-7535(00)00014-X

Hudson, P. (2007). Implementing a safety culture in a major multi-national. *Safety Science, 45*(6), 697-722. https://doi.org/10.1016/j.ssci.2007.04.005

International Atomic Energy Agency. (2016). *Performing safety culture self-assessments* (Safety Reports Series No. 83). International Atomic Energy Agency.

James, L. R., Demaree, R. G., & Wolf, G. (1984). Estimating within-group interrater reliability with and without response bias. *Journal of Applied Psychology, 69*(1), 85-98. https://doi.org/10.1037/0021-9010.69.1.85

Kementerian Pekerjaan Umum dan Perumahan Rakyat Republik Indonesia. (2021). *Peraturan Menteri Pekerjaan Umum dan Perumahan Rakyat Nomor 10 Tahun 2021 tentang Pedoman Sistem Manajemen Keselamatan Konstruksi*.

LeBreton, J. M., & Senter, J. L. (2008). Answers to 20 questions about interrater reliability and interrater agreement. *Organizational Research Methods, 11*(4), 815-852. https://doi.org/10.1177/1094428106296642

NEN. (2023a). *Safety Culture Ladder 2.0:2023* (edisi bahasa Inggris). Stichting Koninklijk Nederlands Normalisatie Instituut.

NEN. (2023b). *Certification scheme SCL 2.0* (edisi bahasa Inggris). Stichting Koninklijk Nederlands Normalisatie Instituut.

Nunnally, J. C., & Bernstein, I. H. (1994). *Psychometric theory* (3rd ed.). McGraw-Hill.

Parker, D., Lawrie, M., & Hudson, P. (2006). A framework for understanding the development of organisational safety culture. *Safety Science, 44*(6), 551-562. https://doi.org/10.1016/j.ssci.2005.10.004

Podsakoff, P. M., MacKenzie, S. B., Lee, J.-Y., & Podsakoff, N. P. (2003). Common method biases in behavioral research: A critical review of the literature and recommended remedies. *Journal of Applied Psychology, 88*(5), 879-903. https://doi.org/10.1037/0021-9010.88.5.879

Republik Indonesia. (1970). *Undang-Undang Nomor 1 Tahun 1970 tentang Keselamatan Kerja*.

Republik Indonesia. (2012). *Peraturan Pemerintah Nomor 50 Tahun 2012 tentang Penerapan Sistem Manajemen Keselamatan dan Kesehatan Kerja*.

Republik Indonesia. (2022). *Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi*.

Schein, E. H. (2010). *Organizational culture and leadership* (4th ed.). Jossey-Bass.

Sugiyono. (2019). *Metode penelitian kuantitatif, kualitatif, dan R&D* (Edisi ke-2). Alfabeta.

Tejada, J. J., & Punzalan, J. R. B. (2012). On the misuse of Slovin's formula. *The Philippine Statistician, 61*(1), 129-136.

Zohar, D. (1980). Safety climate in industrial organizations: Theoretical and applied implications. *Journal of Applied Psychology, 65*(1), 96-102. https://doi.org/10.1037/0021-9010.65.1.96
