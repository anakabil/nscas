# 11. Kebutuhan Aset Visual NSCAS untuk Generator Gambar AI

Dokumen ini adalah daftar kebutuhan ilustrasi, lencana, gambar, logo aplikasi, dan simbol antarmuka NSCAS yang akan dibuat dengan generator gambar AI. Disusun 31 Oktober 2026, setelah menu konsol diberi simbol (docs/05 bagian 2). Gaya visual mengikuti palet tenang di docs/05 bagian 1: modern, elegan, dan tidak mencolok.

## 1. Pembagian tugas: yang dibuat AI dan yang tidak

| Jenis | Cara pembuatan | Alasan |
|---|---|---|
| Logo perusahaan Nusa Safety | Tetap memakai berkas resmi di `aset-logo/`, tidak diubah | Identitas merek perusahaan tidak boleh diubah oleh AI. |
| Logo aplikasi NSCAS (baru) | Konsep dibuat dengan generator AI (bagian 5), lalu dirapikan desainer menjadi vektor final | Logo harus tajam di semua ukuran, orisinal, dan dapat didaftarkan sebagai merek. |
| Simbol antarmuka (41 simbol) | Saat ini memakai set ikon garis Lucide. Set khusus NSCAS dibuat dengan prompt per simbol di bagian 6, lalu diubah menjadi SVG | Simbol antarmuka wajib berupa vektor yang seragam ketebalannya. Hasil generator AI berupa gambar raster, sehingga perlu vektorisasi sebelum dipasang. |
| Ilustrasi, lencana tingkat, sampul laporan, gambar pratinjau tautan | Generator gambar AI (daftar di bagian 4) | Di sinilah AI memberi nilai tambah: suasana, konteks konstruksi, dan kehangatan visual. |

## 2. Panduan gaya

Palet di bawah berlaku untuk semua aset. Akhiran gaya, prompt negatif, dan aturan K3 di bagian ini dipakai untuk ilustrasi dan gambar (bagian 4). Logo (bagian 5) dan simbol antarmuka (bagian 6) memakai akhiran sendiri karena bentuknya jauh lebih sederhana.

1. Gaya: ilustrasi vektor datar yang modern dan minimal. Bentuk geometris bersih, sudut sedikit membulat, banyak ruang kosong, tanpa efek tiga dimensi, tanpa bayangan tajam.
2. Palet (sama dengan antarmuka):

| Warna | Kode | Pemakaian dalam gambar |
|---|---|---|
| Biru batu gelap | `#1E2F45` | Bidang gelap, garis utama |
| Biru batu tua | `#2B4A6F` | Objek utama |
| Biru baja | `#5A7797` | Objek pendukung |
| Biru kabut | `#CBD3DC` | Bidang lembut, latar objek |
| Hijau toska redup | `#6E9A94` | Aksen kedua, tanaman, keberhasilan |
| Oker lembut | `#C29B52` | Aksen hangat, helm, sorotan |
| Putih pudar | `#F4F5F7` | Latar |
| Merah merek | `#E62129` | Aksen sangat kecil saja, misalnya satu detail |

3. Manusia: pekerja konstruksi Indonesia, laki-laki dan perempuan (sebagian pekerja perempuan berhijab di bawah helm), wajah disederhanakan tanpa detail sehingga tidak menyerupai orang nyata.
4. Tanpa teks, huruf, angka, atau logo di dalam gambar. Seluruh tulisan dipasang di antarmuka agar dapat diterjemahkan dan tetap tajam. Generator AI juga sering menghasilkan huruf yang rusak.
5. Latar: aset bertanda "transparan" dibuat di atas latar polos `#FFFFFF`, lalu latarnya dihapus (fitur hapus latar di generator atau di Adobe Express).
6. Konsistensi: buat seluruh set dalam satu sesi. Pakai gambar pertama yang sudah disetujui sebagai acuan gaya, misalnya fitur Style Reference di Midjourney (`--sref`), Adobe Firefly, atau Leonardo.

Akhiran gaya, ditempel di akhir setiap prompt pada bagian 4:

```
modern minimal flat vector illustration, clean geometric shapes, softly rounded corners, elegant and calm corporate style, muted palette of deep slate navy #1E2F45, slate blue #2B4A6F, steel blue #5A7797, mist blue #CBD3DC, muted teal #6E9A94 and soft ochre #C29B52 on off-white #F4F5F7, tiny accent of red #E62129 only, generous negative space, no text, no letters, no numbers, no logos, no watermark
```

Prompt negatif, untuk generator yang menyediakannya:

```
text, letters, numbers, logo, watermark, signature, neon, oversaturated colors, 3D render, photorealistic, glossy, harsh shadows, cluttered background, distorted hands, exaggerated cartoon
```

Aturan K3 untuk manusia, ditempel pada prompt yang memuat pekerja:

```
Indonesian construction workers, men and women, some women wearing hijab under the hard hat, simplified faces without detailed features, every worker wears a white or ochre hard hat with chin strap fastened, orange high-visibility vest, safety boots and work gloves, safe working posture, tidy site
```

## 3. Daftar periksa K3 sebelum aset dipakai

Gambar untuk sistem budaya K3 tidak boleh menampilkan perilaku tidak aman. Setiap hasil generator wajib diperiksa terhadap butir berikut, dan ditolak bila satu butir saja tidak terpenuhi.

