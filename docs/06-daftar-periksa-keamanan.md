# 06. Daftar Periksa Keamanan dan Privasi

Dokumen ini mencatat hasil pemeriksaan setiap butir `docs/04-privasi-keamanan.md` terhadap kode pada akhir Fase 14 (24 Oktober 2026). Setiap butir diberi status, bukti di kode atau tes, dan catatan bila ada. Butir yang baru dapat dipenuhi saat penempatan produksi ditandai sebagai butir operasional dan ditindaklanjuti di Fase 16 (`docs/08-penempatan.md`).

Arti status:

| Status | Arti |
|---|---|
| Terpenuhi | Diterapkan di kode dan dibuktikan oleh tes otomatis. |
| Terpenuhi sebagian | Diterapkan, dengan batasan yang dijelaskan di kolom catatan. |
| Operasional | Bergantung pada konfigurasi server, penyedia, atau prosedur; disiapkan di Fase 16. |

Perintah pemeriksaan yang dijalankan: `npm run lint`, `npm run typecheck`, `npm test` (498 tes unit), tes integrasi (156 tes terhadap PostgreSQL, MinIO, pg-boss, dan Chromium), `npm run test:e2e`, dan `npm audit`.

## 1. Dasar

| No | Butir | Status | Bukti | Catatan |
|---|---|---|---|---|
| 1.1 | Nusa Safety sebagai prosesor data atas nama klien berdasarkan perjanjian pemrosesan data | Terpenuhi | `Assessment.dpaSigned` menjadi syarat penguncian di `src/lib/assessments/state-machine.ts`; tes `tests/integration/assessments.test.ts` | Dokumen perjanjiannya sendiri disimpan di luar aplikasi. |
| 1.2 | Data disimpan di pusat data Indonesia | Operasional | Tidak ada dependensi yang mengirim data ke luar negeri (`package.json`: hanya S3 SDK, Prisma, pg, pg-boss, nodemailer, dan pustaka antarmuka) | Lokasi server, basis data, penyimpanan objek, SMTP, dan cadangan ditetapkan di Fase 16. SMTP produksi wajib berlokasi di Indonesia. |
| 1.3 | Identitas responden dipisahkan dari jawaban | Terpenuhi | `SurveyResponse` tanpa relasi ke `AccessToken` dan `RosterEntry`, id UUID v4 acak, `submittedOn` hanya tanggal (`prisma/schema.prisma`); tes `tests/integration/survey.test.ts` | Lihat risiko sisa R1. |
| 1.4 | Hasil hanya dilaporkan agregat, minimal 5 responden per sel | Terpenuhi | `src/lib/privacy/suppression.ts` (penyembunyian primer dan komplementer), dipakai dasbor, ekspor Excel, dan laporan; tes `src/lib/privacy/__tests__`, `tests/integration/dashboard.test.ts`, `tests/integration/report.test.ts` | Lihat risiko sisa R2. |
| 1.5 | Data mentah dimusnahkan dengan berita acara | Terpenuhi | Bagian 7 di bawah | |

## 2. Matriks hak akses

