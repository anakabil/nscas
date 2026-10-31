# 10. Audit Antarmuka dan Alur Kerja (31 Oktober 2026)

Audit ini dilakukan atas permintaan pemilik produk. Ada tiga permintaan: tampilan memakai warna yang tidak mencolok dengan tema tenang, alur kerja tidak membingungkan, dan sistem siap dipakai untuk pengukuran tanpa akun dan data demo. Pemeriksaan dilakukan dengan menangkap layar 30 halaman konsol pada lebar desktop (1.440 piksel) dan telepon (390 piksel), memakai data contoh lokal. Sebelum dan sesudah perbaikan, halaman survei responden dan alur pertama kali pada sistem kosong juga ditelusuri.

## 1. Temuan

| No. | Temuan | Dampak |
|---|---|---|
| T1 | Warna utama biru royal jenuh `#000B9D`, batang grafik kuning terang `#FDC830`, dan ungu `#5B4BD6` | Tampilan terasa mencolok dan melelahkan untuk pemakaian lama; perhatian tertarik ke warna, bukan ke angka |
| T2 | Navigasi asesmen berisi sampai 20 tab dalam satu baris yang digulir mendatar. Di desktop tab terpotong, di telepon hanya 4 tab yang terlihat | Pengguna tidak tahu halaman mana yang relevan pada tahap saat ini |
| T3 | Tidak ada penanda tahap. Status asesmen (11 nilai) hanya tampil sebagai lencana | Pengguna sulit memahami posisi asesmen dalam proses dan apa yang harus dikerjakan |
| T4 | "Langkah berikutnya" hanya menampilkan daftar syarat, tanpa tautan ke halaman tempat syarat dipenuhi | Pengguna harus menebak halaman yang perlu dibuka |
| T5 | Sistem kosong hanya menampilkan "Belum ada asesmen yang dapat Anda akses." Administrator tidak bisa membuat asesmen tanpa peran Asesor utama, dan hal ini tidak dijelaskan | Pengguna pertama tidak tahu cara memulai pengukuran |
| T6 | Kepala halaman di telepon memakan sekitar separuh layar pertama (tautan berbaris dua dan tombol Keluar terpisah) | Isi halaman tertutup |
| T7 | Logo ditempatkan di kotak biru jenuh di atas latar terang | Kesan tambal sulam |
| T8 | Lintasan bilah kemajuan survei berwarna sama dengan latar halaman | Responden tidak melihat sisa pertanyaan |
| T9 | Pilihan peran pada formulir tambah pengguna terisi otomatis "Administrator sistem" | Risiko memberi hak penuh tanpa sengaja |
| T10 | Seed selalu membuat organisasi demo kosong, dan penyiapan Codespaces memuat lima akun serta satu asesmen demo | Data demo bercampur dengan pengukuran sungguhan |
| T11 | Setelah mengunggah versi baru bukti, pesan "Bukti tersimpan" langsung hilang karena kartu bukti dipasang ulang saat halaman disegarkan | Pengguna tidak mendapat konfirmasi dan mungkin mengunggah ulang |

## 2. Perbaikan

