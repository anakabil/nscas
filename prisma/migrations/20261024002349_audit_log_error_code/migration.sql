-- Mengganti kode galat pemicu AuditLog dari restrict_violation (23001) ke raise_exception (P0001).
-- Prisma memetakan 23001 menjadi pesan "Foreign key constraint violated" yang menyesatkan,
-- sedangkan P0001 diteruskan apa adanya sehingga pesan "AuditLog is append-only" terbaca.

CREATE OR REPLACE FUNCTION audit_log_reject_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'raise_exception';
END;
$$;