| No | Butir | Status | Bukti | Catatan |
|---|---|---|---|---|
| 2.1 | Seluruh pemeriksaan di server melalui `requireRole` | Terpenuhi | `src/lib/auth/guard.ts`, `src/lib/auth/access.ts`; tes statis `src/lib/auth/__tests__/guard-usage.test.ts` memeriksa setiap Server Action, Route Handler, dan halaman | Hasil penelusuran rute ada di bagian 9. |
| 2.2 | Organisasi dan pengguna: SUPER_ADMIN U, LEAD_ASSESSOR B, CLIENT_ADMIN U (pengguna klien) | Terpenuhi | `src/app/(console)/orgs/actions.ts` dengan `requireOrganizationRole` dan `grantableRoles` di `src/lib/auth/roles.ts`; tes `tests/integration/auth.test.ts` | |
| 2.3 | Parameter sebelum dan sesudah dikunci | Terpenuhi | `configurationReadRoles` di `src/lib/assessments/permissions.ts`, `requireConfigurationPage`; pemicu `parameterSnapshot`; tes `tests/integration/assessments.test.ts` | |
| 2.4 | Daftar responden: SUPER_ADMIN tidak dapat membaca | Terpenuhi | `PERMISSIONS.roster` di `src/lib/auth/roles.ts`; tes e2e `tests/e2e/access-control.spec.ts` ("SUPER_ADMIN tidak dapat membuka daftar responden") | |
| 2.5 | Token dan partisipasi, koordinator unit hanya unitnya | Terpenuhi | `unitWhere(access)`; tes e2e "koordinator unit tidak dapat membaca unit lain" | |
| 2.6 | Jawaban survei mentah hanya LEAD_ASSESSOR dan ASSESSOR tanpa identitas | Terpenuhi | Daftar respons bermasalah tanpa unit dan strata (`src/lib/dashboard/service.ts`) | |
| 2.7 | Penilaian mandiri, bukti dan observasi | Terpenuhi | `PERMISSIONS.selfAssessments`, `PERMISSIONS.evidenceAndObservations` | |
| 2.8 | Nilai asesor (ASSESSOR hanya miliknya), penyesuaian panel dan finalisasi LEAD_ASSESSOR | Terpenuhi | `SCORING_ROLES`, `visibleOtherRatings` di `src/lib/assessor-scoring/rules.ts`; tes `tests/integration/scoring.test.ts` | |
| 2.9 | Dasbor: koordinator unit hanya unitnya setelah final | Terpenuhi | `audienceFor` di `src/lib/dashboard/service.ts`; tes `tests/integration/dashboard.test.ts` | |
| 2.10 | Rencana aksi dan laporan | Terpenuhi | `ACTION_PLAN_ROLES`, `REPORT_ROLES` | Draf laporan hanya untuk tim asesor. |
| 2.11 | Jejak audit: SUPER_ADMIN B, LEAD_ASSESSOR B, CLIENT_ADMIN B tanpa data mentah | Terpenuhi | `AUDIT_ROLES` di `src/lib/auth/roles.ts`, `src/lib/audit-trail/service.ts`, halaman `assessments/[id]/audit`; tes `tests/integration/retention.test.ts` | CLIENT_ADMIN melihat waktu, aksi, entitas, pelaku, dan peran dengan label yang mudah dipahami, tanpa isi perubahan, surel pelaku, hash IP, dan agen pengguna. |
| 2.12 | Tes e2e akses lintas organisasi dan lintas unit | Terpenuhi | `tests/e2e/access-control.spec.ts` | Pengguna tanpa hubungan dengan asesmen mendapat 404 agar keberadaan asesmen tidak terungkap. |

## 3. Autentikasi

| No | Butir | Status | Bukti | Catatan |
|---|---|---|---|---|
| 3.1 | Kata sandi minimal 12 karakter, argon2id | Terpenuhi | `src/lib/auth/passwords.ts` (`PASSWORD_MIN_LENGTH = 12`, batas atas 128) | |
| 3.2 | TOTP wajib untuk SUPER_ADMIN, LEAD_ASSESSOR, ASSESSOR, CLIENT_ADMIN dengan 10 kode cadangan | Terpenuhi | `TOTP_REQUIRED_ROLES`, `src/lib/auth/backup-codes.ts` (`BACKUP_CODE_COUNT = 10`, hash argon2id); tes `tests/integration/auth.test.ts` | Rahasia TOTP disimpan terenkripsi (`totpSecretEnc`). |
| 3.3 | Sesi 8 jam, 30 menit tidak aktif untuk peran Nusa Safety | Terpenuhi | `src/lib/auth/session-policy.ts`, `IDLE_TIMEOUT_ROLES`; tes `src/lib/auth/__tests__/policies.test.ts` | Sesi dapat dicabut dari server (`UserSession`). |
| 3.4 | Penguncian setelah 5 kali gagal dalam 15 menit | Terpenuhi | `src/lib/auth/lockout.ts`; tes `src/lib/auth/__tests__/policies.test.ts` dan `tests/integration/auth.test.ts` | Akun terkunci 15 menit dan dicatat `auth.account_locked`. |
| 3.5 | Token survei acak 32 byte base64url, hanya hash disimpan, berlaku sampai survei ditutup | Terpenuhi | `src/lib/privacy/tokens.ts`, `AccessToken.tokenHash`; tes `tests/integration/survey.test.ts` | |

