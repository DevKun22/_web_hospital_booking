-- Khung giờ biết mình được sinh từ ca mẫu nào để đổi/tắt ca xử lý đúng phần bị ảnh hưởng.
ALTER TABLE "DoctorTimeSlot" ADD COLUMN "scheduleId" TEXT;

CREATE INDEX "DoctorTimeSlot_scheduleId_idx" ON "DoctorTimeSlot"("scheduleId");

ALTER TABLE "DoctorTimeSlot"
  ADD CONSTRAINT "DoctorTimeSlot_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "DoctorSchedule"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Gắn lại các khung giờ đã có: cùng bác sĩ, cùng thứ trong tuần, nằm trọn trong ca mẫu đang bật.
UPDATE "DoctorTimeSlot" AS s
SET "scheduleId" = sc."id"
FROM "DoctorSchedule" AS sc
WHERE sc."doctorId" = s."doctorId"
  AND sc."isActive" = true
  AND sc."dayOfWeek" = EXTRACT(DOW FROM s."date")::int
  AND s."startTime" >= sc."startTime"
  AND s."endTime" <= sc."endTime";