| No. | Butir pemeriksaan | Dasar |
|---|---|---|
| 1 | Setiap pekerja memakai helm dengan tali dagu terpasang, rompi reflektif, sepatu keselamatan, dan sarung tangan bila menangani material | Permenakertrans Nomor PER.08/MEN/VII/2010 tentang Alat Pelindung Diri |
| 2 | Pekerjaan di ketinggian memakai full body harness yang tersambung ke titik angkur, dan perancah memiliki pagar pengaman | Permenaker Nomor 9 Tahun 2016 tentang K3 dalam Pekerjaan pada Ketinggian |
| 3 | Tidak ada pekerja yang memegang telepon saat berada di ketinggian, di dekat alat berat, atau saat mengoperasikan peralatan. Pengisian survei digambarkan di area aman, misalnya ruang istirahat | Prinsip pengendalian bahaya pada SMKK, Permen PUPR Nomor 10 Tahun 2021 |
| 4 | Lokasi kerja rapi: tidak ada material berserakan, kabel melintang, orang merokok, atau pekerja di bawah beban yang diangkat crane | Prinsip pengendalian bahaya pada SMKK |
| 5 | Tidak ada logo perusahaan nyata (termasuk klien) dan tidak ada logo atau nama NEN maupun Safety Culture Ladder | CLAUDE.md aturan 8 |
| 6 | Tidak ada wajah yang menyerupai orang nyata | Pelindungan data pribadi dan citra |
| 7 | Tidak ada huruf atau angka di dalam gambar | Bagian 2 butir 4 |
| 8 | Warna sesuai palet; tidak ada warna neon atau jenuh | docs/05 bagian 1 |
| 9 | Tidak ada bentuk tangga, segel, pita, medali, atau stempel yang dapat dikira tanda sertifikasi | Hasil NSCAS adalah pengukuran internal, bukan sertifikat Safety Culture Ladder (CLAUDE.md) |

## 4. Daftar aset

Prioritas 1 paling berdampak dan dikerjakan lebih dulu. Ukuran adalah ukuran berkas yang diserahkan. Bila generator memberi ukuran lain, pilih rasio yang sama; saya akan memotong dan mengompresnya.

### 4.1 Ringkasan

| ID | Nama berkas | Letak di aplikasi | Ukuran (rasio) | Latar | Batas berkas | Prioritas |
|---|---|---|---|---|---|---|
| V01 | `login-panel.webp` | Panel kiri halaman masuk, di belakang nama sistem | 1200 x 1600 (3:4) | Gelap penuh | 150 KB | 1 |
| V02 | `empty-start.png` | Panduan "Mulai pengukuran" di daftar asesmen | 800 x 600 (4:3) | Transparan | 120 KB | 1 |
| V03 | `phase-preparation.png` | Tahap 1 Persiapan: kartu akses cepat dan penanda kemajuan | 640 x 480 (4:3) | Transparan | 80 KB | 1 |
| V04 | `phase-data-collection.png` | Tahap 2 Pengumpulan data | 640 x 480 (4:3) | Transparan | 80 KB | 1 |
| V05 | `phase-scoring.png` | Tahap 3 Penilaian | 640 x 480 (4:3) | Transparan | 80 KB | 1 |
| V06 | `phase-results.png` | Tahap 4 Hasil dan tindak lanjut | 640 x 480 (4:3) | Transparan | 80 KB | 1 |
| V07 | `survey-welcome.webp` | Layar pembuka survei responden (telepon) | 720 x 480 (3:2) | `#F4F5F7` | 25 KB | 1 |
| V08 | `survey-thanks.webp` | Layar terima kasih survei | 720 x 480 (3:2) | `#F4F5F7` | 25 KB | 1 |
| V09 | `survey-privacy.webp` | Layar persetujuan dan anonimitas survei | 480 x 480 (1:1) | `#F4F5F7` | 15 KB | 1 |
| V10 | `report-cover.jpg` | Pita sampul laporan PDF | 2480 x 1100 (kira-kira 9:4) | Gelap penuh | 400 KB | 1 |
| V11 | `og-image.png` | Pratinjau tautan di WhatsApp dan surel | 1200 x 630 (1,91:1) | Gelap penuh | 300 KB | 1 |
| V12 | `empty-respondents.png` | Daftar responden kosong | 800 x 600 (4:3) | Transparan | 80 KB | 2 |
| V13 | `empty-evidence.png` | Daftar bukti kosong | 800 x 600 (4:3) | Transparan | 80 KB | 2 |
| V14 | `empty-observations.png` | Jendela observasi kosong | 800 x 600 (4:3) | Transparan | 80 KB | 2 |
| V15 | `empty-report.png` | Belum ada versi laporan | 800 x 600 (4:3) | Transparan | 80 KB | 2 |
| V16 | `empty-action-plan.png` | Daftar kesenjangan kosong | 800 x 600 (4:3) | Transparan | 80 KB | 2 |
| V17 | `state-forbidden.png` | Halaman akses ditolak | 800 x 600 (4:3) | Transparan | 80 KB | 2 |
| V18 | `state-link-unavailable.png` | Tautan survei atau kode QR tidak berlaku | 800 x 600 (4:3) | Transparan | 40 KB | 2 |
| V19 | `state-not-found.png` | Halaman tidak ditemukan (baru) | 800 x 600 (4:3) | Transparan | 80 KB | 2 |
| V20 sampai V24 | `level-1.png` sampai `level-5.png` | Lencana tingkat kematangan di dasbor dan laporan | 512 x 512 (1:1) | Transparan | 40 KB per berkas | 2 |
| V25 | `email-header.png` | Kepala surel undangan dan pengingat | 1200 x 300 (4:1) | Gelap penuh | 80 KB | 2 |
| V26 | `pattern-tile.png` | Pola latar halus untuk kepala halaman dan panel masuk | 512 x 512 (1:1), dapat disambung | Gelap penuh | 40 KB | 3 |
| L01 sampai L05 | Lihat bagian 5 | Ikon tab peramban, ikon aplikasi observasi, halaman masuk, sampul laporan, kepala surel | 1024 x 1024 (1:1) | Putih | Tidak dibatasi | 1 |
| S01 sampai S41 | Lihat bagian 6 | Menu konsol, menu asesmen, akses cepat, dan penanda status | 1024 x 1024 (1:1) | Putih | Tidak dibatasi | 2 |

