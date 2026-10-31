# 11. Kebutuhan Aset Visual NSCAS untuk Generator Gambar AI

Dokumen ini adalah daftar kebutuhan ilustrasi, lencana, dan gambar NSCAS yang akan dibuat dengan generator gambar AI. Disusun 31 Oktober 2026, setelah menu konsol diberi simbol (docs/05 bagian 2). Gaya visual mengikuti palet tenang di docs/05 bagian 1: modern, elegan, dan tidak mencolok.

## 1. Pembagian tugas: yang dibuat AI dan yang tidak

| Jenis | Cara pembuatan | Alasan |
|---|---|---|
| Simbol menu (25 simbol di konsol) | Sudah terpasang, memakai set ikon garis Lucide | Ikon antarmuka harus berupa vektor yang tajam di semua ukuran, seragam ketebalannya, dan dapat dibaca pembaca layar. Hasil generator AI berupa gambar raster yang ketebalan garisnya tidak konsisten. Set khusus tetap tersedia sebagai pilihan (V27). |
| Logo, ikon aplikasi, favicon | Diturunkan dari berkas logo resmi di `aset-logo/` | Identitas merek tidak boleh diubah oleh AI. |
| Ilustrasi, lencana tingkat, sampul laporan, gambar pratinjau tautan | Generator gambar AI (daftar di bagian 4) | Di sinilah AI memberi nilai tambah: suasana, konteks konstruksi, dan kehangatan visual. |

## 2. Panduan gaya (berlaku untuk semua aset)

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
| V27 | `icon-set-sheet.png` | Set simbol khusus pengganti Lucide (opsional) | 2048 x 2048 | Putih | Tidak dibatasi | 3 |

Batas berkas survei (V07 sampai V09) ketat karena halaman survei dibuka pekerja dengan sinyal lemah. Muatan halaman survei saat ini 178 KB dari batas 350 KB yang diuji otomatis (docs/07).

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

V20 sampai V24 Lencana tingkat kematangan. Lima lencana dengan komposisi identik: tangga lima anak tangga di dalam lingkaran. Jumlah anak tangga yang terisi sesuai tingkat, dan warnanya mengikuti gradasi tingkat (1 `#CBD3DC`, 2 `#A9B8C8`, 3 `#8399B1`, 4 `#5A7797`, 5 `#2B4A6F`). Nama dan angka tingkat dipasang di antarmuka, bukan di gambar. Buat lencana tingkat 3 lebih dulu, lalu pakai sebagai acuan gaya untuk keempat lencana lain.

```
circular badge emblem containing a minimal staircase of five steps, the first three steps filled with steel blue #8399B1 and the remaining two steps as light outlines, thin elegant ring border, flat vector, centered, no text, no numbers
```

V25 Kepala surel.

```
thin wide banner of abstract construction skyline lines and soft geometric layers in slate blue and mist blue on deep slate navy, empty center area, elegant and calm
```

V26 Pola latar.

```
seamless repeating pattern tile of tiny thin line icons (hard hat, gear, clipboard, shield, building) evenly spaced, line color #2B4A6F on background #1E2F45, very subtle, tileable
```

V27 Set simbol khusus (opsional). Hasilnya wajib diubah menjadi SVG di kisi 24 x 24 dengan ketebalan garis seragam. Tanpa itu, simbol akan buram di layar telepon. Rekomendasi saya tetap memakai Lucide.

```
icon set sheet of 25 consistent line icons on a 5 by 5 grid, uniform 2 pixel stroke, rounded line caps, single color #2B4A6F on white: dashboard grid, document, building, layers, sliders, calculator, team, people, QR code, rising trend line, person with check, open folder, camera, chat bubbles, checklist, gavel, bar chart, to-do list, report document with chart, history clock, gear, inbox tray, balance scale, target, archive box
```

## 5. Penyerahan dan pemasangan

1. Simpan setiap aset dengan nama berkas persis seperti tabel 4.1.
2. Catat prompt, nama generator, dan tanggal pembuatan setiap aset sebagai bukti asal-usul. Pastikan paket generator yang dipakai mengizinkan penggunaan komersial.
3. Kirimkan berkasnya melalui percakapan ini atau satu folder bersama. Saya akan memeriksa daftar periksa K3, mengonversi ke WebP, mengompres sesuai batas berkas, menyimpannya di `public/illustrations/`, lalu memasangnya di letak masing-masing.
4. Ilustrasi diperlakukan sebagai hiasan: bila berkas gagal dimuat, halaman tetap utuh karena seluruh informasi ada di teks.

## Rujukan

Kementerian Ketenagakerjaan Republik Indonesia. (2016). *Peraturan Menteri Ketenagakerjaan Nomor 9 Tahun 2016 tentang Keselamatan dan Kesehatan Kerja dalam Pekerjaan pada Ketinggian*.

Kementerian Pekerjaan Umum dan Perumahan Rakyat Republik Indonesia. (2021). *Peraturan Menteri Pekerjaan Umum dan Perumahan Rakyat Nomor 10 Tahun 2021 tentang Pedoman Sistem Manajemen Keselamatan Konstruksi*.

Kementerian Tenaga Kerja dan Transmigrasi Republik Indonesia. (2010). *Peraturan Menteri Tenaga Kerja dan Transmigrasi Nomor PER.08/MEN/VII/2010 tentang Alat Pelindung Diri*.
