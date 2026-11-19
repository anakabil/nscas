# 05. Panduan Tampilan dan Bahasa (Versi 2)

Tema versi 1 (biru batu) diarsipkan di `docs/arsip-v1/05-panduan-tampilan-v1.md`.

## 1. Tema Marun dan Emas

Tema diturunkan dari logo NSCAS milik Nusa Safety (19 November 2026): marun, hitam, emas, dan krem. Tema sebelumnya, Monokrom Perak dan Emas, tidak dipakai lagi. Kesan mewah datang dari proporsi, ruang kosong, dan huruf, bukan dari efek.

### 1.1 Warna

Token ada di `resources/css/app.css` dan dipakai lewat kelas Tailwind (`bg-maroon`, `text-gold-deep`, dan seterusnya). Kontrasnya dijaga tes `ThemeContrastTest`.

| Token | Kode | Pemakaian |
|---|---|---|
| `maroon` | `#691B2E` | Warna merek dari logo: tombol utama, kotak ikon, garis navigasi aktif |
| `maroon-deep`, `maroon-ink` | `#4A1220`, `#2C0A13` | Gradasi bidang identitas (beranda, kepala asesmen, panel masuk, halaman galat) |
| `maroon-soft` | `#F4E7E7` | Latar lembut bernada marun |
| `ink` | `#1A1A1A` | Hitam logo: judul dan teks utama |
| `charcoal` | `#3B3431` | Teks sekunder yang tegas |
| `cream` | `#FEFAF4` | Krem latar logo: teks di bidang marun |
| `parchment` | `#F4ECDF` | Teks dan ikon di bidang marun |
| `taupe`, `taupe-dim` | `#CDBFAD`, `#8C8073` | Garis, bingkai, angka hiasan, ikon pendukung |
| `background`, `card` | `#F7F2EA`, `#FFFDF9` | Latar halaman dan kartu |
| `muted-foreground` | `#5F564E` | Teks pendukung (kontras 7,1 banding 1 di kartu) |
| `gold` | `#CBA35A` | Emas logo: aksen di bidang marun, tahap yang sedang berjalan |
| `gold-soft` | `#E5CD98` | Teks kecil emas di bidang marun |
| `gold-deep` | `#86652A` | Satu-satunya emas untuk teks di bidang terang |
| `success` | `#2F6B4F` | Tahap selesai, pemeriksaan berhasil |
| `destructive` | `#B42318` | Galat; sengaja lebih terang dan lebih jingga daripada marun agar tidak tertukar dengan warna merek |

Aturan warna:

1. Marun adalah warna merek, emas adalah aksen. Dalam satu layar, emas menandai paling banyak satu hal utama: tahap yang sedang berjalan.
2. Emas `#CBA35A` tidak dipakai untuk teks di bidang terang. Pakai `gold-deep`.
3. Bidang marun dipakai untuk bingkai identitas. Kepala halaman berwarna kartu terang agar logo tampil dengan warna aslinya. Bidang kerja tetap terang agar nyaman dibaca lama dan terbaca di lokasi proyek.
4. Merah galat tidak boleh diganti marun, dan marun tidak boleh dipakai untuk pesan galat.
5. Tidak ada mode gelap terpisah.
6. Gradasi lima tingkat kematangan memakai krem ke marun (`level-1` sampai `level-5`); emas hanya untuk sasaran yang tercapai.

### 1.2 Huruf

| Huruf | Pemakaian |
|---|---|
| Bodoni Moda (kelas `font-display`) | Judul halaman, judul bagian, tulisan merek NSCAS, angka hiasan. Ketebalan bawaan 500; kata yang ditekankan memakai miring (`em`), bukan tebal |
| Instrument Sans | Semua teks lain, termasuk tabel dan formulir |

Dasar pemilihan. Rekomendasi palet tipografi Adobe untuk kesan mewah, anggun, dan klasik menempatkan huruf didone (Didot) di urutan teratas. Didot berlisensi komersial dan tidak dapat dipasang lokal tanpa lisensi, sehingga dipakai Bodoni Moda, huruf didone berlisensi terbuka (OFL 1.1) dengan sumbu ukuran optik. Teks kerja memakai Instrument Sans, grotesk tenang yang tidak bersaing dengan judul. Pasangan ini diuji berdampingan dengan empat pasangan lain (termasuk Playfair Display dan Plus Jakarta Sans versi sebelumnya) pada contoh kepala halaman, kartu, dan tabel angka.

Aturan huruf:

1. Ukuran optik Bodoni dikunci pada 18 untuk layar biasa dan 30 untuk layar beresolusi tinggi. Ukuran optik otomatis membuat garis rambut terlalu tipis dan tampak putus pada layar 1x.
2. Bodoni hanya untuk ukuran 20 piksel ke atas. Di bawah itu pakai Instrument Sans.
3. Angka data memakai kelas `numeral` (angka tabular dan setinggi huruf besar) agar kolom rata.
4. Judul memakai pemenggalan baris seimbang; paragraf memakai pemenggalan yang menghindari satu kata di baris terakhir.
5. Berkas huruf: Instrument Sans sekitar 30 KB dan Bodoni Moda sekitar 46 KB per gaya untuk huruf Latin. Halaman survei responden hanya memuat Instrument Sans.

Keduanya dipasang lokal dari paket npm. Halaman tidak pernah memanggil layanan huruf pihak ketiga.