Batas berkas survei (V07 sampai V09) ketat karena halaman survei dibuka pekerja dengan sinyal lemah. Muatan halaman survei 178 KB sebelum aset dipasang dan 187 KB sesudahnya, dari batas 350 KB yang diuji otomatis (docs/07).

### 4.2 Prompt per aset

Setiap prompt di bawah ditambah akhiran gaya di bagian 2. Prompt yang memuat pekerja juga ditambah aturan K3 di bagian 2.

V01 Panel halaman masuk. Komposisi gelap dan tenang; bagian kiri atas dan tengah dibiarkan polos untuk logo dan tulisan.

```
abstract architectural line drawing of a modern building under construction with a tower crane and steel frame, thin light lines in mist blue and steel blue on a deep slate navy #1E2F45 background, very low contrast, calm, lots of empty space in the upper left and center, subtle depth
```

V02 Mulai pengukuran.

```
safety culture assessor with a tablet standing in front of a building under construction, a large checklist card with three tick boxes floating beside, a hard hat and a clipboard on a small table, welcoming and calm
```

V03 Persiapan.

```
planning a safety culture assessment: a site blueprint, a simple organisation chart of offices and projects as connected nodes, a sliders control panel, two assessors discussing at a table
```

V04 Pengumpulan data. Pengisian survei di ruang istirahat, bukan di area kerja.

```
construction workers sitting in a clean site rest area filling in a short survey on their smartphones, a folder of documents and a camera nearby, relaxed and safe setting away from machinery
```

V05 Penilaian.

```
two safety assessors reviewing evidence documents side by side at a desk, a balance scale symbol and a checklist between them, focused and fair atmosphere
```

V06 Hasil dan tindak lanjut.

```
a clean bar chart rising in steps next to an action plan checklist and a target symbol, a manager and a site supervisor shaking hands, sense of progress and improvement
```

V07 Pembuka survei. Bentuk sederhana dengan sedikit detail agar berkas tetap kecil.

```
one construction worker sitting on a bench in a site rest area holding a smartphone, a speech bubble with a simple checkmark, very simple shapes, few details, flat colors
```

V08 Terima kasih.

```
a smiling construction worker giving a thumbs up next to a large checkmark inside a soft shield shape, very simple shapes, few details, flat colors
```

V09 Persetujuan dan anonimitas.

```
a shield with a padlock and an anonymous person silhouette inside, simple and reassuring, very few details, flat colors
```

V10 Sampul laporan.

```
wide abstract banner of a modern construction skyline with tower cranes, layered translucent geometric shapes suggesting steps of a maturity ladder, deep slate navy #1E2F45 background with slate blue and mist blue layers, a thin soft ochre accent line, elegant and calm, empty band on the left third for a title
```

V11 Pratinjau tautan. Separuh kiri dikosongkan untuk tulisan yang dipasang kemudian.

```
abstract construction site motif on the right half, a hard hat and a checklist icon formed by simple geometric shapes, deep slate navy background, left half completely empty for a title
```

V12 Responden kosong.

```
an empty list card with three blank rows and a group of worker silhouettes waiting beside it, an upload arrow symbol, calm
```

V13 Bukti kosong.

```
an open empty folder with a document sliding into it, a small paperclip and a magnifying glass, calm
```

V14 Observasi kosong.

```
a camera on a tripod facing a calm construction site with a map pin and a small clock, nobody in frame, calm
```

V15 Laporan kosong.

```
a blank report document with a chart outline and a pen beside it, a signature line, calm
```

V16 Rencana aksi kosong.

```
an empty kanban board with three columns and a single card being placed, a small flag, calm
```

V17 Akses ditolak.

```
a closed door with a shield and padlock emblem, a polite stop hand symbol, calm and not alarming
```

V18 Tautan tidak berlaku.

```
a broken chain link and a small hourglass beside a smartphone, calm and not alarming, very few details
```

V19 Halaman tidak ditemukan.

```
a construction worker looking at a large site map with a dotted path ending at a question mark shape without any letter, friendly and calm
```

V20 sampai V24 Lencana tingkat kematangan. Lima lencana dengan komposisi identik: cincin ukur yang terbagi lima busur sama panjang, searah jarum jam mulai dari pukul tujuh. Jumlah busur yang terisi sesuai tingkat, dan warnanya mengikuti gradasi tingkat (1 `#CBD3DC`, 2 `#A9B8C8`, 3 `#8399B1`, 4 `#5A7797`, 5 `#2B4A6F`). Bentuk tangga sengaja dihindari agar tidak dikira tanda sertifikasi (bagian 3 butir 9). Nama dan angka tingkat dipasang di antarmuka, bukan di gambar. Buat lencana tingkat 3 lebih dulu, lalu pakai sebagai acuan gaya untuk keempat lencana lain.

```
circular gauge emblem made of five equal thick arc segments with small gaps, arranged clockwise starting at seven o'clock and ending at five o'clock, the first three segments filled with steel blue #8399B1 and the remaining two segments as light mist blue #E8EDF2, empty center, flat vector, centered, no text, no numbers, no needle
```

V25 Kepala surel.

```
thin wide banner of abstract construction skyline lines and soft geometric layers in slate blue and mist blue on deep slate navy, empty center area, elegant and calm
```

V26 Pola latar.

