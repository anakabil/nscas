# 13. Verifikasi Metode Pengukuran NSCAS terhadap Safety Culture Ladder 2.0:2023

Kajian ini disusun atas permintaan pemilik proyek (19 November 2026) untuk memastikan metode pengukuran NSCAS sesuai dengan acuan Safety Culture Ladder (SCL) edisi 2.0 yang diterbitkan NEN pada September 2023. Kajian ini melengkapi `docs/12` (tahapan penilaian) dan `docs/03` (aturan penilaian), dan menjadi dasar keputusan metode sebelum fase R1 dan R7 dibangun.

## 1. Tujuan, sumber, dan batasan

### 1.1 Tujuan

1. Membandingkan struktur instrumen, sumber data, aturan penentuan tingkat, dan cakupan pekerja NSCAS dengan ketentuan SCL 2.0.
2. Menyatakan bagian yang sudah sesuai, sesuai sebagian, dan belum sesuai, beserta dasar dan dampaknya.
3. Mengusulkan penyesuaian yang dapat dikerjakan tanpa melanggar aturan mesin penilaian (CLAUDE.md aturan 1) dan aturan hak cipta NEN (aturan 8).

### 1.2 Sumber yang ditelaah

| Sumber | Isi yang dipakai |
|---|---|
| NEN (2023a), *Safety Culture Ladder 2.0:2023*, dokumen norma berbahasa Inggris, 64 halaman, diserahkan pemilik proyek | Lima tangga, lima tema, dua puluh subtema, pembedaan prasyarat dan perilaku, definisi istilah, Lampiran A (tabel rujukan SCL 1.0 ke SCL 2.0) |
| NEN (2023b), *Certification scheme SCL 2.0*, dokumen publik di situs Safety Culture Ladder | Metode asesmen, jumlah wawancara dan kunjungan proyek, penilaian hijau, jingga, dan merah, aturan penetapan tangga |
| `seed/aspek-dan-parameter.json`, `seed/instrumen-karakteristik-v1.json`, `docs/03`, `docs/12` | Metode NSCAS yang berlaku saat ini |

Dokumen norma sendiri menyebut tiga dokumen pendamping: skema sertifikasi, dokumen penjelasan, dan *casebook* untuk lembaga sertifikasi. Aturan penentuan tangga tidak ada di dokumen norma, melainkan di skema sertifikasi. Karena itu skema sertifikasi ikut ditelaah. *Casebook* hanya dibagikan kepada lembaga sertifikasi dan tidak dipakai.

### 1.3 Cara verifikasi

1. Membaca seluruh dokumen norma, termasuk kedua puluh tabel subtema, untuk mencatat struktur (kode, jumlah baris prasyarat dan perilaku, jumlah butir per tangga), tanpa menyalin isi kriteria.
2. Mengekstrak Lampiran A secara otomatis pada tingkat kode. Untuk setiap karakteristik SCL 1.0 dihitung berapa kali sel kriteria SCL 2.0 dirujuk per subtema. Angka ini dipakai sebagai petunjuk sebaran isi, bukan bobot.
3. Membaca bagian 7.3, 7.4, dan 7.8 skema sertifikasi tentang pelaksanaan asesmen dan penetapan tangga.
4. Membandingkan temuan di atas dengan rumus dan parameter NSCAS butir demi butir.

### 1.4 Batasan

1. Kajian ini tidak menyalin teks kriteria SCL ke dalam dokumen, kode, atau data. Yang dicantumkan hanya kode, nama tema dan subtema sebagai judul, ringkasan topik dengan kata-kata sendiri, dan aturan prosedural yang diparafrasekan dengan menyebut sumbernya.
2. Hasil NSCAS tetap pengukuran dan diagnosis internal. Penyelarasan metode tidak menjadikan hasil NSCAS setara dengan sertifikat atau pernyataan lembaga sertifikasi yang diakui NEN.
3. Pemetaan dalam Lampiran A dinyatakan NEN hanya bersifat indikatif. Pemetaan di bagian 5 kajian ini mewarisi sifat tersebut.

## 2. Ringkasan temuan

