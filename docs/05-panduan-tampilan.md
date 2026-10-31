# 05. Panduan Tampilan dan Bahasa

## 1. Identitas visual

Palet tenang dan tidak jenuh (diperbarui 31 Oktober 2026 atas permintaan pemilik produk). Tujuannya agar konsol nyaman dibaca lama dan angka hasil menjadi pusat perhatian. Warna merek yang jenuh hanya tampil pada logo. Nilai yang sama dipakai di `src/app/globals.css` dan `src/lib/theme.ts` (laporan PDF, surel, manifes aplikasi observasi), dan keselarasannya diperiksa `src/lib/__tests__/theme.test.ts` beserta kontras WCAG AA.

| Token | Nilai | Pemakaian |
|---|---|---|
| `--brand-navy` | `#2B4A6F` | Biru batu tua: tombol utama, tautan, penanda aktif |
| `--brand-navy-deep` | `#1E2F45` | Biru batu gelap: bidang kepala halaman tempat logo, judul |
| `--highlight` | `#C29B52` | Oker lembut: nilai di bawah sasaran pada grafik |
| `--series-2` | `#6E9A94` | Hijau toska redup: seri kedua grafik, karakteristik kontekstual |
| `--text` | `#1F2933` | Teks utama |
| `--text-muted` | `#5C6773` | Teks sekunder |
| `--surface` | `#FFFFFF` | Latar kartu |
| `--surface-alt` | `#F4F5F7` | Latar halaman |
| `--tint` | `#E8EDF2` | Latar sorotan lembut |
| `--border` | `#D9DEE4` | Garis tepi, lintasan bilah kemajuan |
| `--success` | `#2E7458` | Status baik |
| `--warning` | `#8A5A12` | Peringatan |
| `--danger` | `#A3433A` | Galat, kesenjangan besar, garis sasaran |

Peta warna hasil: hijau lembut `#DDEBE3` untuk 3,3 ke atas, krem `#F2EAD4` untuk 2,8 sampai 3,2, merah muda redup `#F2DEDA` untuk di bawah 2,8. Sel yang disembunyikan karena kurang dari 5 responden diberi arsir abu-abu (`#E7E9EC`) dengan keterangan.

Gradasi lima tingkat kematangan (1 ke 5): `#CBD3DC`, `#A9B8C8`, `#8399B1`, `#5A7797`, `#2B4A6F`. Batang grafik yang mencapai sasaran memakai tingkat 4 (`#5A7797`).

Huruf: Plus Jakarta Sans (next/font, dimuat lokal) untuk seluruh antarmuka. Angka besar memakai `font-variant-numeric: tabular-nums`.

Logo ada dua lapis (docs/11 bagian 5):

1. Logo aplikasi NSCAS: cincin ukur lima busur dengan titik merah, komponen `NscasMark` dan `NscasLockup` di `src/components/nscas-mark.tsx`. Tulisan "NSCAS" dan "oleh Nusa Safety" berupa teks HTML, bukan gambar. Dipakai di kepala konsol, halaman masuk, beranda, ikon tab peramban (`src/app/icon.svg`, `favicon.ico`, `apple-icon.png`), dan ikon aplikasi observasi (`public/brand/nscas-app-icon-192.png` dan `-512.png`). Bentuk tangga dan segel sengaja dihindari agar tidak dikira tanda sertifikasi.
2. Logo perusahaan Nusa Safety: `public/brand/logo-long-color.png`, tidak diubah. Tulisan "nusa" berwarna putih, sehingga logo selalu di atas biru batu gelap: kepala konsol (layar lebar), panel halaman masuk, pita sampul laporan, atau kotaknya sendiri di latar terang. Berkas asal tersedia di folder `aset-logo/`.

Ilustrasi ada di `public/illustrations/` dan selalu bersifat hiasan (alt kosong): seluruh informasi tetap ada di teks. Komponen: `Illustration`, `EmptyState`, dan `LevelBadge` di `src/components/illustration.tsx`; `TokenArt` di `src/components/token-art.tsx` untuk rute bertoken (dikirim apa adanya agar muatan survei tetap terukur); `StatePage` untuk halaman akses ditolak dan tidak ditemukan. Pola latar `bg-brand-pattern` (V26) dipakai di kepala konsol.

## 2. Pola komponen

