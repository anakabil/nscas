-- Mengacak urutan fisik baris jawaban survei setelah jendela survei ditutup (docs/06 R1).
--
-- Urutan fisik baris di PostgreSQL dan di berkas pg_dump mengikuti urutan pengiriman. Pihak yang dapat membaca
-- basis data secara langsung dapat mencocokkan urutan itu dengan AccessToken.completedAt. CLUSTER menulis ulang
-- tabel menurut kunci primer, yaitu UUID versi 4 acak, sehingga urutan pengiriman hilang. Cadangan yang dibuat
-- setelah perintah ini juga tidak lagi memuat urutan tersebut; cadangan sebelumnya habis dalam 30 hari.
--
-- CLUSTER mengunci tabel secara eksklusif selama berjalan (beberapa detik untuk ribuan respons). Jalankan di luar
-- jendela survei aktif:
--   docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
--     psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f - < ops/maintenance/shuffle-survey-rows.sql

CLUSTER VERBOSE "SurveyResponse" USING "SurveyResponse_pkey";
CLUSTER VERBOSE "CharacteristicAnswer" USING "CharacteristicAnswer_pkey";
CLUSTER VERBOSE "ClimateAnswer" USING "ClimateAnswer_pkey";
ANALYZE "SurveyResponse", "CharacteristicAnswer", "ClimateAnswer";