1. Model lima tangga NSCAS (Patologis, Reaktif, Kalkulatif, Proaktif, Progresif) sesuai dengan SCL 2.0, yang juga bertumpu pada Parker dkk. (2006).
2. Kerangka isi NSCAS (enam aspek dan karakteristik turunannya) masih mengikuti SCL edisi pertama (versi 4.0, 2016). SCL 2.0 memakai lima tema dan dua puluh subtema. Lampiran A menunjukkan seluruh karakteristik lama tertampung di SCL 2.0, tetapi enam subtema baru tersentuh sangat tipis: kepemimpinan (1.2), persiapan dan perencanaan pekerjaan (3.1), penilaian risiko (3.2), pengadaan dan pengelolaan sumber daya (3.4), pengelolaan perubahan (3.5), serta dorongan dan sanksi bagi kontraktor (4.2).
3. SCL 2.0 menilai setiap tema dua kali, yaitu prasyarat dan perilaku, dan memberi perilaku pengaruh lebih besar. NSCAS memisahkan data menurut sumbernya (persepsi, bukti, validasi), tetapi belum memisahkan prasyarat dan perilaku.
4. Aturan penentuan tingkat NSCAS bersifat kompensatoris: rata-rata tertimbang dengan bobot aspek dari poin maksimum SCL edisi pertama. SCL 2.0 sengaja meninggalkan poin agar kekuatan satu topik tidak menutupi kelemahan topik lain. Skema sertifikasi menetapkan tangga dengan penilaian warna per tema: untuk perilaku kelima tema harus hijau, untuk prasyarat paling sedikit empat tema hijau dan sisanya jingga. Ini kesenjangan metode yang paling penting.
5. Empat metode asesmen dalam skema sertifikasi (penilaian mandiri organisasi, analisis atas penilaian mandiri itu, wawancara, serta observasi dan kunjungan kerja) sudah punya padanan di NSCAS. Survei persepsi pekerja adalah tambahan NSCAS yang memperkuat gambaran perilaku umum, tetapi tidak menggantikan wawancara dan observasi.
6. Kalkulator sampel NSCAS sudah sama dengan rumus skema sertifikasi: wawancara manajemen dan staf paling sedikit 0,6 akar M, pekerja operasional 1,2 akar M, dan proyek yang dikunjungi 0,6 akar N dengan minimal satu proyek.
7. Cakupan pekerja dalam SCL 2.0 mencakup pekerja sendiri, pekerja alih daya, pekerja lepas, dan subkontraktor. Daftar responden NSCAS (fase R2) wajib mengikuti cakupan ini.
8. Definisi K3 dalam SCL 2.0 mencakup keselamatan psikososial, kesejahteraan, dan integritas. Di NSCAS topik ini (KT.2) masih diperlakukan sebagai karakteristik kontekstual di luar indeks.

## 3. Ketentuan SCL 2.0 yang relevan untuk pengukuran

### 3.1 Lima tangga

SCL 2.0 memakai model tangga budaya dari Parker dkk. (2006) dengan lima tangga: Patologis, Reaktif, Kalkulatif, Proaktif, dan Progresif (NEN, 2023a, bagian 4.1 dan 4.2). Semakin tinggi tangganya, semakin luas pihak yang terlibat: mula-mula direksi, kemudian manajemen, pengawas langsung, dan akhirnya pekerja yang mengambil prakarsa sendiri (NEN, 2023b, bagian 7.8.3). Gambaran ini sejalan dengan Hudson (2007) yang menjadi dasar teori NSCAS.

### 3.2 Lima tema dan dua puluh subtema

Nama di bawah adalah terjemahan Nusa Safety atas judul tema dan subtema. Kolom topik ditulis dengan kata-kata sendiri, bukan kutipan kriteria.

| Kode | Tema dan subtema | Topik |
|---|---|---|
| 1 | Kebijakan dan kepemimpinan | Cara kebijakan dan sasaran K3 disusun dan dijalankan |
| 1.1 | Kebijakan dan sasaran | Keberadaan, jangkauan, dan pemakaian kebijakan, sasaran, dan sumber daya K3 |
| 1.2 | Kepemimpinan | Investasi, kehadiran, dan keteladanan pimpinan dalam K3 |
| 1.3 | Komunikasi dan keterlibatan | Aliran informasi K3 antara pimpinan, pekerja, dan pihak luar |
| 1.4 | Perilaku K3 yang diharapkan | Penetapan perilaku yang diharapkan, umpan balik antarrekan, sanksi, dan penghargaan |
| 1.5 | Mengambil tanggung jawab | Siapa yang merasa memiliki urusan K3 dan bagaimana hal itu terlihat |
| 2 | Pengetahuan dan keterampilan | Kompetensi K3 dari direksi sampai pekerja pihak luar |
| 2.1 | Tugas, tanggung jawab, dan wewenang | Kejelasan dan pembagian peran K3 |
| 2.2 | Pengetahuan dan keterampilan | Identifikasi dan pemenuhan kompetensi yang dibutuhkan |
| 2.3 | Pengembangan pengetahuan dan keterampilan | Cara pengembangan kompetensi dibicarakan, disepakati, dan dipantau |
| 3 | Proses primer dan sekunder | Cara K3 dijamin di dalam proses inti dan proses pendukung |
| 3.1 | Persiapan dan perencanaan pekerjaan | K3 dalam penyiapan dan penjadwalan pekerjaan |
| 3.2 | Penilaian risiko | Identifikasi, penilaian, pemutakhiran, dan tindak lanjut bahaya |
| 3.3 | K3 dalam proyek atau pelaksanaan | Rencana dan perhatian K3 selama proyek atau operasi berjalan |
| 3.4 | Pengadaan, pengelolaan, dan penggunaan sumber daya | K3 dalam pembelian, pemeliharaan, pemeriksaan, dan pemakaian peralatan |
| 3.5 | Pengelolaan perubahan | Pengendalian risiko yang dibawa perubahan organisasi atau teknis |
| 4 | Kerja sama dengan pihak luar | Kerja sama dengan kontraktor dan pemangku kepentingan luar |
| 4.1 | Pemilihan dan penilaian kontraktor | Pemakaian kinerja K3 untuk memilih dan menilai kontraktor |
| 4.2 | Dorongan dan sanksi bagi kontraktor | Tanggapan atas ketidakpatuhan dan penghargaan atas kinerja baik kontraktor |
| 4.3 | Bekerja sama mencari solusi | Pemecahan masalah K3 bersama kontraktor dan pihak luar |
| 5 | Belajar dan memperbaiki | Perbaikan K3 yang berkelanjutan |
| 5.1 | Budaya belajar | Belajar dari kejadian dan praktik baik, di dalam dan di luar organisasi |
| 5.2 | Laporan | Pelaporan, pencatatan, dan analisis kecelakaan, hampir celaka, dan usulan |
| 5.3 | Penilaian K3 di lingkungan kerja | Inspeksi tempat kerja: pelaksana, fokus, dan pemanfaatan hasilnya |
| 5.4 | Audit internal | Ruang lingkup, peserta, dan manfaat audit K3 internal |

