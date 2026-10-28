-- Hồ sơ bác sĩ cần URL ổn định, dễ đọc thay vì để lộ UUID trên website công khai.
ALTER TABLE "DoctorProfile" ADD COLUMN "slug" TEXT;

WITH normalized AS (
  SELECT
    doctor."id",
    COALESCE(
      NULLIF(
        TRIM(BOTH '-' FROM REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  REGEXP_REPLACE(
                    REPLACE(LOWER("user"."fullName"), 'đ', 'd'),
                    '[àáạảãâầấậẩẫăằắặẳẵ]', 'a', 'g'
                  ),
                  '[èéẹẻẽêềếệểễ]', 'e', 'g'
                ),
                '[ìíịỉĩ]', 'i', 'g'
              ),
              '[òóọỏõôồốộổỗơờớợởỡ]', 'o', 'g'
            ),
            '[ùúụủũưừứựửữ]', 'u', 'g'
          ),
          '[ỳýỵỷỹ]', 'y', 'g'
        )),
        ''
      ),
      'bac-si-' || SUBSTRING(doctor."id" FROM 1 FOR 8)
    ) AS base_slug
  FROM "DoctorProfile" doctor
  JOIN "User" "user" ON "user"."id" = doctor."userId"
), cleaned AS (
  SELECT
    "id",
    TRIM(BOTH '-' FROM REGEXP_REPLACE(base_slug, '[^a-z0-9]+', '-', 'g')) AS base_slug
  FROM normalized
), ranked AS (
  SELECT
    "id",
    base_slug,
    ROW_NUMBER() OVER (PARTITION BY base_slug ORDER BY "id") AS duplicate_rank
  FROM cleaned
)
UPDATE "DoctorProfile" doctor
SET "slug" = CASE
  WHEN ranked.duplicate_rank = 1 THEN ranked.base_slug
  ELSE ranked.base_slug || '-' || SUBSTRING(ranked."id" FROM 1 FOR 8)
END
FROM ranked
WHERE doctor."id" = ranked."id";

ALTER TABLE "DoctorProfile" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "DoctorProfile_slug_key" ON "DoctorProfile"("slug");
