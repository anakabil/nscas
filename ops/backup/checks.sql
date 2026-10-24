-- Pemeriksaan basis data hasil pemulihan (ops/backup/restore-test.sh). Gagal (ON_ERROR_STOP) bila struktur
-- penting hilang; selain itu mencetak ringkasan untuk dicatat di berita acara uji pemulihan bulanan.

\echo '== Migrasi terpasang'
SELECT count(*) AS migrasi, max(migration_name) AS terakhir
FROM _prisma_migrations
WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;

\echo '== Pemicu hanya-tambah dan pemicu pelindung masih ada'
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(name, ', ') INTO missing
  FROM unnest(ARRAY['AuditLog_reject_update_delete', 'AuditLog_reject_truncate', 'ScoreRun_guard', 'Report_guard', 'DestructionRecord_guard']) AS name
  WHERE NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = name);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Pemicu hilang setelah pemulihan: %', missing;
  END IF;
END $$;
SELECT 'lengkap' AS pemicu;

\echo '== Jumlah baris utama'
SELECT 'Organization' AS tabel, count(*) AS baris FROM "Organization"
UNION ALL SELECT 'User', count(*) FROM "User"
UNION ALL SELECT 'Assessment', count(*) FROM "Assessment"
UNION ALL SELECT 'RosterEntry', count(*) FROM "RosterEntry"
UNION ALL SELECT 'SurveyResponse', count(*) FROM "SurveyResponse"
UNION ALL SELECT 'EvidenceItem', count(*) FROM "EvidenceItem"
UNION ALL SELECT 'ScoreRun', count(*) FROM "ScoreRun"
UNION ALL SELECT 'Report', count(*) FROM "Report"
UNION ALL SELECT 'AuditLog', count(*) FROM "AuditLog";

\echo '== Kesegaran data (catatan audit terakhir, WIB)'
-- Kolom tanggal Prisma bertipe timestamp tanpa zona waktu dan berisi UTC.
SELECT to_char((max("at") AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') || ' WIB' AS audit_terakhir FROM "AuditLog";

\echo '== Asesmen per status'
SELECT status, count(*) AS asesmen FROM "Assessment" GROUP BY status ORDER BY status;