### 3.3 Prasyarat dan perilaku

Setiap subtema memuat dua baris uraian untuk tangga 1 sampai 5 (NEN, 2023a, bagian 4.4):

1. Prasyarat (P) menggambarkan apa yang telah diatur dan disiapkan organisasi: tata kelola K3, ketersediaan sumber daya, serta kejelasan tugas, tanggung jawab, dan wewenang. SCL menyatakan apa yang harus diatur, bukan bagaimana caranya. Prasyarat boleh menjadi bagian sistem manajemen, tetapi tidak wajib tertulis.
2. Perilaku (B) menggambarkan apa yang dilakukan dan tidak dilakukan orang di organisasi, yang terlihat dan terdengar dalam keseharian.

Dari dua puluh subtema terdapat 19 baris prasyarat dan 20 baris perilaku. Subtema 1.5 hanya memiliki baris perilaku. Pada beberapa subtema, uraian prasyarat untuk dua atau tiga tangga berturut-turut hampir sama (misalnya 3.1, 3.2, dan 3.5), sehingga pada subtema itu tangga terutama dibedakan oleh perilaku. Beberapa sel perilaku dirumuskan sebagai apa yang dapat diceritakan atau dicontohkan pekerja, yang menunjukkan bahwa buktinya digali melalui wawancara.

### 3.4 Tanpa poin dan tanpa kompensasi

Pengantar dokumen norma menjelaskan alasan revisi: pada edisi lama organisasi dapat memusatkan perhatian pada karakteristik tertentu agar jumlah poinnya cukup. Hal itu tidak lagi dimungkinkan karena SCL 2.0 tidak memakai poin (NEN, 2023a, hlm. 5). Skema sertifikasi menggantinya dengan penilaian warna per tema (NEN, 2023b, bagian 7.8.2).

### 3.5 Pelaksanaan asesmen menurut skema sertifikasi

| Ketentuan | Isi (diparafrasekan dari NEN, 2023b) |
|---|---|
| Tim | Dua auditor, salah satunya ketua tim; keduanya membentuk pendapat bersama |
| Empat metode | Penilaian mandiri organisasi; analisis lembaga sertifikasi atas penilaian mandiri; wawancara; observasi dan kunjungan kerja |
| Wawancara | Mencakup semua lapisan dengan fokus pada pekerja operasional; hasilnya dapat diuji silang dengan wawancara dan observasi lain |
| Jumlah wawancara | Direksi, manajemen, dan staf paling sedikit 0,6 akar M; pekerja operasional paling sedikit 1,2 akar M; M adalah jumlah orang yang bekerja, yaitu pekerja sendiri ditambah pekerja sewaan, rata-rata setahun |
| Kunjungan proyek | Paling sedikit 0,6 akar N proyek dari N proyek yang berjalan, minimal satu; penilaian dari meja saja tidak diterima |
| Wawancara kelompok | Boleh sebagai pelengkap wawancara perorangan, paling banyak sepuluh orang, dan perbedaan pendapat harus dapat disampaikan |
| Ruang lingkup | Semua orang yang bekerja di bawah tanggung jawab organisasi, termasuk subkontraktor dan proyeknya |
| Pertanggungjawaban | Ringkasan lisan setelah setiap wawancara, umpan balik setiap akhir hari, dan presentasi hasil sementara di akhir asesmen |
| Laporan | Nama narasumber dicantumkan, tetapi pernyataan tidak boleh dapat ditelusuri ke orang tertentu |

### 3.6 Penilaian warna dan penetapan tangga

