# 02. Arsitektur dan Model Data

## 1. Tumpukan teknologi

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Kerangka web | Next.js 15 App Router, TypeScript strict | Satu basis kode untuk antarmuka dan API; sejalan dengan produk Nusa Safety lain |
| Runtime | Node.js 22 LTS | Dukungan jangka panjang |
| Basis data | PostgreSQL 16 | Relasional, transaksi kuat, pemicu untuk jejak audit hanya-tambah |
| ORM | Prisma | Migrasi terkelola, tipe otomatis |
| Autentikasi | Auth.js v5, kredensial dan TOTP (otplib) | Tanpa ketergantungan penyedia identitas luar |
| Antarmuka | Tailwind CSS, shadcn/ui, lucide-react, Recharts | Konsisten, ringan |
| Bahasa | next-intl (`id` bawaan, `en`) | Survei dua bahasa |
| Validasi | Zod | Satu skema untuk klien dan server |
| Antrean tugas | pg-boss | Memakai PostgreSQL yang sama, tanpa Redis |
| Berkas | S3 kompatibel (MinIO saat pengembangan) | Dapat dipindah ke penyedia di Indonesia |
| Surel | Nodemailer melalui SMTP; Mailpit saat pengembangan | |
| PDF | Playwright Chromium di server | Laporan HTML menjadi PDF dengan tampilan identik |
| Pengujian | Vitest, Playwright | |
| Kemasan | Docker Compose; Caddy untuk TLS | Satu VPS di pusat data Indonesia |

## 2. Struktur folder

```
nscas/
  CLAUDE.md
  PROMPTS.md
  docs/                    dokumen ini
  seed/                    data awal dan fixture
  prisma/
    schema.prisma
    migrations/
    seed.ts                memuat seed/ ke basis data
  messages/
    id.json
    en.json
  src/
    app/
      (auth)/              masuk, verifikasi dua faktor
      (console)/           antarmuka Nusa Safety dan klien
        orgs/
        assessments/[id]/
          setup/  respondents/  evidence/  observations/
          validation/  scoring/  panel/  dashboard/
          gaps/  report/  audit/
      s/[token]/           survei responden (tanpa akun)
      sa/[token]/          penilaian mandiri manajemen
      o/[windowId]/        pengambilan observasi digital
      api/                 route handler (unggah, ekspor, webhook)
    lib/
      scoring/             MESIN PENILAIAN MURNI (tanpa I/O)
        engine.ts  sampling.ts  quality.ts  types.ts  index.ts
        __tests__/fixtures.test.ts
      auth/                guard.ts, roles.ts, totp.ts
      audit.ts
      db.ts
      storage.ts
      jobs/                reminders.ts, retention.ts, report.ts
      privacy/             tokens.ts, suppression.ts, crypto.ts
    components/
  tests/e2e/
  docker-compose.yml
  docker-compose.prod.yml
  Caddyfile
  .env.example
```

## 3. Model data

Nama model dalam bahasa Inggris. Semua tabel memiliki `id` (cuid), `createdAt`, `updatedAt` kecuali disebut lain.

### Organisasi dan pengguna
- `Organization`: name, legalName, sector
- `User`: email (unik), name, passwordHash (argon2id), totpSecretEnc, totpEnabled, isActive, lastLoginAt
- `Membership`: userId, organizationId, role (`SUPER_ADMIN`, `LEAD_ASSESSOR`, `ASSESSOR`, `CLIENT_ADMIN`, `UNIT_COORDINATOR`, `EXECUTIVE_VIEWER`), unitScope (array id unit, untuk koordinator)

### Instrumen (berversi, tidak diubah setelah dipakai)
- `InstrumentVersion`: code (`NS-SCML-1.0`), status (`DRAFT`, `PUBLISHED`), publishedAt
- `Aspect`: instrumentVersionId, code (`A1` sampai `A6`, `KT`), name, maxPointsStep5, excludedFromLevel
- `Characteristic`: aspectId, code (`K1.1`), nameId, nameEn, isContextual, order
- `LevelStatement`: characteristicId, level (1 sampai 5), textId, textEn
- `EvidenceRequirement`: characteristicId, description
- `ClimateDimension`, `ClimateItem` (textId, textEn, reverseCoded, order)