Label kecil berhuruf besar dengan jarak lebar memakai kelas `eyebrow`, didahului garis emas pendek pada judul bagian.

### 1.3 Unsur khas

| Kelas | Tampilan | Pemakaian |
|---|---|---|
| `bg-maroon-dial` | Bidang marun bergradasi dengan kilau emas di satu sudut dan garis anak tangga yang sangat samar, digambar dengan gradien CSS | Kepala beranda, kepala asesmen, panel masuk, halaman galat |
| `frame-hairline` | Kartu dengan garis tepi gradasi taupe hangat | Kartu tahap, kartu isi |
| `frame-gold` | Kartu dengan garis tepi gradasi emas | Hanya kartu tahap yang sedang berjalan |
| `hairline-taupe`, `hairline-gold` | Garis tipis yang memudar di kedua ujung | Pemisah |
| `text-gold-metal` | Teks bergradasi emas | Hanya di bidang marun, untuk momen merek |
| `frame-maroon` | Bingkai ganda tipis di bidang marun: garis luar krem samar, garis dalam emas sangat halus | Panel asesmen yang ditampilkan di beranda |
| `rule-ornament` | Garis rambut taupe dengan belah ketupat emas di tengah | Satu kali per bagian besar, misalnya panel halaman masuk |

Sudut kartu dan tombol sengaja kecil (`--radius` 0,375 rem) untuk kesan presisi dan resmi. Ikon tahap pada kartu ditempatkan di dalam lingkaran bergaris taupe; tahap yang berjalan memakai lingkaran marun dengan cincin emas.

### 1.4 Logo dan ikon

Logo NSCAS (perisai dan lima anak tangga emas) dipasang lewat komponen `resources/js/components/brand/nscas-mark.tsx` dari berkas `public/brand`. Makna, aturan pakai, dan daftar berkasnya ada di `docs/11` bagian 3.

Ikon enam tahap memakai set khusus di `components/icons/stage-icons.tsx`: garis mengikuti warna teks, satu unsur emas. Ikon 25 halaman kerja dan 6 menu akun memakai set khusus dengan gaya yang sama di `components/icons/module-icons.tsx`, mengikuti konsep `docs/11` bagian 5. Ikon garis Lucide hanya dipakai untuk penunjuk kecil antarmuka (panah, centang, menu). Semua ikon bersifat hiasan dan selalu didampingi nama.

## 2. Pola halaman

1. Beranda menampilkan dua sudut pandang menu: menurut tahap asesmen (enam kartu) dan menurut jenis akun (ubin tugas utama), ditambah menu akun. Keenam tahap selalu tampil agar pengguna melihat seluruh metode; halaman di dalamnya hanya yang boleh dibuka jenis akun tersebut.
2. Setiap kartu tahap memuat nomor, ikon, keadaan (Selesai, Sedang berjalan, Berikutnya), ringkasan satu kalimat, dan daftar halamannya.
3. Kepala asesmen selalu memuat organisasi, nama asesmen, periode, status, tahap ("Tahap 2 dari 6"), dan penanda enam ruas.
4. Pusat asesmen menampilkan syarat menuju status berikutnya.
5. Halaman yang belum dibangun ulang diberi tanda fase dan tetap dapat dibuka, dengan penjelasan isi modulnya.
6. Pilihan yang memberi hak tinggi, misalnya peran pengguna, tidak boleh terisi otomatis.
7. Hasil yang belum final diberi pita "Draf, belum ditetapkan rapat panel". Halaman hasil dan laporan wajib memuat pernyataan bahwa hasil bukan sertifikat.
8. Sel dengan kurang dari 5 responden ditampilkan sebagai arsiran abu, bukan angka.

## 3. Halaman survei responden

1. Dirancang untuk telepon lebih dulu, lebar 360 piksel.
2. Ringan: tidak memuat kode konsol, ilustrasi kecil, dan muatan di bawah 350 KB.
3. Bidang terang, huruf besar, tombol setinggi paling sedikit 48 piksel.
4. Emas tidak dipakai sebagai warna tombol; tombol utama hitam dengan teks putih.

## 4. Aturan bahasa antarmuka

1. Bahasa Indonesia baku dan formal sebagai sumber; bahasa Inggris sebagai pilihan kedua dengan kunci yang sama.
2. Tidak memakai singkatan kecuali K3 (dijelaskan saat pertama muncul) dan nama produk. Tulis "alat pelindung diri", "diskusi kelompok terarah", "verifikasi dua langkah", "surel".
3. Tidak memakai tanda pisah panjang dan tanda seru.
4. Menyapa pengguna dengan "Anda".
5. Istilah harus dipahami pekerja lapangan. Hindari istilah teknis sistem.
6. Nama jenis akun: Pengelola sistem, Asesor utama, Asesor, Administrator klien, Koordinator unit, Pemirsa eksekutif.
7. Angka memakai format Indonesia: koma desimal dan titik ribuan.

## 5. Aksesibilitas

1. Kontras teks paling sedikit 4,5 banding 1; unsur antarmuka paling sedikit 3 banding 1.
2. Fokus papan tik selalu terlihat (cincin emas tua).
3. Ada tautan "Langsung ke isi halaman".
4. Menu lipat memakai elemen `details` sehingga berfungsi tanpa skrip.
5. Ilustrasi dan ikon hiasan disembunyikan dari pembaca layar; informasi selalu ada di teks.