1. Setiap tema dinilai terpisah untuk prasyarat dan perilaku. Karena yang dinilai adalah efektivitas upaya, perilaku diberi pengaruh lebih besar.
2. Hijau berarti uraian tema pada tangga yang dinilai sebagian besar terpenuhi. Kepatuhan penuh tidak disyaratkan karena perilaku tidak pernah seragam seratus persen; yang dinilai adalah pola yang paling umum.
3. Jingga berarti uraian sebagian terpenuhi dan organisasi sedang berupaya mencapainya. Merah berarti tidak memadai.
4. Tangga tidak kumulatif. Organisasi dinilai pada uraian tangga yang diajukan. Bila tidak terpenuhi, uraian tangga di bawahnya dipertimbangkan. Tema yang mencapai tangga lebih tinggi dicatat di laporan tetapi tidak menaikkan tangga organisasi.
5. Tangga dinyatakan tercapai bila: pada perilaku, kelima tema hijau; pada prasyarat, paling sedikit empat tema hijau dan tema sisanya jingga. Satu merah berarti tangga tidak tercapai.
6. Tangga 1 tidak diaudit tersendiri; tangga 1 hanya dapat menjadi hasil asesmen pada tangga yang lebih tinggi.

### 3.7 Definisi yang memengaruhi desain NSCAS

| Istilah (NEN, 2023a, bagian 3) | Dampak pada NSCAS |
|---|---|
| Pekerja: setiap orang yang bekerja di organisasi, termasuk pekerja mandiri, pekerja sementara, dan tenaga sewaan | Daftar responden dan kerangka sampel harus memuat pekerja subkontraktor dan pekerja harian |
| K3: mencakup keselamatan pihak ketiga dan lingkungan, stres kerja psikososial, keselamatan psikososial, kesejahteraan, dan integritas | Topik psikososial bagian dari inti, bukan sekadar konteks |
| Audit: analisis dan penilaian sistematis dan berkala atas kesadaran dan perilaku K3 | Sejalan dengan karakteristik audit dan tinjauan NSCAS |
| Inspeksi tempat kerja dan observasi perilaku | Sejalan dengan modul observasi lapangan NSCAS |

## 4. Matriks kesesuaian

Status: S sesuai, SS sesuai sebagian, BS belum sesuai.

| No | Unsur | SCL 2.0 | NSCAS saat ini | Status | Tindak lanjut |
|---|---|---|---|---|---|
| V1 | Model tangga | Lima tangga Parker dkk. | Lima tingkat dengan nama yang sama | S | Tidak ada |
| V2 | Kerangka isi | 5 tema, 20 subtema | 6 aspek, 16 karakteristik inti dan 2 kontekstual, turunan SCL 2016 | BS | Instrumen versi 2 (bagian 6.2) |
| V3 | Cakupan isi | Seluruh 20 subtema | Enam subtema tersentuh tipis (bagian 5.2) | SS | Butir tambahan untuk enam subtema |
| V4 | Prasyarat dan perilaku | Dinilai terpisah, perilaku lebih menentukan | Lapisan menurut sumber data, tanpa pemisahan P dan B | SS | Setiap butir diberi tanda P atau B |
| V5 | Poin dan bobot | Tanpa poin | Bobot aspek dari poin maksimum SCL 2016 (A1 26,67 persen sampai A6 4,44 persen) | BS | Bobot poin tidak dipakai untuk penetapan tingkat |
| V6 | Kompensasi | Nonkompensatoris per tema | Rata-rata tertimbang; kemantapan hanya sebagai tanda | BS | Aturan keputusan per tema (bagian 6.3) |
| V7 | Arah penetapan tangga | Dinilai pada tangga yang diajukan, turun bila tidak terpenuhi | Pembulatan ke bawah indeks; jalur ambang menaik berurutan | SS | Ikuti arah penetapan skema |
| V8 | Jalur ambang 0,75 sampai 0,85 di `docs/03` bagian 5 | Tidak ada di norma maupun skema 2.0 | Disebut "jalur setara Safety Culture Ladder" | BS | Ganti nama dan tandai sebagai kebijakan Nusa Safety, lalu diganti aturan bagian 6.3 |
| V9 | Metode pengumpulan data | Empat metode | Penilaian mandiri, penilaian bukti oleh asesor, validasi, observasi, ditambah survei pekerja | S | Pertahankan; survei tetap pelengkap |
| V10 | Tim penilai | Dua auditor, pendapat bersama | Tanda penilai tunggal dan rapat panel | S | Jadikan dua asesor sebagai syarat sebelum penetapan |
| V11 | Jumlah wawancara dan kunjungan proyek | 0,6 akar M; 1,2 akar M; 0,6 akar N, minimal satu | Rumus sama (`SampleCalculator`, fixture `sampel-3000.json`) | S | Tidak ada |
| V12 | Kunjungan lapangan | Wajib paling sedikit satu kunjungan proyek | Kalkulator menyebut proyek "dikunjungi virtual" | SS | Paling sedikit satu kunjungan fisik |
| V13 | Wawancara kelompok | Pelengkap, paling banyak 10 orang | Diskusi kelompok paling banyak 8 orang | S | Tidak ada |
| V14 | Cakupan pekerja | Termasuk subkontraktor dan pekerja sewaan | Belum ditetapkan di fase R2 | SS | Kriteria penerimaan R2 |
| V15 | Topik psikososial | Bagian definisi K3 | KT.2 kontekstual, di luar indeks | SS | Masuk inti pada instrumen versi 2 |
| V16 | Kerahasiaan narasumber | Nama dicatat, pernyataan tidak dapat ditelusuri | Validasi dinyatakan tidak anonim | SS | Catatan sesi tidak menautkan pernyataan ke nama |
| V17 | Umpan balik kepada organisasi | Ringkasan per wawancara, harian, dan akhir | Komunikasi hasil di tahap 5 | SS | Catatan umpan balik harian di fase R6 |
| V18 | Hak cipta | Isi kriteria dilindungi | Pernyataan instrumen karya Nusa Safety; hanya kode yang dirujuk | S | Pertahankan |