### Asesmen
- `Assessment`: organizationId, name, scopeType, periodStart, periodEnd, targetLevel, status, instrumentVersionId, parameterSnapshot (JSON), lockedAt, lockedById, consentTextId, consentTextEn, dpaSigned (boolean), surveyOpensAt, surveyClosesAt
- `AssessmentAssignment`: assessmentId, userId, role (`LEAD_ASSESSOR`, `ASSESSOR`)
- `Unit`: assessmentId, parentId, name, type (`HEAD_OFFICE`, `DIVISION`, `PROJECT`, `BRANCH`), latitude, longitude, radiusMeters
- `Stratum`: assessmentId, code, name, group (`MANAGEMENT`, `SUPERVISORY`, `FIELD`), population, isContractor

### Responden (data pribadi, dipisah dari jawaban)
- `RosterEntry`: assessmentId, unitId, stratumId, fullName, employeeNo, emailEnc, phoneEnc, isContractor
- `AccessToken`: assessmentId, rosterEntryId (boleh kosong untuk token dari kode QR unit), unitId, stratumId, kind (`SURVEY`, `SELF_ASSESSMENT`), tokenHash (SHA-256, unik), issuedAt, firstOpenedAt, consentAt, completedAt, revokedAt, reminderCount
- `UnitQrCode`: assessmentId, unitId, codeHash, isActive, maxIssuance

### Jawaban survei (anonim)
- `SurveyResponse`: assessmentId, unitId, stratumId, instrumentVersionId, language, submittedOn (tanggal saja, tanpa jam), durationBucket (`<5`, `5-10`, `10-15`, `15-20`, `>20` menit), qualityFlags (array), excluded, excludedReason, excludedById
- `CharacteristicAnswer`: responseId, characteristicId, level (1 sampai 5, atau kosong bila "Tidak tahu")
- `ClimateAnswer`: responseId, itemId, value (1 sampai 5)

### Penilaian mandiri (teridentifikasi)
- `SelfAssessment`: assessmentId, accessTokenId, respondentName, respondentPosition, status (`DRAFT`, `SUBMITTED`), submittedAt
- `SelfAssessmentAnswer`: selfAssessmentId, characteristicId, level, justification, evidenceIds (array)

### Bukti dan observasi
- `EvidenceItem`: assessmentId, unitId, title, description, storageKey, sha256, mimeType, sizeBytes, version, supersedesId, uploadedById
- `EvidenceLink`: evidenceItemId, characteristicId
- `ObservationWindow`: assessmentId, unitId, opensAt, closesAt, checklist (JSON), createdById
- `ObservationCapture`: windowId, checklistItemCode, storageKey, sha256, mimeType, serverCapturedAt, latitude, longitude, accuracyMeters, distanceFromSiteMeters, outsideRadius, uploadedById, note

### Validasi
- `ValidationSession`: assessmentId, type, unitId, stratumId, scheduledAt, meetingUrl, guideTemplateId, participantCount, recordingConsent, status
- `ValidationParticipant`: sessionId, fullName, position (untuk lampiran laporan)
- `ValidationRating`: sessionId, characteristicId, assessorId, level (1,0 sampai 5,0 kelipatan 0,5), note

### Penilaian asesor dan hasil
- `EvidenceRating`: assessmentId, characteristicId, assessorId, level (1,0 sampai 5,0 kelipatan 0,5), rationale, evidenceIds
- `SclFulfillment`: assessmentId, aspectCode, step (2 sampai 5), percent (0 sampai 100), justification, enteredById
- `ScoreRun`: assessmentId, engineVersion, inputSnapshot (JSON), parameterSnapshot (JSON), result (JSON), runById, isFinal
- `PanelAdjustment`: scoreRunId, characteristicId, engineValue, adjustedValue, rationale, decidedById, decidedAt

### Kesenjangan dan tindakan
- `GapItem`: assessmentId, characteristicId, currentIndex, targetLevel, gap, priorityScore, rootCause
- `ActionItem`: gapItemId, title, description, ownerName, ownerPosition, dueDate, successIndicator, status (`PLANNED`, `IN_PROGRESS`, `DONE`, `VERIFIED`, `CANCELLED`), verifiedById, verifiedAt
- `ActionUpdate`: actionItemId, note, progressPercent, createdById