```
seamless repeating pattern tile of tiny thin line icons (hard hat, gear, clipboard, shield, building) evenly spaced, line color #2B4A6F on background #1E2F45, very subtle, tileable
```

## 5. Logo aplikasi NSCAS

### 5.1 Kedudukan logo

NSCAS adalah produk PT Nusa Rendra Jayatama. Logo aplikasi melengkapi logo Nusa Safety, bukan menggantikannya. Logo dipakai di enam tempat:

1. ikon tab peramban (favicon);
2. ikon aplikasi observasi di layar telepon;
3. panel halaman masuk, berdampingan dengan logo Nusa Safety;
4. sampul laporan PDF;
5. kepala surel;
6. gambar pratinjau tautan.

Logo terdiri atas tiga unsur:

1. Simbol (logomark).
2. Tulisan "NSCAS" (logotype).
3. Baris pengenal "oleh Nusa Safety".

Tulisan tidak dibuat AI. Tulisan disusun dengan huruf Plus Jakarta Sans Bold, huruf antarmuka NSCAS, agar seragam dan tajam.

### 5.2 Makna yang harus terbaca

| No. | Makna | Alasan dalam konsep aplikasi |
|---|---|---|
| 1 | Pengukuran yang objektif | NSCAS adalah alat ukur; hasilnya angka indeks dan tingkat kematangan |
| 2 | Kematangan yang meningkat bertahap | Lima tingkat kematangan budaya K3 dan rencana aksi untuk naik tingkat |
| 3 | Budaya dibentuk bersama oleh orang | Responden adalah pekerja di semua strata, dari direksi sampai subkontraktor |
| 4 | Keselamatan dan perlindungan | Konteks K3 dan perlindungan data responden |
| 5 | Akar Nusantara (opsional) | Nama Nusa Safety; cukup lewat lengkung halus, bukan peta |

### 5.3 Batasan

| No. | Batasan | Alasan |
|---|---|---|
| 1 | Tidak berbentuk tangga, anak tangga berjajar, segel, pita, medali, atau stempel | Dapat dikira tanda sertifikasi Safety Culture Ladder. NSCAS adalah pengukuran internal, bukan sertifikasi (CLAUDE.md). |
| 2 | Helm, palang medis, dan bola dunia tidak menjadi unsur utama | Klise dan tidak membedakan NSCAS dari produk K3 lain |
| 3 | Tetap terbaca pada 16 piksel | Paling banyak tiga bentuk utama, tanpa garis yang sangat tipis |
| 4 | Paling banyak tiga nada biru dari palet (`#1E2F45`, `#2B4A6F`, `#5A7797`) ditambah aksen merah kecil, dan tetap utuh dalam satu warna | Nada yang lebih muda dari `#5A7797` hampir hilang di atas putih pada ukuran kecil. Versi putih dipakai di kepala halaman gelap, versi biru batu gelap untuk cetak satu warna. |
| 5 | Tidak meniru logo Nusa Safety | Boleh meminjam bingkai persegi membulat sebagai tanda kekerabatan merek |
| 6 | Tanpa huruf di dalam simbol | Tulisan "NSCAS" dipasang terpisah |

### 5.4 Tiga arah konsep

Generate ketiganya, bandingkan, lalu pilih satu. Rekomendasi saya konsep A. Bentuknya paling khas untuk sistem asesmen, tetap terbaca pada ukuran kecil, dan selaras dengan lencana tingkat (V20 sampai V24) yang memakai cincin ukur yang sama.

Akhiran untuk prompt logo:

```
minimal flat vector logo mark, geometric and balanced, bold simple shapes that stay legible at 16 pixels, colors limited to deep slate navy #1E2F45, slate blue #2B4A6F and steel blue #5A7797 with one small red #E62129 accent, plain white background, centered, generous margin, no text, no letters, no gradients, no 3D, no mockup, no shadow
```

Prompt negatif untuk logo:

```
text, letters, ladder, staircase, steps, certificate seal, ribbon, medal, stamp, laurel wreath, hard hat clipart, medical cross, globe, map, photo, 3D, gradient, mockup
```

Konsep A, cincin ukur kematangan. Lima busur membentuk lingkaran terbuka seperti alat ukur, makin tebal dan makin gelap searah jarum jam dari biru baja ke biru batu gelap (tingkat 1 ke 5). Satu titik merah kecil di ujung busur kelima menandai tujuan, yaitu budaya yang matang.

```
a circular gauge mark made of five arc segments with small gaps, each segment slightly thicker and darker than the previous one going clockwise from steel blue #5A7797 to deep slate navy #1E2F45, a small red dot at the end of the fifth segment, empty center
```

Konsep B, perisai berlapis. Perisai tersusun dari lima pita lengkung yang naik dari biru baja di bawah ke biru batu gelap di atas. Di tengahnya ada ruang negatif berbentuk anak panah ke atas yang menandai peningkatan.

```
a shield shape built from five stacked curved bands rising from steel blue #5A7797 at the bottom to deep slate navy #1E2F45 at the top, the negative space between the bands forms an upward arrow in the center, a small red dot at the tip of the arrow
```

Konsep C, lingkar orang. Tiga figur manusia abstrak, masing-masing kepala bulat dan badan lengkung, saling merangkul membentuk lingkaran. Di tengahnya ada titik merah kecil yang menandai kepedulian bersama terhadap keselamatan.

```
three abstract human figures made of a round head and a curved body each, arms linked to form a closed circle, slate blue #2B4A6F and deep slate navy #1E2F45, a small red dot in the center of the circle
```

### 5.5 Berkas logo yang dibutuhkan

