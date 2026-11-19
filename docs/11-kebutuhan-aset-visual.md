# 11. Kebutuhan Aset Visual NSCAS Versi 2

Dokumen ini adalah daftar nama, konsep, dan warna untuk logo, ikon, ilustrasi, dan gambar NSCAS versi 2, sebagai bahan generator gambar AI. Daftar versi 1 (tema biru batu) diarsipkan di `docs/arsip-v1/` dan tidak dipakai lagi.

## 1. Arah visual

Nama arah visual: Monokrom Perak dan Emas. Gagasan dasarnya, NSCAS adalah instrumen ukur yang presisi, sehingga tampilannya meminjam bahasa jam tangan mekanis dan alat ukur: bidang hitam, garis logam tipis, dan satu aksen emas.

### 1.1 Palet

| Nama | Kode | Peran | Boleh untuk teks |
|---|---|---|---|
| Obsidian | `#0B0B0C` | Bidang gelap utama: kepala halaman, panel identitas, sampul | Sebagai latar |
| Grafit | `#17171A` | Gradasi bidang gelap | Sebagai latar |
| Arang | `#26262B` | Garis ikon di bidang terang, bidang sekunder gelap | Ya, di bidang terang |
| Perak tua | `#8D9299` | Garis logam, ikon pendukung | Tidak, kontras kurang |
| Perak | `#C7CAD0` | Garis ikon di bidang gelap, bingkai logam | Ya, di bidang gelap |
| Perak terang | `#E9EAEC` | Kilau logam, ikon di bidang gelap | Ya, di bidang gelap |
| Putih | `#FFFFFF` | Bidang kerja, kartu | Ya, di bidang gelap |
| Abu kabut | `#F5F5F6` | Latar halaman | Sebagai latar |
| Emas | `#D4AF37` | Aksen tunggal: tahap berjalan, unsur kunci ikon, busur kelima logo | Ya, hanya di bidang gelap |
| Emas pucat | `#E6CF8B` | Kilau emas, teks kecil di bidang gelap | Ya, hanya di bidang gelap |
| Emas tua | `#84681A` | Emas untuk bidang terang | Ya, di bidang terang (kontras 5,3 banding 1 di atas putih; 4,8 di atas latar halaman) |

Gradasi logam, dipakai hemat:

1. Emas: `#F3DFA2` ke `#D4AF37` ke `#9C7A1E`, arah diagonal.
2. Perak: `#FFFFFF` ke `#C7CAD0` ke `#8D9299`, arah tegak.

### 1.2 Aturan gaya

1. Dua dimensi dan datar. Kesan mewah datang dari proporsi, garis tipis yang rapi, dan ruang kosong, bukan dari efek tiga dimensi, kilap berlebihan, atau bayangan tebal.
2. Emas adalah aksen, bukan warna dasar. Dalam satu gambar, luas emas paling banyak sekitar 10 persen. Satu ikon hanya memiliki satu unsur emas.
3. Tanpa teks, huruf, atau angka di dalam gambar. Tulisan dipasang di antarmuka agar dapat diterjemahkan dan tetap tajam.
4. Tanpa bentuk tangga, segel, medali, pita, stempel, atau karangan daun. Bentuk itu dapat dikira tanda sertifikasi, padahal NSCAS adalah pengukuran internal.
5. Huruf antarmuka: Bodoni Moda untuk judul dan tulisan merek, Instrument Sans untuk teks. Keduanya dipasang lokal (docs/05 bagian 1.2).

### 1.3 Aturan K3 untuk gambar yang memuat pekerja

Setiap gambar pekerja wajib lolos daftar periksa berikut sebelum dipakai. Dasarnya Peraturan Menteri Tenaga Kerja dan Transmigrasi Nomor PER.08/MEN/VII/2010 tentang Alat Pelindung Diri, Peraturan Menteri Ketenagakerjaan Nomor 9 Tahun 2016 tentang K3 dalam Pekerjaan pada Ketinggian, dan Peraturan Menteri PUPR Nomor 10 Tahun 2021.