## 4. Enkripsi

| No | Butir | Status | Bukti | Catatan |
|---|---|---|---|---|
| 4.1 | TLS 1.2 ke atas melalui Caddy, HSTS aktif | Terpenuhi sebagian | Header `Strict-Transport-Security` di `src/lib/security-headers.ts` (produksi) | Konfigurasi TLS Caddy disiapkan di Fase 16. |
| 4.2 | Kolom `emailEnc`, `phoneEnc`, `totpSecretEnc` AES-256-GCM | Terpenuhi | `src/lib/privacy/crypto.ts`; tes `src/lib/privacy/__tests__` | Kunci dari `DATA_ENCRYPTION_KEY` di `.env`, tidak pernah dikomit. |
| 4.3 | Volume basis data dan penyimpanan objek terenkripsi di tingkat disk | Operasional | `S3_SSE` opsional di `src/lib/storage.ts` untuk enkripsi sisi server | Wajib dipastikan pada penyedia pusat data. |
| 4.4 | Cadangan basis data dienkripsi sebelum dikirim | Operasional | | Skrip cadangan dan uji pemulihan disiapkan di Fase 16. |

## 5. Header dan pembatasan

| No | Butir | Status | Bukti | Catatan |
|---|---|---|---|---|
| 5.1 | CSP ketat tanpa skrip pihak ketiga | Terpenuhi | `buildContentSecurityPolicy` dengan nonce dan `strict-dynamic`, dipasang di `src/middleware.ts`; tes `src/lib/__tests__/security.test.ts` | `style-src` memakai `'unsafe-inline'` karena atribut style React; skrip tetap dibatasi nonce. |
| 5.2 | `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` di rute survei | Terpenuhi | `securityHeaders` untuk `/s`, `/sa`, `/o`, `/q`; tes `src/lib/__tests__/security.test.ts` | |
| 5.3 | Pembatas laju: masuk 10 per menit per akun | Terpenuhi sebagian | `loginRateLimiter` di `src/lib/rate-limit.ts` | Penghitung di memori proses; lihat R4. |
| 5.4 | Rute survei 60 per menit per hash IP | Terpenuhi sebagian | `src/middleware.ts`, dapat diatur dengan `SURVEY_RATE_LIMIT_PER_MINUTE` | Lihat R3 dan R4. |
| 5.5 | Unggah 30 per menit per pengguna | Terpenuhi sebagian | `uploadRateLimiter` di layanan bukti dan observasi | Lihat R4. |
| 5.6 | Validasi jenis berkas dengan magic bytes | Terpenuhi | `src/lib/files/content-type.ts`, `inspectObject` setelah unggah; tes `tests/integration/evidence.test.ts` | |

## 6. Jejak audit

