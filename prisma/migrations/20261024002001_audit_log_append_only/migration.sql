-- AuditLog hanya boleh ditambah (CLAUDE.md aturan 6, docs/02 bagian 3, docs/04 bagian 6).
-- Pemicu baris menolak UPDATE dan DELETE; pemicu pernyataan menolak TRUNCATE,
-- karena TRUNCATE tidak menjalankan pemicu baris.
-- Catatan produksi: pemilik tabel atau superuser masih dapat menonaktifkan pemicu, sehingga
-- aplikasi harus terhubung dengan peran basis data yang bukan pemilik tabel (Fase 16).

CREATE OR REPLACE FUNCTION audit_log_reject_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "AuditLog_reject_update_delete"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_reject_modification();

CREATE TRIGGER "AuditLog_reject_truncate"
  BEFORE TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT
  EXECUTE FUNCTION audit_log_reject_modification();