| No. | Butir |
|---|---|
| 1 | Helm keselamatan terpasang dengan tali dagu |
| 2 | Rompi berpemantul, sepatu keselamatan, dan sarung tangan sesuai pekerjaan |
| 3 | Tidak ada pekerja di ketinggian tanpa pagar pengaman atau sabuk tubuh penuh |
| 4 | Sikap kerja aman, lokasi tertata |
| 5 | Pekerja laki-laki dan perempuan; sebagian pekerja perempuan berhijab di bawah helm |
| 6 | Wajah disederhanakan sehingga tidak menyerupai orang nyata |

Dalam palet ini, rompi digambar perak terang dengan pita pemantul emas pucat, dan helm putih atau emas pucat. Warna jingga dan kuning terang tidak dipakai agar gambar tetap monokrom.

## 2. Status aset

| Kelompok | Jumlah | Status |
|---|---|---|
| Logo NSCAS (bagian 3) | 6 berkas | Sudah dibuat sebagai vektor dan terpasang; menunggu persetujuan pemilik merek |
| Ikon tahap (bagian 4) | 6 | Sudah dibuat sebagai vektor dan terpasang |
| Ikon halaman kerja dan akun (bagian 5) | 31 | Sudah dibuat sebagai vektor dan terpasang (`module-icons.tsx`); prompt di tabel tetap berlaku bila ingin versi bergambar |
| Lencana tingkat kematangan (bagian 6) | 5 | Perlu dibuat |
| Ilustrasi dan gambar (bagian 7) | 22 | Perlu dibuat |

## 3. Logo NSCAS

### 3.1 Konsep: Dial Lima Busur

| Unsur | Makna | Warna |
|---|---|---|
| Lima busur pada lengkung 270 derajat | Lima tingkat kematangan budaya K3, dibaca searah jarum jam seperti alat ukur | Busur 1 sampai 4 perak yang makin terang: `#8D9299`, `#A7ACB3`, `#C3C7CC`, `#E2E4E7` |
| Busur kelima | Tujuan pengukuran, yaitu budaya yang matang | Gradasi emas |
| Garis skala halus di luar busur | Ketelitian dan keterukuran | Putih 38 persen di bidang gelap; hitam 38 persen di bidang terang |
| Monogram N berserif di tengah | Nusa Safety sebagai pemilik metode | Putih `#F4F4F5` di bidang gelap; `#111113` di bidang terang |
| Lengkung terbuka di bawah | Pengukuran yang belum selesai: budaya selalu dapat ditingkatkan | Tanpa warna |

Di bidang terang, urutan perak dibalik (makin gelap) agar busur keempat tetap paling kuat: `#B9BDC3`, `#9A9FA6`, `#7B8087`, `#5B6067`.

### 3.2 Berkas

| ID | Berkas | Isi | Pemakaian |
|---|---|---|---|
| L01 | `public/brand/nscas-mark-dark.svg` | Simbol lengkap dengan garis skala, untuk bidang gelap | Sampul laporan, panel halaman masuk, presentasi |
| L02 | `public/brand/nscas-mark-light.svg` | Simbol lengkap untuk bidang terang | Kop dokumen, laporan |
| L03 | `public/favicon.svg`, `public/favicon.ico` | Lima busur tebal tanpa monogram di persegi membulat hitam | Ikon tab peramban, 16 sampai 48 piksel |
| L04 | `public/apple-touch-icon.png` | Simbol tanpa garis skala di bidang hitam penuh | Layar utama telepon, 180 piksel |
| L05 | `public/brand/nscas-app-icon-192.png`, `-512.png` | Sama dengan L04; simbol di zona aman 80 persen | Ikon aplikasi yang dapat dipasang |
| L06 | Komponen `NscasLockup` | Simbol, tulisan NSCAS berhuruf Bodoni Moda berjarak lebar, dan baris "oleh Nusa Safety" berwarna emas | Kepala halaman, halaman masuk, surel |

Tulisan NSCAS selalu berupa teks, bukan gambar. Sumber vektornya ada di `resources/js/components/brand/nscas-mark.tsx`.

### 3.3 Aturan pakai