| ID | Nama berkas | Isi | Ukuran | Cara pembuatan |
|---|---|---|---|---|
| L01 | `nscas-mark-color.png` | Simbol berwarna, latar putih | 1024 x 1024 | Generator AI dari konsep terpilih |
| L02 | `nscas-mark-mono.svg` | Simbol satu warna dalam dua versi: putih untuk latar gelap dan `#1E2F45` untuk cetak satu warna | Vektor | Diturunkan dari L01 saat vektorisasi |
| L03 | `nscas-app-icon.png` | Simbol putih di dalam persegi membulat `#1E2F45`, zona aman 80 persen (ikon aplikasi di telepon) | 1024 x 1024 | Diturunkan dari L01 |
| L04 | `favicon.svg` | Versi sederhana untuk 16 dan 32 piksel | Vektor | Saya buat dari vektor final |
| L05 | `nscas-lockup.svg` | Simbol, tulisan "NSCAS", dan "oleh Nusa Safety" mendatar | Vektor | Saya susun dengan Plus Jakarta Sans setelah simbol final |

### 5.6 Langkah setelah konsep terpilih

1. Generate empat sampai delapan variasi dari konsep terpilih, lalu pilih satu.
2. Uji keterbacaan: kecilkan ke 32 dan 16 piksel, lalu lihat juga versi satu warna.
3. Minta desainer merapikan dan memvektorkan simbol, misalnya dengan Adobe Illustrator. Ada dua alasan. Pertama, garis hasil AI jarang benar-benar rapi. Kedua, perlindungan hak cipta atas karya yang sepenuhnya dihasilkan AI belum jelas pengaturannya dalam UU Nomor 28 Tahun 2014 tentang Hak Cipta, sehingga finalisasi oleh desainer memperkuat posisi kepemilikan perusahaan.
4. Setelah final, pertimbangkan pendaftaran merek "NSCAS", baik kata maupun logo, ke Direktorat Jenderal Kekayaan Intelektual sesuai UU Nomor 20 Tahun 2016 tentang Merek dan Indikasi Geografis.
5. Serahkan SVG final. Saya pasang di favicon, ikon aplikasi observasi, halaman masuk, sampul laporan, dan kepala surel.

## 6. Simbol antarmuka: keterangan dan prompt per simbol

### 6.1 Aturan bentuk

1. Digambar di kisi 24 x 24 dengan garis 2 piksel seragam (tampil 1,75 piksel di antarmuka), ujung dan sambungan garis membulat.
2. Hanya garis tepi tanpa isi, kecuali titik atau aksen kecil yang memang diminta.
3. Satu warna. Saat dipasang, warnanya mengikuti teks: biru batu tua saat aktif, abu-abu saat tidak aktif. Karena itu simbol cukup dibuat dalam satu warna `#2B4A6F`.
4. Tampak depan datar, tanpa perspektif, bayangan, atau bidang latar.
5. Paling banyak tiga sampai empat unsur, agar tetap dapat dibedakan pada ukuran 16 piksel.
6. Simbol yang sudah menjadi kebiasaan umum (keluar, menu, tambah, panah, centang) mempertahankan bentuk kebiasaannya.

Awalan prompt simbol. Tempelkan sebelum subjek di kolom terakhir tabel 6.2 sampai 6.5:

```
single minimalist line icon, drawn on a 24 by 24 grid and rendered large at 1024 by 1024 pixels, uniform 2 pixel stroke, rounded line caps and rounded joins, outline only without fill, single color #2B4A6F on a pure white background, centered with even padding, flat front view, geometric, consistent with a professional enterprise software icon set, no text, no letters, no numbers, no shading, no background shape, subject:
```

Prompt negatif simbol:

```
filled shapes, multiple colors, gradient, 3D, shadow, perspective, background circle, sketchy or hand drawn lines, uneven stroke, text, letters
```

### 6.2 Kepala halaman

| ID | Berkas | Menu | Fungsi di aplikasi | Bentuk yang diharapkan | Hindari | Subjek prompt |
|---|---|---|---|---|---|---|
| S01 | `nav-assessments.svg` | Asesmen | Daftar seluruh asesmen budaya K3; pintu masuk setiap pengukuran | Papan klip yang penjepitnya berbentuk helm sederhana, dengan tiga baris daftar periksa | Palang medis | `a clipboard whose top clip is shaped like a simple hard hat, with three short checklist lines on the board` |
| S02 | `nav-organizations.svg` | Organisasi dan pengguna | Organisasi klien dan akun pengguna beserta perannya | Gedung kantor bertingkat dengan satu figur orang di depannya | Pabrik berasap, pilar bank | `an office building with three rows of windows and a small person silhouette standing in front` |
| S03 | `nav-retention.svg` | Retensi data | Pemusnahan data mentah setelah masa simpan berakhir, beserta berita acaranya | Kotak arsip dengan jam pasir kecil | Tempat sampah, api | `an archive storage box with a small hourglass at the lower right` |
| S04 | `nav-account.svg` | Akun saya | Profil, kata sandi, dan verifikasi dua langkah | Siluet setengah badan dengan perisai bergembok kecil di kanan bawah | Wajah berdetail | `a person bust silhouette with a small shield containing a padlock at the lower right` |
| S05 | `nav-logout.svg` | Keluar | Mengakhiri sesi | Bingkai pintu dengan panah keluar ke kanan | Tanda silang, tombol daya | `an open door frame with an arrow pointing out to the right` |
| S06 | `nav-menu.svg` | Menu (telepon) | Membuka menu utama di layar sempit | Tiga garis mendatar sama panjang | Tiga titik | `three horizontal lines of equal length` |

### 6.3 Tahap asesmen

