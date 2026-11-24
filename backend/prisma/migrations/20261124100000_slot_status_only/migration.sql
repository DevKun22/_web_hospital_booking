-- Khung giờ chỉ còn một nguồn sự thật là cột status: isActive luôn bằng (status <> 'CANCELLED') nên bỏ.
DROP INDEX IF EXISTS "DoctorTimeSlot_status_isActive_date_startTime_idx";
ALTER TABLE "DoctorTimeSlot" DROP COLUMN "isActive";
CREATE INDEX "DoctorTimeSlot_status_date_startTime_idx" ON "DoctorTimeSlot"("status", "date", "startTime");