## 5. Peta silang NSCAS ke SCL 2.0

### 5.1 Karakteristik NSCAS ke subtema SCL 2.0

Kolom subtema diurutkan dari yang paling banyak dirujuk Lampiran A. Angka dalam kurung adalah jumlah sel kriteria SCL 2.0 yang dirujuk oleh karakteristik SCL 2016 padanannya.

| NSCAS | Padanan SCL 2016 | Subtema SCL 2.0 (jumlah rujukan) | Catatan |
|---|---|---|---|
| K1.1 Perhatian dan keteladanan manajemen | 1.1 | 1.3 (11), 4.3 (6), 5.1 (5), 1.1 (3), 3.1 (3), 3.3 (3) | |
| K1.2 Keterlibatan pekerja | 1.2 | 5.1 (6), 1.5 (3), 2.1 (2), 5.3 (2), 1.2 (1), 1.4 (1), 5.2 (1) | |
| K1.3 Penghargaan dan konsekuensi | 1.3 | 1.4 (10), 2.3 (1), 4.1 (1) | |
| K2.1 Penyebab kecelakaan dan pembelajaran organisasi | 2.4 | 1.1 (5), 1.4 (4), 4.3 (2), 5.3 (2) | |
| K2.2 Keselamatan dalam strategi, profitabilitas, dan keberlanjutan | 2.5 | 1.1 (3), 2.1 (3), 3.2 (3), 5.1 (2), 1.5 (1), 3.4 (1) | |
| K3.1 Pengelolaan penyedia jasa dan subkontraktor | 3.6 | 4.1 (13), 4.3 (2), 3.3 (1), 4.2 (1) | Satu butir lama tidak diadopsi |
| K3.2 Kompetensi dan pelatihan | 3.7 | 2.2 (8), 2.3 (5), 4.3 (2), 5.1 (2), 2.1 (1) | Satu butir lama tidak diadopsi |
| K3.3 Fungsi dan kedudukan unit K3 | 3.8 | 1.3 (2), 2.1 (1), 4.3 (1), 5.1 (1), 5.2 (1) | Tiga butir lama sengaja tidak diadopsi |
| K4.1 Perencanaan pekerjaan | 4.9 | 3.3 (13) | Lampiran A memetakan ke 3.3, bukan 3.1 |
| K4.2 Keselamatan tempat kerja | 4.10 | 3.3 (5), 5.3 (3), 4.1 (2), 4.3 (2), 4.2 (1) | |
| K4.3 Prosedur dan kepatuhan | 4.11 | 5.1 (4), 3.3 (3), 3.5 (2), 5.3 (2), 2.2 (1) | |
| K5.1 Pelaporan penyimpangan | 5.12 | 5.2 (7), 5.1 (5) | |
| K5.2 Investigasi dan tindak lanjut | 5.13 dan 5.14 | 5.2 (19), 5.1 (18) | Lima butir lama tidak diadopsi |
| K5.3 Pengendalian harian dan komunikasi | 5.15 dan 5.16 | 5.3 (12), 5.1 (3), 5.2 (3), 1.4 (3), 1.3 (2), 1.5 (1), 2.2 (1), 4.2 (1) | Sebagian besar butir rapat (5.16) tidak diadopsi |
| K6.1 Audit dan tinjauan | 6.17 | 5.4 (6) | Sebagian butir tidak diadopsi |
| K6.2 Tren dan statistik | 6.18 | 5.1 (5), 1.1 (2), 5.3 (2) | |
| KT.1 Integrasi SMKK | Tidak ada | Telaah Nusa Safety: 3.1, 3.2, 3.3 | Rencana keselamatan konstruksi menurut Permen PUPR 10/2021 |
| KT.2 Keselamatan psikososial dan keberanian menyuarakan pendapat | Tidak ada | Telaah Nusa Safety: definisi K3 bagian 3.17; 1.3, 1.4, 5.1 | Sejalan dengan ISO 45003 dan faktor psikologi dalam Permenaker 5/2018 |

NSCAS menggabungkan lima karakteristik lama aspek 5 menjadi tiga (K5.1 sampai K5.3) dan menambahkan dua karakteristik kontekstual. Jumlah karakteristik NSCAS tetap 18, tetapi susunannya tidak sama persis dengan SCL 2016.