| ID | Berkas | Tahap | Fungsi di aplikasi | Bentuk yang diharapkan | Hindari | Subjek prompt |
|---|---|---|---|---|---|---|
| S07 | `nav-phase-preparation.svg` | 1. Persiapan | Menyusun asesmen: rincian, unit, strata, parameter, sampel, dan tim | Gulungan cetak biru dengan pensil dan roda gigi kecil | Kunci pas (kesan perbaikan mesin) | `a rolled blueprint sheet with a pencil lying across it and a small gear in the corner` |
| S08 | `nav-phase-data-collection.svg` | 2. Pengumpulan data | Survei pekerja, penilaian mandiri, bukti, observasi, dan validasi | Baki masuk dengan panah turun dan tiga titik di atasnya (data datang dari banyak sumber) | Awan, ember | `an inbox tray with a downward arrow entering it and three small dots above the arrow` |
| S09 | `nav-phase-scoring.svg` | 3. Penilaian | Penilaian bukti oleh asesor dan rapat panel | Timbangan dua lengan yang seimbang (adil, dinilai dua asesor) | Palu hakim | `a balanced two pan scale with a central pillar` |
| S10 | `nav-phase-results.svg` | 4. Hasil dan tindak lanjut | Dasbor, rencana aksi, dan laporan | Sasaran dengan anak panah tepat di tengah dan garis tren naik kecil | Piala, tangga | `a target with three rings and an arrow hitting the center, a small upward trend line beside it` |

### 6.4 Halaman asesmen

| ID | Berkas | Halaman | Fungsi di aplikasi | Bentuk yang diharapkan | Hindari | Subjek prompt |
|---|---|---|---|---|---|---|
| S11 | `nav-overview.svg` | Ringkasan | Kemajuan, langkah berikutnya, dan akses cepat | Empat persegi membulat 2 x 2, satu terisi | Rumah | `a two by two grid of rounded squares with the top left square filled` |
| S12 | `nav-details.svg` | Rincian | Nama, periode, lingkup, dan versi instrumen | Lembar dokumen dengan sudut terlipat dan tiga baris teks | Buku tebal | `a document sheet with a folded top right corner and three text lines` |
| S13 | `nav-units.svg` | Unit | Kantor, lokasi, dan proyek yang diukur | Penanda lokasi berisi gedung kecil (berbeda dari S02) | Peta penuh | `a map location pin with a tiny building inside` |
| S14 | `nav-strata.svg` | Strata | Kelompok jabatan dan jumlah pekerjanya | Tiga lapisan bertumpuk seperti piramida jabatan | Tangga | `three stacked horizontal layers forming a flat pyramid, each layer slightly wider than the one above` |
| S15 | `nav-parameters.svg` | Parameter | Bobot, ambang, dan teks persetujuan responden | Tiga penggeser mendatar dengan kenop di posisi berbeda | Roda gigi (sudah dipakai S07) | `three horizontal slider tracks with round knobs at different positions` |
| S16 | `nav-sampling.svg` | Kalkulator sampel | Jumlah responden minimal setiap strata | Lingkaran berisi sepuluh titik, tiga terisi (sampel diambil dari populasi) | Kalkulator saku | `a circle containing ten small dots arranged evenly with three of them filled` |
| S17 | `nav-team.svg` | Tim asesor | Asesor utama dan anggota tim | Dua figur setengah badan, yang depan berlencana centang kecil | Tiga figur (sudah dipakai S18) | `two person bust silhouettes side by side, the front one with a small check badge` |
| S18 | `nav-respondents.svg` | Responden | Daftar pekerja responden, jendela survei, dan tautan survei | Tiga figur pekerja berhelm sederhana | Figur berdasi | `three worker silhouettes wearing simple hard hats, the middle one slightly in front` |
| S19 | `nav-qr.svg` | Kode QR | Kode QR untuk pekerja tanpa surel | Kode QR sederhana dengan tiga persegi sudut dan beberapa titik | Kode batang | `a simplified QR code with three corner squares and a few small squares in the middle` |
| S20 | `nav-participation.svg` | Partisipasi | Tingkat partisipasi per unit dan strata | Garis tren naik dengan figur orang kecil di titik tertinggi | Panah zig-zag tajam | `a rising line chart with three points and a tiny person icon at the highest point` |
| S21 | `nav-self-assessments.svg` | Penilaian mandiri | Penilaian mandiri oleh manajemen | Figur setengah badan berdasi dengan tanda centang | Cermin | `a person bust silhouette wearing a necktie with a check mark beside the shoulder` |
| S22 | `nav-evidence.svg` | Bukti | Dokumen bukti untuk setiap karakteristik | Map terbuka dengan selembar dokumen dan penjepit kertas | Kaca pembesar besar | `an open folder with a document sheet and a paperclip` |
| S23 | `nav-observations.svg` | Observasi | Foto dan video lapangan yang diambil langsung dengan kamera perangkat, beserta lokasinya | Kamera dengan penanda lokasi kecil | Kamera pengawas (kesan memata-matai pekerja) | `a camera with a small map location pin at the top right` |
| S24 | `nav-validation.svg` | Validasi | Diskusi kelompok terarah dan wawancara | Dua gelembung percakapan bertumpuk, yang depan berisi tiga titik | Mikrofon | `two overlapping speech bubbles, the front one containing three dots` |
| S25 | `nav-scoring.svg` | Penilaian asesor | Nilai bukti per karakteristik, kelipatan 0,5 | Daftar periksa dengan bintang setengah terisi | Rapor sekolah | `a checklist with two check marks and a half filled star at the bottom` |
| S26 | `nav-panel.svg` | Rapat panel | Pembahasan bersama dan penetapan hasil final | Meja bundar tampak atas dengan tiga kursi | Palu hakim (kesan pengadilan) | `a round table seen from above with three chairs around it` |
| S27 | `nav-dashboard.svg` | Dasbor | Indeks, peta warna, dan kesenjangan | Tiga batang grafik dalam bingkai persegi membulat | Speedometer mobil | `a bar chart with three bars of different heights inside a rounded rectangle frame` |
| S28 | `nav-action-plan.svg` | Rencana aksi | Daftar kesenjangan dan rencana aksi | Daftar tugas dengan bendera kecil | Kalender | `a to do list with two lines and a small flag at the top right` |
| S29 | `nav-report.svg` | Laporan | Penyusunan, finalisasi, dan tanda tangan laporan | Dokumen dengan grafik batang kecil dan garis tanda tangan | Segel atau stempel | `a document sheet with a small bar chart in the upper half and a signature line at the bottom` |
| S30 | `nav-audit.svg` | Jejak audit | Riwayat seluruh perubahan data asesmen | Jam dengan panah melingkar berlawanan arah jarum jam | Kaca pembesar | `a clock face with a counterclockwise circular arrow around it` |

