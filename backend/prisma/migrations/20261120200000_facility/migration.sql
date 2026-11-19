-- Cơ sở khám mức nhỏ: một bảng Facility, gắn với ca làm việc, khung giờ và lịch hẹn.
CREATE TABLE "Facility" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "phone" TEXT,
  "workingHours" TEXT,
  "mapUrl" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Facility_slug_key" ON "Facility"("slug");

-- Cơ sở mặc định lấy từ cấu hình website hiện có (tên, địa chỉ, hotline, giờ làm việc, bản đồ); thiếu thì dùng giá trị trung tính.
INSERT INTO "Facility" ("id", "name", "slug", "address", "phone", "workingHours", "mapUrl", "isDefault", "isActive", "updatedAt")
SELECT
  gen_random_uuid()::text,
  COALESCE(NULLIF(s."value"->>'hospitalName', ''), 'Cơ sở chính'),
  'co-so-chinh',
  COALESCE(NULLIF(s."value"->>'address', ''), 'Chưa cập nhật địa chỉ'),
  NULLIF(s."value"->>'hotline', ''),
  NULLIF(s."value"->>'workingHours', ''),
  NULLIF(s."value"->>'mapUrl', ''),
  true,
  true,
  CURRENT_TIMESTAMP
FROM (SELECT 1) AS one
LEFT JOIN "AppSetting" s ON s."key" = 'public_site_settings';

ALTER TABLE "DoctorSchedule" ADD COLUMN "facilityId" TEXT;
ALTER TABLE "DoctorTimeSlot" ADD COLUMN "facilityId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "facilityId" TEXT;

UPDATE "DoctorSchedule" SET "facilityId" = (SELECT "id" FROM "Facility" WHERE "isDefault" LIMIT 1);
UPDATE "DoctorTimeSlot" SET "facilityId" = (SELECT "id" FROM "Facility" WHERE "isDefault" LIMIT 1);
UPDATE "Appointment" SET "facilityId" = (SELECT "id" FROM "Facility" WHERE "isDefault" LIMIT 1);

ALTER TABLE "DoctorSchedule" ADD CONSTRAINT "DoctorSchedule_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DoctorTimeSlot" ADD CONSTRAINT "DoctorTimeSlot_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DoctorSchedule_facilityId_idx" ON "DoctorSchedule"("facilityId");
CREATE INDEX "DoctorTimeSlot_facilityId_idx" ON "DoctorTimeSlot"("facilityId");
CREATE INDEX "Appointment_facilityId_idx" ON "Appointment"("facilityId");