| No | Butir | Status | Bukti | Catatan |
|---|---|---|---|---|
| 6.1 | Akses: masuk, gagal masuk, aktivasi dan reset TOTP, perubahan peran | Terpenuhi | Aksi `auth.*` dan `membership.*` di `src/lib/audit.ts` | |
| 6.2 | Asesmen: pembuatan, perubahan parameter, penguncian, setiap transisi status | Terpenuhi | `assessment.create`, `assessment.parameters_update`, `assessment.status_change` | Pemusnahan juga mencatat transisi ARCHIVED ke PURGED. |
| 6.3 | Responden: impor daftar, penerbitan, pencabutan, pengiriman ulang token | Terpenuhi | `roster.import`, `token.issue`, `token.revoke`, `token.reissue`, `invitation.*`, `reminder.sent` | Pengiriman survei sengaja tidak dicatat agar tidak ada waktu presisi yang dapat dihubungkan ke responden. |
| 6.4 | Data: pengeluaran respons beserta alasannya | Terpenuhi | `survey.exclude`, `survey.restore` | |
| 6.5 | Bukti: unggah, versi baru, penghapusan logis | Terpenuhi | `evidence.upload`, `evidence.version`, `evidence.delete` | |
| 6.6 | Penilaian: nilai asesor, eksekusi mesin, penyesuaian panel, finalisasi | Terpenuhi | `rating.*`, `score.run`, `panel.*` | |
| 6.7 | Laporan: pembuatan, penandatanganan, pengunduhan | Terpenuhi | `report.create`, `report.finalize`, `report.render`, dan `report.download` (ditambahkan di Fase 14 pada rute PDF laporan) | |
| 6.8 | Retensi: pemusnahan beserta berita acara | Terpenuhi | `retention.flag`, `retention.destroy`, `retention.minutes`, `retention.minutes_download` | |
| 6.9 | `AuditLog` ditolak UPDATE, DELETE, dan TRUNCATE oleh pemicu | Terpenuhi | Pemicu `AuditLog_reject_update_delete` dan `AuditLog_reject_truncate`; tes `tests/integration/audit-log.test.ts` | Nilai rahasia disembunyikan oleh `redactForAudit`. |
| 6.10 | Lead assessor mengekspor jejak audit asesmennya ke CSV | Terpenuhi | `GET /api/assessments/[id]/audit/export`, `src/lib/audit-trail/csv.ts`; tes `src/lib/audit-trail/__tests__/csv.test.ts`, `tests/integration/retention.test.ts`, `tests/e2e/retention.spec.ts` | Pemisah titik koma dengan BOM UTF-8 agar terbuka benar di Excel berlokal Indonesia; sel yang diawali `=`, `+`, `-`, `@`, tab, atau carriage return diberi awalan kutip tunggal untuk mencegah injeksi rumus; ekspor dicatat sebagai `audit.export`. |

## 7. Retensi dan pemusnahan

| No | Butir | Status | Bukti | Catatan |
|---|---|---|---|---|
| 7.1 | Masa simpan 36 bulan sejak laporan final | Terpenuhi | `retentionEnd` di `src/lib/retention/service.ts`, nilai dari `parameterSnapshot.parameters.retention.rawDataMonths` yang terkunci | |
| 7.2 | Tugas mingguan menandai asesmen yang melewati masa simpan | Terpenuhi | `retention.scan` setiap Senin 06.00 WIB di `src/worker.ts`, `scanRetention` mengisi `Assessment.retentionFlaggedAt` dan mencatat `retention.flag` | Penandaan hanya sekali per asesmen. |
| 7.3 | Pemusnahan oleh SUPER_ADMIN setelah konfirmasi tertulis klien | Terpenuhi | Halaman `/retention` dan `destroyRawDataAction` (`requireSuperAdmin`, Zod); `executeDestruction` mensyaratkan status ARCHIVED, masa simpan habis, nomor dan tanggal surat klien, penanda tangan, saksi, dan centang konfirmasi | |
| 7.4 | Yang dimusnahkan: `RosterEntry`, `AccessToken`, `SurveyResponse` beserta jawaban, `SelfAssessment`, berkas bukti, observasi, rekaman | Terpenuhi | Satu transaksi basis data; berkas di penyimpanan objek dihapus oleh `destruction.process` (`src/lib/jobs/destruction.ts`) secara idempoten | Daftar narasumber validasi (`ValidationParticipant`) ikut dimusnahkan karena berisi nama orang; jumlah peserta tetap di sesi. |
| 7.5 | Yang disimpan: hasil agregat, `ScoreRun` final, laporan final, `DestructionRecord`, jejak audit | Terpenuhi | Tes `tests/integration/retention.test.ts` memastikan baris tersebut tetap ada | Laporan final dapat memuat lampiran nama narasumber validasi; lihat R6. |
| 7.6 | Berita acara PDF dicatat di `DestructionRecord` | Terpenuhi | `src/lib/retention/html.ts` dirender Chromium, disimpan di `{org}/{assessment}/destruction/`, kolom `storageKey` dan `pdfStatus`; unduhan melalui `GET /api/retention/[recordId]/pdf` | Pemicu `DestructionRecord_guard` menolak DELETE dan perubahan isi; hanya kolom hasil render dan penghapusan berkas yang dapat diisi kemudian. |