### 6.5 Simbol bantu

Simbol-simbol ini sudah menjadi kebiasaan umum di semua aplikasi. Bentuknya cukup diseragamkan gayanya dengan set di atas, tanpa mengubah makna.

| ID | Berkas | Dipakai untuk | Subjek prompt |
|---|---|---|---|
| S31 | `ui-check.svg` | Tahap atau langkah selesai | `a single check mark` |
| S32 | `ui-check-circle.svg` | Syarat terpenuhi | `a check mark inside a circle` |
| S33 | `ui-circle.svg` | Syarat belum terpenuhi | `an empty circle` |
| S34 | `ui-x-circle.svg` | Pemeriksaan gagal di halaman status sistem | `an x mark inside a circle` |
| S35 | `ui-arrow-right.svg` | Membuka halaman tujuan | `an arrow pointing right` |
| S36 | `ui-chevron-down.svg` | Membuka atau melipat kelompok menu | `a downward chevron` |
| S37 | `ui-plus.svg` | Membuat data baru, misalnya asesmen baru | `a plus sign` |
| S38 | `ui-login.svg` | Tombol Masuk di beranda | `a door frame with an arrow pointing in from the left` |
| S39 | `ui-activity.svg` | Tautan status sistem | `a heartbeat pulse line` |
| S40 | `ui-database.svg` | Status basis data | `a database cylinder with three stacked disks` |
| S41 | `ui-hard-drive.svg` | Status penyimpanan berkas | `a hard drive box with two small indicator dots` |

### 6.6 Cara membuat set yang seragam

1. Buat S11 (Ringkasan) lebih dulu sampai sesuai, lalu jadikan acuan gaya (style reference) untuk semua simbol lain.
2. Buat satu simbol per gambar. Hasilnya lebih terkendali daripada satu lembar berisi banyak simbol.
3. Ubah setiap simbol menjadi SVG, misalnya dengan Image Trace di Adobe Illustrator. Bila Bapak cukup mengirim PNG, saya yang melakukan vektorisasi.
4. Bandingkan seluruh set berdampingan pada 16 dan 24 piksel: ketebalan garis, ukuran visual, dan gaya sudut harus sama.
5. Saya ubah warnanya menjadi warna teks (`currentColor`), lalu memasangnya menggantikan Lucide melalui `src/components/assessment/nav-icons.ts`.

## 7. Penyerahan dan pemasangan

1. Simpan setiap aset dengan nama berkas persis seperti tabel 4.1, 5.5, dan 6.2 sampai 6.5.
2. Catat prompt, nama generator, dan tanggal pembuatan setiap aset sebagai bukti asal-usul. Pastikan paket generator yang dipakai mengizinkan penggunaan komersial.
3. Kirimkan berkasnya melalui percakapan ini atau satu folder bersama. Ilustrasi dan gambar saya periksa dengan daftar periksa K3, saya ubah ke WebP, saya kompres sesuai batas berkas, lalu saya simpan di `public/illustrations/`. Simbol saya ubah ke SVG dengan warna `currentColor` dan saya simpan di `public/icons/nav/`. Logo saya simpan di `public/brand/`. Setelah itu semuanya saya pasang di letak masing-masing.
4. Ilustrasi diperlakukan sebagai hiasan: bila berkas gagal dimuat, halaman tetap utuh karena seluruh informasi ada di teks.

## 8. Status pemasangan (31 Oktober 2026)

### 8.1 Paket yang diterima

Paket `NSCAS_ALL_Assets_72_plus_Batch07.zip` berisi 72 aset inti (26 ilustrasi, 5 berkas logo, 41 simbol) dan 10 berkas pelengkap responsif (Batch 7). Menurut catatan asal-usul paket, gambar disusun sebagai jalur vektor SVG dengan Python lalu diekspor ke PNG, WebP, dan JPEG. Arah visualnya dijajaki lebih dulu dengan generator gambar OpenAI. Gambar ini bukan foto. Catatan tersebut memenuhi butir 2 bagian 7.

### 8.2 Hasil pemeriksaan

| Pemeriksaan | Hasil |
|---|---|
| Keamanan SVG (skrip, atribut peristiwa, tautan keluar, entitas, `foreignObject`) | Bersih pada 73 berkas SVG |
| Keseragaman teknis simbol | 41 simbol memakai viewBox 24 x 24, garis 2, dan `currentColor` |
| Daftar periksa K3 bagian 3 | Terpenuhi: helm dengan tali dagu, rompi bergaris pemantul, sepatu keselamatan, sarung tangan, pekerja perempuan berhijab, tidak ada pekerjaan di ketinggian tanpa pengaman, tanpa teks, tanpa bentuk tangga atau segel |
| Ukuran berkas | Semua di bawah batas tabel 4.1; aset survei 4 sampai 8 KB |
| Muatan halaman survei | 187 KB setelah pemasangan (sebelumnya 178 KB; batas 350 KB). Ilustrasi survei dan halaman keadaan memakai elemen img biasa, dan halaman tidak ditemukan tidak memakai next/link, karena keduanya menarik sekitar 22 KB JavaScript konsol ke setiap halaman survei |
| Catatan mutu (bukan pelanggaran) | Pose duduk pada V04 dan V07 agak kaku; S13 Unit agak mirip tanda jeda; S26 Rapat panel agak mirip serangga pada 16 piksel |