### 5.2 Sebaran per subtema SCL 2.0

Jumlah seluruh rujukan 254. Kategori: kuat bila 10 rujukan atau lebih, sedang 4 sampai 9, tipis 3 atau kurang.

| Tema | Subtema dan jumlah rujukan | Porsi tema | Subtema tipis |
|---|---|---|---|
| 1 Kebijakan dan kepemimpinan | 1.1 (13), 1.2 (1), 1.3 (15), 1.4 (18), 1.5 (5) | 52 (20 persen) | 1.2 Kepemimpinan |
| 2 Pengetahuan dan keterampilan | 2.1 (7), 2.2 (10), 2.3 (6) | 23 (9 persen) | Tidak ada |
| 3 Proses primer dan sekunder | 3.1 (3), 3.2 (3), 3.3 (25), 3.4 (1), 3.5 (2) | 34 (13 persen) | 3.1, 3.2, 3.4, 3.5 |
| 4 Kerja sama dengan pihak luar | 4.1 (16), 4.2 (3), 4.3 (15) | 34 (13 persen) | 4.2 |
| 5 Belajar dan memperbaiki | 5.1 (51), 5.2 (31), 5.3 (23), 5.4 (6) | 111 (44 persen) | Tidak ada |

Makna temuan:

1. Isi turunan SCL 2016 berat ke tema 5 (pelaporan dan pembelajaran dari kejadian). Bila NSCAS menetapkan tingkat dari rata-rata, organisasi dengan sistem pelaporan yang baik dapat tampak matang walaupun penilaian risiko dan pengelolaan perubahannya lemah. Aturan per tema pada SCL 2.0 mencegah hal ini.
2. Enam subtema tipis adalah topik yang diperluas pada SCL 2.0. Penilaian risiko (3.2) dan pengelolaan perubahan (3.5) sangat menentukan di proyek konstruksi. Pemindaian kata kunci atas pernyataan NSCAS menunjukkan unsur risiko muncul di beberapa karakteristik (K1.1, K2.2, K4.1, K5.3), sehingga cakupan NSCAS kemungkinan lebih baik daripada SCL 2016. Kepastiannya memerlukan telaah butir demi butir pada fase R1.
3. Temuan ini sejalan dengan penelitian di Indonesia. Machfudiyanto dkk. (2026) menemukan kelemahan yang menetap pada kompetensi perencanaan tahap awal serta alokasi waktu dan sumber daya untuk K3, sedangkan pengendalian operasional relatif lebih kuat. Itulah wilayah subtema 3.1, 3.2, dan 3.4.

## 6. Usulan penyesuaian

### 6.1 Langkah segera, tanpa mengubah keluaran mesin penilaian

| No | Langkah | Letak | Status |
|---|---|---|---|
| U1 | Jalur ambang di `docs/03` bagian 5 tidak lagi disebut setara Safety Culture Ladder. Namanya menjadi jalur ambang pemenuhan, dinyatakan sebagai kebijakan Nusa Safety, dan ditandai akan digantikan aturan bagian 6.3 | `docs/03` | Dikerjakan bersama kajian ini |
| U2 | Kriteria penerimaan R2: daftar responden mencakup pekerja sendiri, alih daya, harian, dan subkontraktor; M dihitung dari rata-rata setahun | `PROMPTS.md` R2 | Dikerjakan bersama kajian ini |
| U3 | Kalkulator menampilkan paling sedikit satu kunjungan proyek secara fisik, di samping observasi daring | R1 (halaman kalkulator) | Menunggu fase R1 |
| U4 | Catatan sesi validasi mencantumkan peserta, tetapi pernyataan dan nilai tidak ditautkan ke nama | R6 | Menunggu fase R6 |
| U5 | Peta silang bagian 5 disimpan sebagai data (`seed/peta-scl-2.json`, kode saja) agar laporan dapat menampilkan sebaran per tema SCL 2.0 | R1 | Menunggu persetujuan (aturan 8 membatasi struktur seed) |

### 6.2 Instrumen versi 2

1. Struktur mengikuti lima tema dan dua puluh subtema. Pernyataan per tangga tetap ditulis Nusa Safety dengan kata-kata sendiri, berangkat dari maksud setiap subtema dan konteks konstruksi Indonesia (PP 50/2012, Permen PUPR 10/2021), bukan salinan uraian NEN.
2. Setiap butir diberi tanda P atau B. Sumber data utama:
   - P: bukti dokumen, wawancara manajemen, dan penilaian mandiri manajemen.
   - B: survei pekerja, observasi lapangan, wawancara pekerja operasional, dan diskusi kelompok terarah.