## 8. Teks persetujuan responden

| No | Butir | Status | Bukti | Catatan |
|---|---|---|---|---|
| 8.1 | Templat persetujuan dapat disesuaikan sebelum dikunci | Terpenuhi | `src/lib/assessments/consent.ts`, kolom `consentTextId` dan `consentTextEn`, salinannya di `parameterSnapshot.consent` | |
| 8.2 | Penilaian mandiri manajemen tidak anonim dan diberi tahu di layar | Terpenuhi | Halaman `/sa/[token]` | |

## 9. Hasil penelusuran rute

Penelusuran mencakup 45 halaman, 17 berkas Server Action, dan 23 Route Handler di `src/app`. Tes `src/lib/auth/__tests__/guard-usage.test.ts` kini memeriksa ketiganya; halaman baru yang tidak memakai guard akan menggagalkan tes.

Seluruh akses data asesmen berdasarkan id (halaman di bawah `assessments/[id]`, rute `api/assessments/[id]`, dan Server Action asesmen) memakai `requireRole`, langsung atau melalui `requireConfigurationPage`. Rute yang tidak memakai `requireRole` beserta alasannya:

| Rute | Pemeriksaan yang dipakai | Alasan |
|---|---|---|
| `src/app/(account)/account/*` | `requireUser` | Data akun milik pengguna sendiri. |
| `src/app/(console)/assessments/page.tsx`, `assessments/new/page.tsx` | `requireUser` | Daftar asesmen disaring sesuai keanggotaan; pembuatan diperiksa `requireOrganizationRole` di Server Action. |
| `src/app/(console)/orgs/*` | `requireUser`, `requireOrganizationRole`, `requireSuperAdmin` | Data organisasi dan pengguna, bukan data asesmen. |
| `src/app/(console)/retention/*` | `requireSuperAdmin` | Lintas organisasi sesuai docs/04 bagian 7. |
| `src/app/api/retention/[recordId]/pdf` | `requireUser`, lalu `requireRole` pada asesmen pemilik catatan | Termasuk rute ber-`requireRole`. |
| `src/app/o/page.tsx` | `requireUser` | Daftar jendela observasi milik asesor; `/o/[windowId]` memakai `requireRole` dengan unit. |
| `src/app/s/[token]/*`, `src/app/sa/[token]/*`, `src/app/q/[code]` | Verifikasi token di layanan | Responden tanpa akun; hak akses adalah token itu sendiri (docs/02 bagian 4). |
| `src/app/o/manifest.webmanifest`, `src/app/o/sw.js` | Tidak ada | Berkas statis aplikasi observasi tanpa data. |
| `src/app/api/auth/[...nextauth]`, `src/app/(auth)/login/*` | Auth.js | Proses masuk. |
| `src/app/page.tsx`, `forbidden`, `q/unavailable`, `health` | Tidak ada | Halaman tanpa data asesmen. Halaman `health` menampilkan status basis data dan penyimpanan; lihat R7. |

Tidak ditemukan rute yang membaca data asesmen tanpa pemeriksaan hak akses di server.

## 10. Hasil npm audit