### 8.3 Perbaikan sebelum pemasangan

| Simbol | Masalah pada ukuran sebenarnya | Perbaikan |
|---|---|---|
| S15 Parameter | Kenop berisi putih menjadi gumpalan di latar gelap | Lintasan diputus di sekitar kenop, tanpa isian |
| S17 Tim asesor | Lencana centang berisi putih | Isian dihapus, garis bahu dipendekkan agar tidak menembus lencana |
| S16 Kalkulator sampel | Sepuluh titik berjari-jari 0,6 tidak terbaca pada 16 piksel | Enam titik lebih besar: tiga terisi (sampel), tiga kosong (populasi) |

### 8.4 Letak pemasangan

| Aset | Letak |
|---|---|
| S01 sampai S41 | Seluruh simbol antarmuka, menggantikan Lucide (`public/icons/nav/`, `npm run icons`) |
| Logo NSCAS | Kepala konsol, halaman masuk, beranda (komponen SVG dan teks HTML) |
| L04 favicon, Batch 7 `favicon.ico` dan `apple-touch-icon.png` | `src/app/icon.svg`, `favicon.ico`, `apple-icon.png` |
| Batch 7 ikon aplikasi 192 dan 512 | Manifest aplikasi observasi `/o`, termasuk ikon bertopeng (maskable) |
| V01 | Panel kiri halaman masuk |
| V02 | Panduan "Mulai pengukuran" di daftar asesmen |
| V03 sampai V06 | Kartu "Langkah berikutnya" di Ringkasan, sesuai tahap yang berjalan |
| V07, V09, V08 | Layar pembuka, persetujuan, dan terima kasih survei |
| V10 | Pita sampul laporan PDF, dengan logo Nusa Safety di atasnya |
| V11 | Gambar pratinjau tautan (Open Graph) |
| V12 sampai V16 | Keadaan kosong: responden, bukti, observasi, laporan, rencana aksi |
| V17, V19 | Halaman akses ditolak dan halaman tidak ditemukan (baru) |
| V18 | Tautan survei, penilaian mandiri, atau kode QR yang tidak berlaku. Tautan yang sudah dipakai memakai V08 karena survei sudah diisi |
| V20 sampai V24 | Kartu tingkat kematangan di dasbor, serta kartu indeks laporan lengkap dan ringkasan eksekutif |
| V25 | Kepala surel undangan, pengingat, dan pengingat rencana aksi. Disisipkan sebagai gambar inline (CID), bukan dimuat dari server, agar pembukaan surel tidak tercatat di server |
| V26 | Pola latar kepala konsol |

### 8.5 Berkas yang tidak dipasang

| Berkas | Alasan |
|---|---|
| `nscas-lockup.svg` | Tulisan berupa elemen teks yang tidak dapat memakai huruf halaman bila dimuat sebagai gambar; diganti komponen `NscasLockup` |
| `nscas-mark-color.png`, `nscas-mark-mono*.svg`, `nscas-app-icon.png` | Sudah terwakili oleh komponen SVG dan ikon aplikasi Batch 7 |
| `concept-alternatives/`, `sources/`, `previews/` | Bahan kerja, bukan aset tayang |
| Batch 7 D01 sampai D05 | Tata letak yang ada memakai V01, V10, V11, dan V25; versi responsif belum diperlukan |
| Batch 7 `favicon-16.png`, `favicon-32.png` | Sudah dicakup `icon.svg` dan `favicon.ico` |

### 8.6 Keputusan yang masih menunggu

1. Persetujuan akhir logo konsep A oleh pemilik merek. Logo sudah tayang di aplikasi dan dapat diganti dengan mengubah satu komponen dan tiga berkas ikon.
2. Keseragaman titik merah: di logo berwarna titik ada di ujung busur kelima, di favicon di tengah busur kelima, dan ikon aplikasi tanpa titik.
3. Pendaftaran merek "NSCAS" ke Direktorat Jenderal Kekayaan Intelektual. Repositori kode bersifat publik, sehingga logo sudah dapat dilihat umum.

## Rujukan

Kementerian Ketenagakerjaan Republik Indonesia. (2016). *Peraturan Menteri Ketenagakerjaan Nomor 9 Tahun 2016 tentang Keselamatan dan Kesehatan Kerja dalam Pekerjaan pada Ketinggian*.

Kementerian Pekerjaan Umum dan Perumahan Rakyat Republik Indonesia. (2021). *Peraturan Menteri Pekerjaan Umum dan Perumahan Rakyat Nomor 10 Tahun 2021 tentang Pedoman Sistem Manajemen Keselamatan Konstruksi*.

Kementerian Tenaga Kerja dan Transmigrasi Republik Indonesia. (2010). *Peraturan Menteri Tenaga Kerja dan Transmigrasi Nomor PER.08/MEN/VII/2010 tentang Alat Pelindung Diri*.

Republik Indonesia. (2014). *Undang-Undang Nomor 28 Tahun 2014 tentang Hak Cipta*.

Republik Indonesia. (2016). *Undang-Undang Nomor 20 Tahun 2016 tentang Merek dan Indikasi Geografis*.