- Kartu dengan sudut 12 piksel, garis tepi tipis, tanpa bayangan tebal.
- Ikon di dalam lingkaran berwarna sebagai penanda bagian, sama seperti paparan.
- Kartu indeks: angka besar dua desimal, nama tingkat di bawahnya, status kemantapan sebagai lencana.
- Tabel padat untuk konsol asesor; kartu bertumpuk untuk tampilan telepon genggam.
- Setiap halaman konsol menampilkan nama organisasi, nama asesmen, status asesmen, dan tahap ("Tahap 2 dari 4: Pengumpulan data") di bagian atas.
- Navigasi asesmen dikelompokkan per tahap alur kerja (`src/lib/assessments/workflow.ts`): 1. Persiapan, 2. Pengumpulan data, 3. Penilaian, 4. Hasil dan tindak lanjut, lalu Lainnya. Di layar lebar tampil sebagai kolom samping. Di telepon tampil sebagai menu lipat yang menyebut halaman saat ini. Tahap yang selesai diberi tanda centang, tahap berjalan diberi titik biru.
- Halaman Ringkasan asesmen memuat penanda kemajuan empat tahap, panduan singkat untuk status saat ini, dan daftar syarat menuju status berikutnya. Setiap syarat yang belum terpenuhi menautkan ke halaman tempat syarat itu dikerjakan.
- Daftar asesmen yang masih kosong menampilkan panduan "Mulai pengukuran" tiga langkah sesuai peran pengguna: organisasi klien, asesor utama, lalu asesmen.
- Pilihan yang memberi hak tinggi, misalnya peran pengguna, tidak boleh terisi otomatis. Pengguna wajib memilih sendiri.
- Simbol memakai set khusus NSCAS (41 simbol, docs/11 bagian 6). Sumbernya `public/icons/nav/*.svg` di kisi 24 x 24, garis 2, warna `currentColor`. Perintah `npm run icons` mengubahnya menjadi komponen di `src/components/icons/nscas-icons.tsx`. Pengubah hanya menerima elemen gambar dasar dan warna `currentColor`, dan tes memastikan komponen selalu sama dengan berkas SVG. Impor `lucide-react` dilarang oleh ESLint agar gaya tetap seragam. Di menu, ketebalan garis 1,75 dan ukuran 16 piksel; di ubin 20 piksel. Simbol selalu didampingi nama halaman, kecuali di kepala halaman pada layar menengah (nama tetap dibacakan pembaca layar dan tampil saat disorot). Pemetaan simbol ada di `src/components/assessment/nav-icons.ts`:

| Halaman | Simbol | Halaman | Simbol |
|---|---|---|---|
| Ringkasan | `NavOverview` | Bukti | `NavEvidence` |
| Rincian | `NavDetails` | Observasi | `NavObservations` |
| Unit | `NavUnits` | Validasi | `NavValidation` |
| Strata | `NavStrata` | Penilaian asesor | `NavScoring` |
| Parameter | `NavParameters` | Rapat panel | `NavPanel` |
| Kalkulator sampel | `NavSampling` | Dasbor | `NavDashboard` |
| Tim asesor | `NavTeam` | Rencana aksi | `NavActionPlan` |
| Responden | `NavRespondents` | Laporan | `NavReport` |
| Kode QR | `NavQr` | Jejak audit | `NavAudit` |
| Partisipasi | `NavParticipation` | | |
| Penilaian mandiri | `NavSelfAssessments` | | |

  Tahap: Persiapan `NavPhasePreparation`, Pengumpulan data `NavPhaseDataCollection`, Penilaian `NavPhaseScoring`, Hasil dan tindak lanjut `NavPhaseResults`. Menu utama: Asesmen `NavAssessments`, Organisasi dan pengguna `NavOrganizations`, Retensi data `NavRetention`, Akun saya `NavAccount`, Keluar `NavLogout`, Menu `NavMenu`. Simbol bantu berawalan `Ui` (centang, lingkaran, panah, tambah, masuk, status sistem).
- Di kolom samping, hanya tahap yang sedang berjalan dan tahap yang memuat halaman terbuka yang terbuka. Tahap lain dilipat menjadi satu baris bersimbol yang dapat dibuka dengan satu klik.
- Ringkasan asesmen memuat ubin "Akses cepat" bersimbol untuk halaman tahap yang sedang berjalan, masing-masing dengan keterangan satu baris.
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