1. Ruang bebas di sekeliling simbol paling sedikit selebar satu busur.
2. Ukuran terkecil simbol lengkap 32 piksel. Di bawah itu pakai L03.
3. Simbol tidak diputar, tidak diberi bayangan, dan warnanya tidak diganti.
4. Logo NSCAS melengkapi logo Nusa Safety (`public/brand/logo-long-color.png`), bukan menggantikannya. Logo perusahaan tidak diubah.

### 3.4 Prompt bila ingin menjelajahi variasi

```
minimal luxury logo mark for a precision measurement instrument, a 270 degree open dial made of five thin separate arc segments, four segments in graduated brushed silver from dark to bright and the fifth segment in gold, fine watch dial tick marks outside the arcs, an elegant high contrast serif capital letter N in the center, flat vector, on pure black #0B0B0C background, perfectly symmetric, generous margin, no text other than the single letter N, no gradients except subtle metallic, no 3D, no shadow, no mockup
```

Prompt negatif:

```
ladder, staircase, steps, certificate seal, ribbon, medal, stamp, laurel wreath, shield crest, hard hat clipart, medical cross, globe, 3D render, glossy, bevel, emboss, mockup, photo, extra letters, words
```

### 3.5 Yang masih perlu diputuskan

1. Persetujuan akhir oleh pemilik merek.
2. Perapian oleh desainer dan pemeriksaan kemiripan dengan merek lain.
3. Pendaftaran merek NSCAS ke Direktorat Jenderal Kekayaan Intelektual sesuai Undang-Undang Nomor 20 Tahun 2016. Repositori kode bersifat publik, sehingga logo sudah dapat dilihat umum.

## 4. Ikon enam tahap penilaian

Sudah dibuat di `resources/js/components/icons/stage-icons.tsx`. Kisi 24 x 24, garis 1,5, ujung membulat. Garis mengikuti warna teks; satu unsur berwarna emas.

| ID | Berkas bila dibuat ulang | Tahap | Konsep | Warna garis | Unsur emas |
|---|---|---|---|---|---|
| T01 | `stage-planning.svg` | 1. Perencanaan | Jangka: mengukur dan menetapkan lingkup sebelum bekerja | Arang di bidang terang, perak terang di bidang gelap | Poros jangka |
| T02 | `stage-collection.svg` | 2. Pengumpulan data | Tiga lapisan bertumpuk: tiga sumber data yang terhimpun | Sama | Lapisan teratas |
| T03 | `stage-validation.svg` | 3. Validasi dan triangulasi | Tiga titik yang saling terhubung: temuan diuji dari tiga arah | Sama | Titik puncak |
| T04 | `stage-rating.svg` | 4. Penilaian dan penetapan | Timbangan seimbang: dua asesor, satu ketetapan | Sama | Poros timbangan |
| T05 | `stage-reporting.svg` | 5. Pelaporan dan rencana aksi | Lembar laporan dengan batang hasil | Sama | Tiga batang yang naik |
| T06 | `stage-monitoring.svg` | 6. Pemantauan dan perbaikan | Dua panah melingkar: siklus yang terus berputar | Sama | Titik pusat |

## 5. Ikon halaman kerja dan akun

### 5.1 Aturan bentuk

1. Kisi 24 x 24, garis 1,5 seragam, ujung dan sambungan membulat, hanya garis tepi.
2. Paling banyak tiga sampai empat unsur, agar terbaca pada 16 piksel.
3. Garis satu warna. Satu unsur kunci diberi warna emas dengan isian emas 25 persen.
4. Diserahkan sebagai SVG dengan garis `currentColor` dan unsur emas `#D4AF37`. Bila generator hanya menghasilkan PNG, buat pada 1024 x 1024 di latar putih; vektorisasinya dikerjakan saat pemasangan.

Awalan prompt, ditempel sebelum subjek:

```
single minimalist luxury line icon on a 24 by 24 grid rendered large at 1024 by 1024 pixels, uniform thin 1.5 unit stroke, rounded caps and joins, outline only, charcoal #26262B lines on pure white background with exactly one small element in gold #D4AF37, centered, flat front view, geometric, refined and elegant like a watchmaker pictogram, no text, no letters, no numbers, no shading, no background shape, subject:
```

