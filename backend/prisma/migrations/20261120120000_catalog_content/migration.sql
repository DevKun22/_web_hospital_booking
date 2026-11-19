-- Nội dung công khai của chuyên khoa, bác sĩ, gói khám; slug bắt buộc để mọi trang truy cập được theo đường dẫn.
UPDATE "Department" SET "slug" = 'khoa-' || substr("id", 1, 8) WHERE "slug" IS NULL;
UPDATE "Package" SET "slug" = 'goi-' || substr("id", 1, 8) WHERE "slug" IS NULL;

ALTER TABLE "Department"
  ALTER COLUMN "slug" SET NOT NULL,
  ADD COLUMN "sections" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "contentReviewerName" TEXT,
  ADD COLUMN "contentUpdatedAt" TIMESTAMP(3);

ALTER TABLE "Package"
  ALTER COLUMN "slug" SET NOT NULL,
  ADD COLUMN "audience" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "resultTime" TEXT,
  ADD COLUMN "faq" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "DoctorProfile"
  ADD COLUMN "motto" TEXT,
  ADD COLUMN "careerTimeline" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "memberships" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "expertise" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "profileReviewerName" TEXT,
  ADD COLUMN "profileUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "profileDraft" JSONB,
  ADD COLUMN "profileDraftAt" TIMESTAMP(3);