| Paket | Tingkat | Masalah | Tindakan |
|---|---|---|---|
| `nodemailer` 8.0.11 (langsung dan melalui `next-auth`, `@auth/core`) | Tinggi | Pembacaan berkas dan SSRF melalui opsi `raw` (GHSA-p6gq-j5cr-w38f, GHSA-8m3c-c648-2xjj) | Dinaikkan ke 10.2.1; `overrides` memaksa `@auth/core` memakai versi yang sama. API yang dipakai (`createTransport`, `sendMail`) tidak berubah; tes integrasi undangan lulus. |
| `postcss` 8.4.31 (dibundel `next` 15.5.28) | Tinggi | XSS pada keluaran stringify dan pembacaan berkas melalui `sourceMappingURL` (GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q) | `overrides` `next > postcss ^8.5.31`; perbaikan `npm audit fix --force` akan menaikkan Next.js ke 16 yang melanggar ketentuan tumpukan teknologi. Dipakai hanya saat build. |
| `uuid` 8.3.2 (melalui `exceljs`) | Sedang | Pemeriksaan batas buffer (GHSA-w5hq-g745-h8pq) | `overrides` `exceljs > uuid ^11.1.1`; tes ekspor Excel lulus. |

Hasil setelah perbaikan: `found 0 vulnerabilities`.

## 11. Risiko sisa dan tindak lanjut

| Kode | Risiko | Penanganan yang disarankan |
|---|---|---|
| R1 | Urutan fisik baris `SurveyResponse` di PostgreSQL dapat mencerminkan urutan pengiriman, yang dapat dicocokkan dengan `AccessToken.completedAt` oleh pihak yang memiliki akses langsung ke basis data. | Akses basis data produksi hanya untuk administrator dengan prosedur tertulis; jalankan `VACUUM FULL` atau `CLUSTER` berkala pada tabel respons setelah survei ditutup (Fase 16). |
| R2 | Inferensi silang antartabel: sel tersembunyi dapat dihitung dari selisih dasbor berbeda tingkat agregasi bila pembaca menggabungkan beberapa ekspor. | Penyembunyian komplementer sudah diterapkan dalam satu tabel. Batasi ekspor ke peran yang memerlukan, dan sebutkan larangan rekonstruksi di perjanjian pemrosesan data. |
| R3 | Batas 60 permintaan per menit per hash IP dapat menolak pekerja yang mengisi survei dari satu jaringan Wi-Fi lokasi proyek (NAT bersama). | Atur `SURVEY_RATE_LIMIT_PER_MINUTE` sekitar 600 di produksi dan pantau penolakan 429. |
| R4 | Penghitung pembatas laju tersimpan di memori proses; tidak berlaku bersama bila aplikasi dijalankan lebih dari satu proses. Uji beban Fase 15 (docs/07) merekomendasikan tiga proses aplikasi selama jendela survei. | Dengan N proses, batas efektif menjadi N kali nilai yang diatur; tetapkan nilainya dengan memperhitungkan hal ini. Bila diperlukan batas yang tepat, pindahkan penghitung ke PostgreSQL atau penyimpanan bersama. |
| R5 | Log akses server web dapat merekam token survei di jalur `/s/*` dan `/sa/*` beserta alamat IP. | Caddyfile Fase 16 tidak mencatat log untuk `/s/*`, `/sa/*`, dan `/q/*`. |
| R6 | Laporan final yang disimpan setelah pemusnahan memuat lampiran nama dan jabatan narasumber validasi. | Perlu keputusan pemilik proyek: tetap dicantumkan sebagai bagian laporan yang diserahkan kepada klien, atau diganti dengan jumlah peserta per sesi. |
| R7 | Halaman `/health` publik menampilkan status basis data dan penyimpanan. | Tidak memuat data pribadi. Di produksi, batasi `/health` ke jaringan pemantauan melalui Caddy. |
| R8 | CORS penyimpanan objek dan enkripsi sisi server (`S3_SSE`) belum diatur untuk produksi. | Atur CORS bucket hanya untuk asal aplikasi dan aktifkan `S3_SSE` (Fase 16). |
| R9 | Next.js mengirim telemetri anonim saat build. | Tetapkan `NEXT_TELEMETRY_DISABLED=1` di Dockerfile (Fase 16). Telemetri tidak memuat data responden. |