3. Butir tambahan untuk enam subtema tipis, dengan contoh konstruksi: kehadiran pimpinan di lapangan (1.2), analisis keselamatan pekerjaan sebelum mulai (3.1), identifikasi bahaya dan penilaian risiko yang dimutakhirkan (3.2), pemeriksaan alat berat dan perancah sebelum dipakai (3.4), izin kerja dan peninjauan risiko saat metode kerja berubah (3.5), serta teguran dan penghargaan bagi subkontraktor (4.2).
4. Keselamatan psikososial (KT.2) masuk ke inti, tersebar pada subtema 1.3, 1.4, dan 5.1. Integrasi SMKK (KT.1) tetap kontekstual karena khas regulasi Indonesia.
5. Uji validitas dan reliabilitas mengikuti rencana `docs/12` bagian 7, dengan tambahan uji kesepakatan antarasesor untuk penilaian warna (Cohen, 1960; LeBreton dan Senter, 2008).

### 6.3 Aturan penetapan tingkat nonkompensatoris (usulan)

Aturan ini menyalin logika prosedural skema sertifikasi, bukan kriteria isinya. Ambang angka untuk warna adalah kebijakan Nusa Safety yang harus dikalibrasi, karena skema menyerahkan penentuan warna pada pertimbangan dua auditor.

Langkah 1. Untuk setiap tema `t`, komponen `k` (P atau B), dan tangga `s`, hitung tingkat pemenuhan `f(t, k, s)` dari 0 sampai 1, yaitu rata-rata pemenuhan butir tangga `s` dari semua sumber data setelah aturan selisih persepsi dan bukti diterapkan.

Langkah 2. Usulan warna, lalu ditetapkan oleh dua asesor dalam rapat panel:

```
hijau   bila f >= 0,80
jingga  bila 0,50 <= f < 0,80
merah   bila f < 0,50
```

Langkah 3. Tangga `s` tercapai bila:

```
perilaku  : kelima tema hijau
prasyarat : paling sedikit empat tema hijau dan tidak ada tema merah
```

Subtema 1.5 hanya ikut pada perilaku.

Langkah 4. Penetapan dimulai dari sasaran tingkat asesmen. Bila tidak tercapai, periksa tangga di bawahnya sampai tangga 2. Bila tangga 2 pun tidak tercapai, hasilnya tangga 1.

Langkah 5. Profil per tema dilaporkan, termasuk tema yang mencapai tangga lebih tinggi, tanpa menaikkan tangga organisasi.

Langkah 6. Indeks kontinu `O` tetap dihitung untuk tren antarperiode dan perbandingan antarunit, dengan bobot tema sama, dan diberi label indeks kematangan. Indeks ini tidak dipakai untuk menetapkan tangga.

Contoh singkat. Sasaran tingkat 4. Perilaku: tema 1 sampai 4 hijau, tema 3 jingga. Prasyarat: empat hijau, satu jingga. Tangga 4 tidak tercapai karena satu tema perilaku belum hijau. Pada tangga 3 kelima tema perilaku hijau dan prasyarat lima hijau, sehingga hasilnya tangga 3, dan laporan mencatat bahwa tema 3 adalah penghambat menuju tangga 4. Dengan aturan lama, rata-rata tertimbang yang sama dapat menghasilkan tingkat 4 karena kekuatan tema 5 menutupi kelemahan tema 3.

Aturan nonkompensatoris semacam ini dikenal dalam penyusunan indikator komposit: agregasi rata-rata memungkinkan nilai tinggi menutupi nilai rendah, sedangkan agregasi nonkompensatoris menjaga agar kelemahan kritis tetap terlihat (Munda dan Nardo, 2009; OECD dan JRC, 2008).

### 6.4 Yang tetap dipertahankan

1. Tiga sumber data dan triangulasinya (`docs/12` bagian 3.4), karena sejalan dengan empat metode skema dan memperkuat bukti.
2. Aturan selisih persepsi dan bukti `F_c = min(G_c, E_c)`, karena sejalan dengan fungsi wawancara dalam skema, yaitu memverifikasi data faktual dan penilaian mandiri.
3. Kalkulator sampel, karena rumusnya sudah sama dengan skema.
4. Survei pekerja, karena memberi gambaran pola perilaku yang paling umum dari banyak orang, sesuai makna hijau dalam skema. Survei tidak menggantikan wawancara dan observasi.

## 7. Keputusan pemilik proyek

| No | Keputusan | Pilihan | Rekomendasi | Status |
|---|---|---|---|---|
| D1 | Kerangka instrumen | (a) tetap 6 aspek SCL 2016 dengan laporan tambahan per tema SCL 2.0; (b) instrumen versi 2 berstruktur 5 tema dan 20 subtema | (b), disusun pada fase R1, dengan (a) sebagai jembatan bila klien pertama dimulai sebelum instrumen versi 2 siap | Disetujui, 19 November 2026 |
| D2 | Aturan penetapan tingkat | (a) tetap rata-rata tertimbang; (b) aturan per tema bagian 6.3 sebagai penentu, indeks `O` sebagai pelengkap | (b) | Disetujui, 19 November 2026 |
| D3 | Ambang warna | 0,80 dan 0,50 atau nilai lain | 0,80 dan 0,50 sebagai awal, dikalibrasi setelah asesmen pertama | Disetujui, 19 November 2026 |
| D4 | Fixture baru | Fixture versi 1 tetap untuk instrumen lama; fixture versi 2 dibuat untuk aturan baru beserta `referensi_skoring.py` | Setuju, dikerjakan di fase R7 | Disetujui, 19 November 2026 |
| D5 | Peta silang sebagai data seed | Simpan kode subtema SCL 2.0 di seed | Setuju; hanya kode dan judul, tanpa teks kriteria | Disetujui, 19 November 2026 |
| D6 | Kunjungan fisik | Paling sedikit satu kunjungan proyek fisik setiap asesmen | Setuju | Disetujui, 19 November 2026 |