Prompt negatif:

```
filled shapes, more than one gold element, multiple colors, gradient, 3D, shadow, perspective, sketchy lines, uneven stroke, text, letters, ladder, seal, medal
```

### 5.2 Tahap 1, Perencanaan

| ID | Berkas | Halaman | Konsep | Unsur emas | Subjek prompt |
|---|---|---|---|---|---|
| M01 | `details.svg` | Rincian dan lingkup | Lembar dokumen dengan bingkai bidik di sudut: lingkup yang ditetapkan | Bingkai bidik | `a document sheet with three text lines and a small target reticle at the lower right` |
| M02 | `units.svg` | Unit | Penanda lokasi berisi gedung kecil: kantor, lokasi, proyek | Titik penanda | `a map location pin with a tiny building inside` |
| M03 | `strata.svg` | Strata | Tiga lapisan piramida datar: jenjang jabatan | Lapisan puncak | `three stacked horizontal layers forming a flat pyramid` |
| M04 | `parameters.svg` | Parameter penilaian | Tiga penggeser mendatar: bobot dan ambang | Kenop tengah | `three horizontal slider tracks with round knobs at different positions` |
| M05 | `sampling.svg` | Kalkulator sampel | Lingkaran berisi enam titik, tiga terisi: sampel dari populasi | Tiga titik terisi | `a circle containing six dots, three filled and three empty` |
| M06 | `team.svg` | Tim asesor | Dua figur setengah badan dengan lencana centang kecil | Lencana centang | `two person bust silhouettes with a small check badge` |
| M07 | `kickoff.svg` | Komunikasi awal | Pengeras suara tangan dengan tiga garis suara: pesan pimpinan kepada pekerja | Garis suara | `a megaphone with three short sound lines` |

### 5.3 Tahap 2, Pengumpulan data

| ID | Berkas | Halaman | Konsep | Unsur emas | Subjek prompt |
|---|---|---|---|---|---|
| M08 | `respondents.svg` | Responden dan undangan | Tiga figur pekerja berhelm sederhana | Helm figur tengah | `three worker silhouettes wearing simple hard hats` |
| M09 | `qr.svg` | Kode QR | Kode QR sederhana dengan tiga persegi sudut | Satu persegi sudut | `a simplified QR code with three corner squares and a few small squares` |
| M10 | `participation.svg` | Partisipasi | Garis tren naik dengan figur kecil di puncak | Titik puncak | `a rising line chart with three points and a tiny person at the highest point` |
| M11 | `self-assessments.svg` | Penilaian mandiri | Figur berdasi dengan tanda centang | Tanda centang | `a person bust silhouette wearing a necktie with a check mark beside the shoulder` |
| M12 | `evidence.svg` | Bukti dokumen | Map terbuka dengan selembar dokumen | Penjepit kertas | `an open folder with a document sheet and a paperclip` |
| M13 | `observations.svg` | Observasi lapangan | Kamera dengan penanda lokasi kecil; bukan kamera pengawas | Penanda lokasi | `a camera with a small map location pin at the top right` |

### 5.4 Tahap 3, Validasi dan triangulasi

| ID | Berkas | Halaman | Konsep | Unsur emas | Subjek prompt |
|---|---|---|---|---|---|
| M14 | `data-quality.svg` | Mutu data | Alat ukur setengah lingkaran dengan jarum: mutu yang terukur | Jarum | `a semicircular gauge with a needle pointing to the upper right` |
| M15 | `findings.svg` | Temuan awal | Kaca pembesar di atas tiga batang: melihat data sebelum menilai | Lensa | `a magnifying glass over three small bars of different heights` |
| M16 | `validation.svg` | Wawancara dan diskusi kelompok | Dua gelembung percakapan bertumpuk | Tiga titik di gelembung depan | `two overlapping speech bubbles, the front one containing three dots` |

### 5.5 Tahap 4, Penilaian dan penetapan