### Laporan, audit, retensi
- `Report`: assessmentId, version, kind (`FULL`, `EXECUTIVE_SUMMARY`, `STATEMENT`), status (`DRAFT`, `FINAL`), storageKey, signedById, signedAt
- `AuditLog`: at, actorId, actorRole, organizationId, assessmentId, action, entityType, entityId, before (JSON), after (JSON), ipHash, userAgent. **Hanya tambah**: pemicu PostgreSQL menolak UPDATE dan DELETE.
- `DestructionRecord`: assessmentId, scope, executedAt, executedById, objectCount, witnessName, notes

## 4. Desain anonimitas survei

Tujuan: tidak seorang pun, termasuk Nusa Safety, dapat mengetahui jawaban seorang responden tertentu.

1. Token mentah hanya ada di tautan. Basis data menyimpan `tokenHash`.
2. Saat survei dikirim, dalam satu transaksi: (a) `AccessToken.completedAt` diisi; (b) `SurveyResponse` baru dibuat dengan `unitId` dan `stratumId` yang disalin dari token, **tanpa** kolom yang merujuk token atau `RosterEntry`.
3. `SurveyResponse` hanya menyimpan tanggal kirim tanpa jam, dan durasi dalam rentang, agar tidak dapat dicocokkan dengan `AccessToken.completedAt`.
4. `AccessToken.completedAt` dibulatkan ke jam terdekat.
5. Alamat IP tidak disimpan untuk rute `/s/*`. Pembatas laju memakai hash IP yang berumur pendek di memori.
6. Draf jawaban hanya disimpan di perangkat (IndexedDB), bukan di server.
7. Unit dengan kurang dari 5 respons digabungkan ke unit induknya pada setiap tampilan dan ekspor (`src/lib/privacy/suppression.ts`).
8. Log aplikasi tidak mencatat isi permintaan rute survei.

Penilaian mandiri, observasi, dan validasi tidak anonim karena memerlukan pertanggungjawaban; hal ini dinyatakan di layar masing-masing.

## 5. Penyimpanan berkas

- Kunci objek: `{organizationId}/{assessmentId}/{kind}/{cuid}.{ext}`.
- Unggah langsung ke penyimpanan objek melalui URL bertanda tangan berumur pendek; server memverifikasi ukuran, jenis, dan hash setelah unggah.
- Unduhan selalu melalui route handler yang memeriksa hak akses lalu mengalihkan ke URL bertanda tangan 5 menit.
- Enkripsi sisi server penyimpanan objek diaktifkan.

## 6. Tugas latar (pg-boss)

| Tugas | Jadwal |
|---|---|
| `reminders.send` | Harian pukul 08.00 WIB selama jendela survei |
| `participation.snapshot` | Harian pukul 23.00 WIB |
| `report.render` | Saat diminta |
| `retention.scan` | Mingguan; menandai asesmen yang melewati masa retensi untuk ditinjau SUPER_ADMIN |

## 7. Penempatan produksi

```
Pengguna -> Caddy (TLS, header keamanan) -> Next.js (container) -> PostgreSQL (container, volume terenkripsi)
                                                      \-> MinIO atau penyimpanan objek penyedia lokal
                                                      \-> pg-boss worker (container terpisah, image sama)
Cadangan: pg_dump harian terenkripsi ke penyimpanan objek kedua, simpan 30 hari
```

- **Lokasi server wajib di pusat data Indonesia** sesuai komitmen proposal. VPS Hostinger yang dipakai situs nusasafety.co.id tidak menyediakan lokasi Indonesia (pilihan terdekat Kuala Lumpur), sehingga NSCAS memakai penyedia lain, misalnya Biznet Gio, IDCloudHost, AWS wilayah Jakarta (`ap-southeast-3`), atau Google Cloud wilayah Jakarta (`asia-southeast2`).
- Spesifikasi awal yang memadai untuk satu asesmen 3.000 responden: 4 vCPU, 8 GB RAM, 160 GB SSD.
- Subdomain yang disarankan: `nscas.nusasafety.co.id` (rekaman DNS di Hostinger diarahkan ke VPS baru).

## 8. Variabel lingkungan (`.env.example`)

```
DATABASE_URL=
AUTH_SECRET=
AUTH_URL=
DATA_ENCRYPTION_KEY=          # 32 byte base64, untuk kolom *Enc dan totpSecretEnc
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM="NSCAS Nusa Safety <noreply@nusasafety.co.id>"
APP_TIMEZONE=Asia/Jakarta
```