| Temuan | Perbaikan | Berkas utama |
|---|---|---|
| T1, T7 | Palet tenang: biru batu tua `#2B4A6F`, biru batu gelap `#1E2F45` untuk bidang kepala halaman, oker lembut `#C29B52` dan hijau toska redup `#6E9A94` untuk grafik, latar abu-abu hangat `#F4F5F7`. Satu sumber nilai untuk CSS, laporan PDF, surel, dan manifes, dengan tes keselarasan dan kontras WCAG AA. Logo langsung di bidang kepala halaman yang gelap. | `src/app/globals.css`, `src/lib/theme.ts`, `src/lib/__tests__/theme.test.ts`, `src/lib/report/html.ts`, `src/lib/jobs/*`, `src/components/brand-logo.tsx` |
| T2 | Navigasi dikelompokkan menjadi empat tahap (Persiapan, Pengumpulan data, Penilaian, Hasil dan tindak lanjut) ditambah Lainnya, sebagai kolom samping di desktop dan menu lipat di telepon. Tahap selesai bertanda centang, tahap berjalan bertanda titik. | `src/lib/assessments/workflow.ts`, `src/components/assessment/assessment-nav.tsx`, `src/app/(console)/assessments/[id]/layout.tsx` |
| T3 | Baris "Tahap n dari 4" di setiap halaman asesmen dan kolom Tahap di daftar asesmen. Penanda kemajuan empat tahap di Ringkasan, beserta panduan singkat untuk setiap status yang menyebut nama tombol yang harus diklik. | `src/components/assessment/phase-stepper.tsx`, `src/app/(console)/assessments/[id]/page.tsx`, `src/app/(console)/assessments/page.tsx` |
| T4 | Setiap syarat yang belum terpenuhi menautkan ke halamannya, misalnya "Buka Unit" atau "Buka Laporan". | `src/components/assessment/transition-panel.tsx` |
| T5 | Panduan "Mulai pengukuran" tiga langkah dengan tanda selesai dan tombol sesuai peran. Peran Asesor utama untuk akun administrator sendiri langsung berlaku tanpa masuk ulang. | `src/app/(console)/assessments/page.tsx` |
| T6 | Kepala halaman ringkas: menu lipat "Menu" di telepon, tautan aktif ditandai. | `src/components/console/site-header.tsx`, `src/components/console/console-nav.tsx` |
| T8 | Lintasan bilah kemajuan memakai warna garis tepi. | `src/app/s/[token]/survey-app.tsx` |
| T9 | Pilihan peran wajib dipilih sendiri ("Pilih peran"). | `src/app/(console)/orgs/forms.tsx` |
| T10 | Organisasi demo hanya dibuat bila `SEED_DEMO_ORGANIZATION=true`. Penyiapan Codespaces tidak lagi memuat akun dan data demo. | `prisma/seeding.ts`, `prisma/seed.ts`, `.devcontainer/setup.sh` |
| T11 | Kartu bukti memakai kunci versi pertama, sehingga tetap terpasang antarversi dan pesannya tetap terlihat. | `src/app/(console)/assessments/[id]/evidence/page.tsx` |

Halaman masuk dirombak menjadi dua panel: identitas sistem di panel biru batu gelap, formulir di sisi kanan. Di telepon, panel identitas disembunyikan.

## 3. Pemeriksaan

1. Tes unit: 532 tes lulus, termasuk tes palet (17 token, gradasi tingkat, kontras teks) dan tes tahap alur kerja. Tes integrasi: 156 tes lulus. Pemeriksaan tipe dan lint bersih.
2. Tes e2e: 61 tes lulus, untuk desktop dan telepon. Tes unggah versi baru bukti (T11) sudah gagal sebelum audit ini dan lulus setelah perbaikan. Di lingkungan pengembangan, tes e2e dan tes PDF perlu `PLAYWRIGHT_CHROMIUM_EXECUTABLE` dan `PDF_CHROMIUM_EXECUTABLE`, karena versi Chromium terpasang berbeda dari versi bawaan Playwright.
3. Alur pertama kali pada basis data kosong ditelusuri otomatis dengan peramban: masuk administrator, aktivasi verifikasi dua langkah, panduan tiga langkah, tambah organisasi klien, tambah peran Asesor utama ke akun sendiri, tombol Buat asesmen muncul tanpa masuk ulang, asesmen dibuat, Ringkasan menampilkan "Tahap 1 dari 4", dan tautan syarat membuka halaman Unit. Seluruh tujuh pemeriksaan lulus.
4. Tangkapan layar sesudah perbaikan diperiksa untuk desktop dan telepon, termasuk dasbor, Ringkasan, daftar asesmen, halaman masuk, dan layar survei.

## 4. Belum dikerjakan

1. Tabel peta warna per unit dengan banyak kolom tetap digulir mendatar di dalam kartunya. Ini wajar untuk 52 unit, tetapi tampilan ringkas per lokasi dapat dipertimbangkan kemudian.
2. Halaman-halaman formulir panjang (parameter, kalkulator sampel, rapat panel) belum ditata ulang strukturnya. Halaman itu hanya mengikuti palet baru.