| ID | Berkas | Halaman | Konsep | Unsur emas | Subjek prompt |
|---|---|---|---|---|---|
| M17 | `scoring.svg` | Penilaian asesor | Daftar periksa dengan bintang setengah terisi: nilai kelipatan 0,5 | Bintang | `a checklist with two check marks and a half filled star at the bottom` |
| M18 | `panel.svg` | Rapat panel | Meja bundar tampak atas dengan tiga kursi; bukan palu hakim | Titik tengah meja | `a round table seen from above with three chairs around it` |

### 5.6 Tahap 5, Pelaporan dan rencana aksi

| ID | Berkas | Halaman | Konsep | Unsur emas | Subjek prompt |
|---|---|---|---|---|---|
| M19 | `dashboard.svg` | Dasbor hasil | Tiga batang grafik dalam bingkai membulat | Batang tertinggi | `a bar chart with three bars inside a rounded rectangle frame` |
| M20 | `gaps.svg` | Kesenjangan dan rencana aksi | Dua batang berbeda tinggi dengan panah penghubung: jarak yang ditutup | Panah | `two bars of different heights with a small arrow bridging the gap between them` |
| M21 | `report.svg` | Laporan | Dokumen dengan grafik kecil dan garis tanda tangan | Garis tanda tangan | `a document sheet with a small bar chart and a signature line at the bottom` |
| M22 | `communication.svg` | Komunikasi hasil | Lembar hasil dengan panah menuju tiga figur kecil: hasil kembali ke pekerja | Panah | `a document sheet with an arrow pointing to three small person silhouettes` |

### 5.7 Tahap 6, Pemantauan dan perbaikan

| ID | Berkas | Halaman | Konsep | Unsur emas | Subjek prompt |
|---|---|---|---|---|---|
| M23 | `monitoring.svg` | Pemantauan rencana aksi | Kalender dengan tanda centang | Tanda centang | `a calendar page with a check mark` |
| M24 | `trend.svg` | Perbandingan antarperiode | Dua garis tren bertumpuk, yang baru lebih tinggi | Garis yang baru | `two line charts overlaid, the newer one higher than the older one` |

### 5.8 Lintas tahap dan menu akun

| ID | Berkas | Menu | Konsep | Unsur emas | Subjek prompt |
|---|---|---|---|---|---|
| M25 | `audit.svg` | Jejak audit | Jam dengan panah melingkar berlawanan arah jarum jam | Jarum jam | `a clock face with a counterclockwise circular arrow around it` |
| A01 | `assessments.svg` | Daftar asesmen | Papan klip dengan tiga baris daftar periksa | Penjepit papan | `a clipboard with three short checklist lines` |
| A02 | `new-assessment.svg` | Asesmen baru | Papan klip dengan tanda tambah | Tanda tambah | `a clipboard with a plus sign` |
| A03 | `organizations.svg` | Organisasi dan pengguna | Gedung kantor dengan satu figur di depannya | Figur | `an office building with three rows of windows and a small person in front` |
| A04 | `retention.svg` | Retensi data | Kotak arsip dengan jam pasir kecil; bukan tempat sampah | Jam pasir | `an archive storage box with a small hourglass` |
| A05 | `system-status.svg` | Status sistem | Garis denyut di dalam bingkai layar | Garis denyut | `a monitor frame with a heartbeat pulse line` |
| A06 | `account.svg` | Akun dan keamanan | Figur setengah badan dengan perisai bergembok kecil | Perisai | `a person bust silhouette with a small shield containing a padlock` |

## 6. Lencana tingkat kematangan

Lima lencana dengan komposisi yang sama dengan logo: lima busur pada lengkung 270 derajat, tanpa monogram. Angka tingkat dipasang sebagai teks di tengah.

| ID | Berkas | Tingkat | Busur terisi | Warna busur terisi | Busur kosong |
|---|---|---|---|---|---|
| B01 | `level-1.svg` | 1 Patologis | 1 | Perak tua `#8D9299` | Abu `#E4E4E7` |
| B02 | `level-2.svg` | 2 Reaktif | 2 | Perak tua ke perak | Abu `#E4E4E7` |
| B03 | `level-3.svg` | 3 Kalkulatif | 3 | Perak tua ke perak terang | Abu `#E4E4E7` |
| B04 | `level-4.svg` | 4 Proaktif | 4 | Perak tua ke arang `#26262B` | Abu `#E4E4E7` |
| B05 | `level-5.svg` | 5 Progresif | 5 | Empat busur arang, busur kelima emas | Tidak ada |

