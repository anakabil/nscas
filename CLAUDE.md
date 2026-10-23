# NSCAS: Nusa Safety Culture Assessment System

Aplikasi web milik PT Nusa Rendra Jayatama (Nusa Safety) untuk mengukur tingkat kematangan budaya keselamatan dan kesehatan kerja (K3) secara daring, dengan kerangka acuan Safety Culture Ladder dari NEN. Klien pertama: PT Adhi Karya (Persero) Tbk., lingkup sampai 3.000 pekerja, 40 proyek, 12 lokasi.

Hasil aplikasi ini adalah **pengukuran dan diagnosis internal**, bukan sertifikat Safety Culture Ladder. Jangan pernah menulis teks antarmuka atau laporan yang menyiratkan sertifikasi NEN.

## Baca sebelum mengerjakan apa pun

| Dokumen | Isi |
|---|---|
| `docs/01-kebutuhan-produk.md` | Peran, dua belas modul, alur asesmen, kriteria penerimaan |
| `docs/02-arsitektur-dan-data.md` | Tumpukan teknologi, struktur folder, model data, desain anonimitas |
| `docs/03-aturan-penilaian.md` | Rumus penilaian, kalkulator sampel, statistik mutu data |
| `docs/04-privasi-keamanan.md` | Hak akses, pelindungan data pribadi, jejak audit, retensi |
| `docs/05-panduan-tampilan.md` | Warna, huruf, pola komponen, aturan bahasa antarmuka |
| `seed/` | Data awal instrumen, parameter, dan fixture pengujian |

## Tumpukan teknologi (jangan diganti tanpa persetujuan)

Next.js 15 App Router, TypeScript strict, Node.js 22 LTS, PostgreSQL 16, Prisma, Auth.js v5 dengan TOTP, Tailwind CSS dan shadcn/ui, Recharts, next-intl (id bawaan, en), Zod, pg-boss, penyimpanan objek kompatibel S3 (MinIO saat pengembangan), Vitest, Playwright, Docker Compose.

## Perintah

```bash
docker compose up -d          # postgres, minio, mailpit
npm run dev                   # aplikasi di http://localhost:3000
npm run db:migrate            # prisma migrate dev
npm run db:seed               # muat seed/ ke basis data
npm test                      # vitest
npm run test:e2e              # playwright
npm run lint && npm run typecheck
```

## Aturan yang tidak boleh dilanggar

1. **Mesin penilaian adalah kode murni** di `src/lib/scoring/` tanpa impor Prisma, Next.js, atau I/O. Setiap perubahan wajib lolos semua fixture di `seed/fixtures/` dengan toleransi 1e-6. Jika hasil berbeda dari fixture, yang salah adalah kode, bukan fixture. Rujukan perhitungan ada di `seed/fixtures/referensi_skoring.py`.
2. **Anonimitas responden survei.** Tabel jawaban survei tidak boleh menyimpan, atau dapat dihubungkan ke, token akses, daftar responden, alamat IP, atau waktu kirim yang presisi. Lihat bagian Desain Anonimitas di `docs/02`. Penilaian mandiri manajemen tidak anonim dan diberi tahu demikian di layar.
3. **Sel laporan dengan kurang dari 5 responden disembunyikan** atau digabung, di dasbor, ekspor, dan laporan.
4. **Isolasi tenant.** Setiap kueri yang menyentuh data asesmen wajib disaring `organizationId` dan diperiksa hak aksesnya di server melalui `src/lib/auth/guard.ts`. Jangan mengandalkan pemeriksaan di sisi klien.
5. **Parameter terkunci.** Setelah asesmen berstatus `LOCKED`, bobot, ambang, versi instrumen, dan strata tidak dapat diubah. Nilainya dibaca dari `Assessment.parameterSnapshot`, bukan dari berkas seed.
6. **Jejak audit.** Setiap perubahan data asesmen, skor, keputusan panel, dan unggahan bukti dicatat ke `AuditLog` melalui `src/lib/audit.ts`. Tabel ini hanya boleh ditambah.
7. **Lokasi data.** Basis data dan penyimpanan objek produksi berada di pusat data di Indonesia. Jangan menambahkan layanan pihak ketiga yang mengirim data responden ke luar negeri, termasuk analitik, pelacak galat, atau API AI, tanpa persetujuan tertulis.
8. **Hak cipta NEN.** Jangan menyalin kriteria skema sertifikasi Safety Culture Ladder ke dalam kode, seed, atau antarmuka. Gunakan hanya struktur yang ada di `seed/aspek-dan-parameter.json` dan pernyataan karya Nusa Safety di `seed/instrumen-karakteristik-v1.json`.
9. **Rahasia** tidak pernah ditulis ke kode atau dikomit. Gunakan `.env` (sudah di `.gitignore`) dan `.env.example` tanpa nilai asli.

## Konvensi kode

- Identifier, nama berkas, dan pesan komit dalam bahasa Inggris. Komentar boleh bahasa Indonesia.
- Seluruh teks antarmuka melalui next-intl (`messages/id.json`, `messages/en.json`), tidak ditulis langsung di komponen.
- Validasi masukan dengan Zod di setiap Server Action dan Route Handler.
- Angka di antarmuka memakai format Indonesia: koma desimal, titik ribuan (`Intl.NumberFormat('id-ID')`). Perhitungan tetap memakai presisi penuh; pembulatan hanya saat ditampilkan.
- Komponen server sebagai bawaan; komponen klien hanya bila memerlukan interaksi.
- Satu fitur selesai bila: tes unit dan e2e terkait lulus, `lint` dan `typecheck` bersih, teks antarmuka lengkap dalam kedua bahasa, dan aksi penting tercatat di jejak audit.

## Aturan bahasa antarmuka (bahasa Indonesia)

Baku dan formal. Tidak memakai singkatan kecuali K3 (dijelaskan saat pertama muncul) dan nama produk. Tulis "alat pelindung diri", bukan "APD"; "diskusi kelompok terarah", bukan "FGD". Jangan memakai tanda pisah panjang. Gunakan istilah yang dipahami pekerja lapangan. Rincian ada di `docs/05`.

## Cara bekerja dengan pemilik proyek

Pemilik proyek: M. Reza Huzain (Nusa Safety). Kerjakan satu fase dari `PROMPTS.md` per sesi. Mulai setiap fase dengan rencana singkat, kerjakan, jalankan tes, lalu laporkan apa yang selesai, apa yang belum, dan keputusan yang perlu dikonfirmasi. Jangan melompat ke fase berikutnya tanpa diminta.
