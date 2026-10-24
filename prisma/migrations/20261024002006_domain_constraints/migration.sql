-- Batasan rentang nilai yang tidak dapat dinyatakan di schema.prisma (docs/02 bagian 3, docs/03).
-- Lapisan pertahanan kedua; validasi utama tetap dengan Zod di Server Action dan Route Handler.

-- Tingkat berjenjang 1 sampai 5
ALTER TABLE "LevelStatement"
  ADD CONSTRAINT "LevelStatement_level_range" CHECK ("level" BETWEEN 1 AND 5);
ALTER TABLE "CharacteristicAnswer"
  ADD CONSTRAINT "CharacteristicAnswer_level_range" CHECK ("level" IS NULL OR "level" BETWEEN 1 AND 5);
ALTER TABLE "SelfAssessmentAnswer"
  ADD CONSTRAINT "SelfAssessmentAnswer_level_range" CHECK ("level" IS NULL OR "level" BETWEEN 1 AND 5);

-- Skala iklim Likert lima titik
ALTER TABLE "ClimateAnswer"
  ADD CONSTRAINT "ClimateAnswer_value_range" CHECK ("value" BETWEEN 1 AND 5);

-- Nilai asesor 1,0 sampai 5,0 kelipatan 0,5 (nilai x 2 harus bilangan bulat; tepat untuk double precision)
ALTER TABLE "EvidenceRating"
  ADD CONSTRAINT "EvidenceRating_level_half_step" CHECK ("level" BETWEEN 1 AND 5 AND "level" * 2 = trunc("level" * 2));
ALTER TABLE "ValidationRating"
  ADD CONSTRAINT "ValidationRating_level_half_step" CHECK ("level" BETWEEN 1 AND 5 AND "level" * 2 = trunc("level" * 2));

-- Penyesuaian panel dalam skala 1 sampai 5
ALTER TABLE "PanelAdjustment"
  ADD CONSTRAINT "PanelAdjustment_values_range" CHECK ("engineValue" BETWEEN 1 AND 5 AND "adjustedValue" BETWEEN 1 AND 5);

-- Jalur setara Safety Culture Ladder: tingkat 2 sampai 5, persentase 0 sampai 100
ALTER TABLE "SclFulfillment"
  ADD CONSTRAINT "SclFulfillment_step_range" CHECK ("step" BETWEEN 2 AND 5),
  ADD CONSTRAINT "SclFulfillment_percent_range" CHECK ("percent" BETWEEN 0 AND 100);

-- Asesmen: tingkat sasaran 1 sampai 5 dan periode tidak terbalik
ALTER TABLE "Assessment"
  ADD CONSTRAINT "Assessment_targetLevel_range" CHECK ("targetLevel" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Assessment_period_order" CHECK ("periodEnd" >= "periodStart");

-- Populasi strata, kemajuan rencana aksi, dan jumlah pengingat (paling banyak tiga, docs/01 M2)
ALTER TABLE "Stratum"
  ADD CONSTRAINT "Stratum_population_nonnegative" CHECK ("population" >= 0);
ALTER TABLE "ActionUpdate"
  ADD CONSTRAINT "ActionUpdate_progress_range" CHECK ("progressPercent" BETWEEN 0 AND 100);
ALTER TABLE "AccessToken"
  ADD CONSTRAINT "AccessToken_reminderCount_range" CHECK ("reminderCount" BETWEEN 0 AND 3);

-- Paling banyak satu ScoreRun final per asesmen
CREATE UNIQUE INDEX "ScoreRun_one_final_per_assessment"
  ON "ScoreRun" ("assessmentId") WHERE "isFinal";
