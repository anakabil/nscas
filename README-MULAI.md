# Panduan Memulai Pembangunan NSCAS dengan Claude Code

Paket ini berisi seluruh bahan agar Claude Code dapat membangun NSCAS sesuai konsep yang ditawarkan kepada PT Adhi Karya: spesifikasi, rumus penilaian beserta nilai uji, data instrumen, dan urutan prompt per fase.

## Isi paket

| Berkas | Fungsi | Dibaca oleh |
|---|---|---|
| `CLAUDE.md` | Aturan proyek yang dibaca otomatis setiap kali Claude Code dibuka di folder ini | Claude Code |
| `PROMPTS.md` | Tujuh belas prompt berurutan, Fase 0 sampai Fase 16 | Daddy, disalin ke Claude Code |
| `docs/01` sampai `docs/05` | Kebutuhan produk, arsitektur dan data, aturan penilaian, privasi dan keamanan, panduan tampilan | Claude Code |
| `seed/instrumen-karakteristik-v1.json` | 18 karakteristik dengan 90 pernyataan berjenjang, diambil dari kertas kerja Excel | Claude Code |
| `seed/aspek-dan-parameter.json` | Bobot, ambang, strata bawaan | Claude Code |
| `seed/skala-iklim-draf.json` | Draf 21 butir skala iklim, tujuh dimensi | Daddy menelaah, Claude Code memuat |
| `seed/fixtures/` | Nilai uji mesin penilaian dan implementasi rujukan Python | Claude Code |
| `aset-logo/` | Tiga berkas logo Nusa Safety | Claude Code, Fase 0 |

## Persiapan di laptop

1. Pasang Node.js 22 LTS, Git, dan Docker Desktop.
2. Pastikan Claude Code sudah terpasang dan Daddy sudah masuk dengan akun Daddy.
3. Buat folder proyek, misalnya `Documents/nscas`, lalu ekstrak isi paket ini ke dalamnya sehingga `CLAUDE.md` berada di akar folder.
4. Logo Nusa Safety sudah disertakan di folder `aset-logo/`. Claude Code akan memindahkannya ke `public/brand/` pada Fase 0.
5. Buka terminal di folder tersebut dan jalankan `claude`.

## Cara menjalankan setiap fase

1. Aktifkan mode rencana (Shift+Tab sampai muncul mode Plan) agar Claude Code menyampaikan rencana sebelum menulis kode.
2. Salin satu blok prompt dari `PROMPTS.md`, tempel, lalu tekan Enter.
3. Baca rencananya. Bila sesuai, setujui agar Claude Code mulai mengerjakan.
4. Setelah selesai, jalankan pemeriksaan pada bagian "Cara memeriksa" di bawah prompt tersebut.
5. Bila sudah sesuai, minta Claude Code membuat komit, misalnya: `buat komit untuk fase 1`.
6. Jalankan `/clear` sebelum fase berikutnya. Isi `CLAUDE.md` tetap terbaca di sesi baru, sehingga konteks utama tidak hilang.

Satu fase dapat memerlukan lebih dari satu sesi. Bila sesi menjadi panjang, lanjutkan dengan meminta Claude Code meringkas pekerjaan yang belum selesai, lalu `/clear` dan tempel ringkasan itu.

## Titik pemeriksaan penting

| Setelah fase | Yang harus terbukti |
|---|---|
| 1 | Mesin penilaian menghasilkan indeks 3,143463 dan tingkat 3 dari data simulasi, sama dengan kertas kerja Excel |
| 4 | Kalkulator sampel menghasilkan 33, 66, 353, 341, dan sasaran 901 untuk 3.000 pekerja |
| 6 | Survei dapat diisi di telepon genggam, bertahan saat sinyal putus, dan jawaban tidak dapat dihubungkan ke responden |
| 10 | Rapat panel menampilkan matriks triangulasi dan dapat mengunci hasil |
| 13 | Laporan PDF memuat pernyataan bahwa hasil bukan sertifikat Safety Culture Ladder |

Bila Fase 1 tidak lulus fixture, jangan lanjut. Seluruh hasil asesmen bergantung pada mesin ini.

## Keputusan yang perlu Daddy tetapkan

1. **Lokasi server.** Proposal menjanjikan data disimpan di pusat data Indonesia. VPS Hostinger yang dipakai situs Nusa Safety hanya tersedia di Vilnius, Manchester, Mumbai, Kuala Lumpur, Campinas, Boston, dan Düsseldorf, tanpa lokasi Indonesia. Untuk NSCAS perlu penyedia lain, misalnya Biznet Gio, IDCloudHost, AWS Jakarta, atau Google Cloud Jakarta. Pengembangan di laptop tetap dapat dimulai tanpa menunggu keputusan ini; server baru diperlukan pada Fase 16.
2. **Bobot penilaian mandiri dalam lapisan persepsi.** Proposal menyebut lapisan persepsi berasal dari survei dan penilaian mandiri, tetapi belum menetapkan porsinya. Paket ini memakai 70 persen survei dan 30 persen penilaian mandiri. Nilai ini dapat diubah per asesmen sebelum dikunci.
3. **Jumlah butir skala iklim.** Proposal dan paparan menyebut 90 sampai 120 butir. Instrumen saat ini berisi 18 butir berjenjang ditambah 21 butir draf skala iklim, sehingga totalnya 39. Untuk memenuhi komitmen, setiap dimensi perlu dikembangkan menjadi sekitar 10 butir, atau angka di proposal disesuaikan. Seluruh butir draf juga perlu Daddy telaah sebelum uji coba.
4. **Subdomain.** Usulan `nscas.nusasafety.co.id`; rekaman DNS di Hostinger diarahkan ke server baru.
5. **Kanal pengingat.** Versi pertama memakai surel dan kode QR. Pengingat WhatsApp disiapkan antarmukanya untuk tahap berikutnya.

## Hal yang sengaja dijaga oleh paket ini

- Mesin penilaian dipisah sebagai kode murni dan diuji dengan nilai dari kertas kerja Excel, sehingga angka di aplikasi, proposal, dan paparan selalu konsisten.
- Jawaban survei dirancang agar tidak dapat dihubungkan ke responden, termasuk oleh Nusa Safety sendiri. Ini yang membuat pekerja berani menjawab jujur, dan menjadi dasar klaim anonimitas di proposal.
- Tidak ada kriteria skema sertifikasi NEN yang disalin. Seluruh pernyataan berjenjang adalah karya Nusa Safety.
- Teks antarmuka mengikuti bahasa Indonesia baku tanpa singkatan, sejalan dengan dokumen proposal.