Pemilik proyek menyetujui seluruh rekomendasi pada 19 November 2026. Instrumen versi 1 dan mesin penilaian versi 1 beserta fixture-nya tetap dipakai sebagai jembatan sampai instrumen versi 2 (D1, D5) selesai ditelaah dan aturan penetapan tingkat per tema (D2) beserta fixture versi 2 (D4) dibangun pada fase R7. Fixture versi 1 tidak diubah.

## 8. Dampak pada fase pembangunan

| Fase | Dampak |
|---|---|
| R1 | Versi instrumen kedua, tanda P dan B per butir, peta silang SCL 2.0, kunjungan fisik di kalkulator |
| R2 | Kerangka sampel mencakup subkontraktor dan pekerja sewaan |
| R3, R4 | Survei dan penilaian mandiri memuat butir P dan B sesuai instrumen versi 2 |
| R5 | Observasi lapangan dikaitkan dengan butir B |
| R6 | Validasi: pernyataan tidak dapat ditelusuri ke orang, catatan umpan balik harian |
| R7 | Mesin penilaian versi 2: penilaian warna per tema, aturan bagian 6.3, fixture baru |
| R10 | Laporan menampilkan profil warna per tema, P dan B, dan indeks `O` sebagai tren |

## Rujukan

Badan Standardisasi Nasional. (2019). *SNI ISO 45001:2018 Sistem manajemen keselamatan dan kesehatan kerja: Persyaratan dan pedoman penggunaan*. Badan Standardisasi Nasional.

Cohen, J. (1960). A coefficient of agreement for nominal scales. *Educational and Psychological Measurement, 20*(1), 37-46. https://doi.org/10.1177/001316446002000104

Hudson, P. (2007). Implementing a safety culture in a major multi-national. *Safety Science, 45*(6), 697-722. https://doi.org/10.1016/j.ssci.2007.04.005

International Organization for Standardization. (2021). *ISO 45003:2021 Occupational health and safety management: Psychological health and safety at work: Guidelines for managing psychosocial risks*. ISO.

Kementerian Ketenagakerjaan Republik Indonesia. (2018). *Peraturan Menteri Ketenagakerjaan Nomor 5 Tahun 2018 tentang Keselamatan dan Kesehatan Kerja Lingkungan Kerja*.

Kementerian Pekerjaan Umum dan Perumahan Rakyat Republik Indonesia. (2021). *Peraturan Menteri Pekerjaan Umum dan Perumahan Rakyat Nomor 10 Tahun 2021 tentang Pedoman Sistem Manajemen Keselamatan Konstruksi*.

LeBreton, J. M., & Senter, J. L. (2008). Answers to 20 questions about interrater reliability and interrater agreement. *Organizational Research Methods, 11*(4), 815-852. https://doi.org/10.1177/1094428106296642

Machfudiyanto, R. A., dkk. (2026). Measuring safety culture maturity in Indonesian construction projects across design and construction phases. *Buildings, 16*(1), 124. https://doi.org/10.3390/buildings16010124

Munda, G., & Nardo, M. (2009). Noncompensatory/nonlinear composite indicators for ranking countries: A defensible setting. *Applied Economics, 41*(12), 1513-1523. https://doi.org/10.1080/00036840601019364

NEN. (2023a). *Safety Culture Ladder 2.0:2023* (edisi bahasa Inggris). Stichting Koninklijk Nederlands Normalisatie Instituut.

NEN. (2023b). *Certification scheme SCL 2.0* (edisi bahasa Inggris). Stichting Koninklijk Nederlands Normalisatie Instituut. https://safetycultureladder.acceptatie.nen.nl/app/uploads/2023/11/Certificatieschema_DEF_EN.pdf

OECD & Joint Research Centre. (2008). *Handbook on constructing composite indicators: Methodology and user guide*. OECD Publishing. https://doi.org/10.1787/9789264043466-en

Parker, D., Lawrie, M., & Hudson, P. (2006). A framework for understanding the development of organisational safety culture. *Safety Science, 44*(6), 551-562. https://doi.org/10.1016/j.ssci.2005.10.004

Republik Indonesia. (2012). *Peraturan Pemerintah Nomor 50 Tahun 2012 tentang Penerapan Sistem Manajemen Keselamatan dan Kesehatan Kerja*.