Emas hanya muncul pada tingkat 5. Dengan begitu, emas pada logo dan pada lencana bermakna sama: budaya yang matang.

## 7. Ilustrasi dan gambar

Akhiran gaya, ditempel di akhir setiap prompt bagian ini:

```
premium flat 2D vector illustration, monochrome palette of obsidian black #0B0B0C, charcoal #26262B, silver #C7CAD0, bright silver #E9EAEC and white, with a single restrained accent of gold #D4AF37, thin precise lines, clean geometric shapes, elegant editorial composition, generous negative space, no text, no letters, no numbers, no logos, no watermark
```

Prompt negatif:

```
text, letters, numbers, logo, watermark, bright colors, orange, neon, 3D render, photorealistic, glossy, harsh shadows, cluttered, cartoon, ladder, staircase, certificate seal, medal, ribbon
```

Aturan pekerja, ditempel pada prompt yang memuat orang:

```
Indonesian construction workers, men and women, some women wearing hijab under the hard hat, simplified faces without detailed features, every worker wears a white hard hat with chin strap fastened, a light silver high-visibility vest with pale gold reflective stripes, safety boots and work gloves, safe working posture, tidy site
```

| ID | Berkas | Letak | Ukuran | Latar | Konsep | Warna dominan dan aksen |
|---|---|---|---|---|---|---|
| V01 | `login-panel.webp` | Panel halaman masuk | 1200 x 1600 | Obsidian | Siluet kota dan proyek konstruksi dari garis perak tipis di bawah lingkar dial samar | Obsidian dan perak; satu garis cakrawala emas |
| V02 | `home-hero.webp` | Latar kepala beranda | 2400 x 800 | Obsidian | Lingkar ukur konsentris yang memudar, tanpa objek | Obsidian; kilau emas samar di satu sudut |
| V03 | `empty-start.png` | Beranda tanpa asesmen | 800 x 600 | Transparan | Meja kerja dengan papan klip kosong dan jangka | Perak dan arang; poros jangka emas |
| V04 | `survey-welcome.webp` | Layar pembuka survei | 720 x 480 | Abu kabut `#F5F5F6` | Pekerja duduk mengisi survei di telepon, dengan gelembung centang | Perak dan arang; centang emas |
| V05 | `survey-privacy.webp` | Layar persetujuan survei | 480 x 480 | Abu kabut | Perisai bergembok: jawaban tidak dapat dihubungkan dengan identitas | Arang dan perak; gembok emas |
| V06 | `survey-thanks.webp` | Layar terima kasih survei | 720 x 480 | Abu kabut | Pekerja berdiri dengan tanda centang besar | Perak dan arang; centang emas |
| V07 | `state-link-unavailable.png` | Tautan survei tidak berlaku | 800 x 600 | Transparan | Telepon dengan rantai tautan terputus | Arang dan perak; mata rantai emas |
| V08 | `state-forbidden.png` | Akses ditolak | 800 x 600 | Transparan | Pintu tertutup dengan perisai bergembok | Arang dan perak; gembok emas |
| V09 | `state-not-found.png` | Halaman tidak ditemukan | 800 x 600 | Transparan | Pekerja melihat denah dengan satu ruang kosong | Perak dan arang; tanda lokasi emas |
| V10 | `empty-respondents.png` | Daftar responden kosong | 800 x 600 | Transparan | Papan klip daftar nama kosong dan tiga pekerja | Perak dan arang; helm emas pucat |
| V11 | `empty-evidence.png` | Daftar bukti kosong | 800 x 600 | Transparan | Map terbuka dengan satu lembar dan kaca pembesar | Perak dan arang; lensa emas |
| V12 | `empty-observations.png` | Jendela observasi kosong | 800 x 600 | Transparan | Kamera dan penanda lokasi di depan perancah berpagar | Perak dan arang; penanda emas |
| V13 | `empty-validation.png` | Belum ada sesi validasi | 800 x 600 | Transparan | Meja bundar dengan kursi kosong dan dua gelembung percakapan | Perak dan arang; gelembung emas |
| V14 | `empty-action-plan.png` | Daftar kesenjangan kosong | 800 x 600 | Transparan | Papan rencana tiga kolom dengan satu kartu | Perak dan arang; kartu emas |
| V15 | `empty-report.png` | Belum ada laporan | 800 x 600 | Transparan | Lembar laporan dengan grafik dan pena | Perak dan arang; pena emas |
| V16 | `report-cover.jpg` | Pita sampul laporan PDF | 2480 x 1100 | Obsidian | Lingkar dial besar terpotong di kanan, garis kota di bawah | Obsidian dan perak; busur emas |
| V17 | `email-header.png` | Kepala surel | 1200 x 300 | Obsidian | Pita gelap dengan lengkung dial di kanan | Obsidian dan perak; garis emas tipis |
| V18 | `og-image.png` | Pratinjau tautan | 1200 x 630 | Obsidian | Simbol logo besar di kanan, bidang kiri kosong untuk judul | Obsidian dan perak; busur emas |
| V19 | `pattern-dial.svg` | Pola latar bidang gelap | Vektor, dapat disambung | Obsidian | Lingkar konsentris dan garis skala samar | Putih 4 persen; tanpa emas |
| V20 | `stage-01.webp` sampai `stage-06.webp` | Kepala setiap tahap di pusat asesmen (6 berkas) | 1200 x 480 | Obsidian | Benda kerja tiap tahap sebagai garis perak: jangka, lapisan data, tiga titik, timbangan, lembar laporan, panah siklus | Obsidian dan perak; satu unsur emas, sama dengan ikon tahap |
| V21 | `certificate-free-note.svg` | Catatan "bukan sertifikat" di laporan | Vektor | Putih | Bingkai garis tipis polos tanpa segel | Arang; tanpa emas |
| V22 | `print-watermark-draft.svg` | Tanda air draf laporan | Vektor | Transparan | Garis diagonal halus | Emas tua 8 persen |

Halaman survei dibuka pekerja dengan sinyal lemah. Karena itu V04 sampai V06 dibatasi 25 KB per berkas dan V05 dibatasi 15 KB.

## 8. Penyerahan dan pemasangan

1. Simpan setiap berkas dengan nama persis seperti tabel.
2. Catat prompt, nama generator, dan tanggal pembuatan sebagai bukti asal-usul. Pastikan paket generator mengizinkan penggunaan komersial.
3. Kirim berkas melalui percakapan kerja atau folder bersama. Sebelum dipasang, berkas diperiksa: keamanan SVG, daftar periksa K3 bagian 1.3, kesesuaian palet, dan ukuran berkas.
4. Ikon dipasang di `resources/js/components/icons/`, ilustrasi di `public/illustrations/`, dan berkas merek di `public/brand/`.
5. Ilustrasi diperlakukan sebagai hiasan: teks alternatif kosong, dan seluruh informasi tetap ada di teks halaman.

## Rujukan

Kementerian Ketenagakerjaan Republik Indonesia. (2016). *Peraturan Menteri Ketenagakerjaan Nomor 9 Tahun 2016 tentang Keselamatan dan Kesehatan Kerja dalam Pekerjaan pada Ketinggian*.

Kementerian Pekerjaan Umum dan Perumahan Rakyat Republik Indonesia. (2021). *Peraturan Menteri Pekerjaan Umum dan Perumahan Rakyat Nomor 10 Tahun 2021 tentang Pedoman Sistem Manajemen Keselamatan Konstruksi*.

Kementerian Tenaga Kerja dan Transmigrasi Republik Indonesia. (2010). *Peraturan Menteri Tenaga Kerja dan Transmigrasi Nomor PER.08/MEN/VII/2010 tentang Alat Pelindung Diri*.

Republik Indonesia. (2016). *Undang-Undang Nomor 20 Tahun 2016 tentang Merek dan Indikasi Geografis*.
