-- Tạo index mới trước để các truy vấn nóng luôn có index hỗ trợ trong lúc triển khai.
CREATE INDEX "DoctorTimeSlot_status_isActive_date_startTime_idx"
ON "DoctorTimeSlot"("status", "isActive", "date", "startTime");

CREATE INDEX "Appointment_doctorId_appointmentDate_idx"
ON "Appointment"("doctorId", "appointmentDate");

CREATE INDEX "Appointment_status_appointmentDate_idx"
ON "Appointment"("status", "appointmentDate");

CREATE INDEX "Appointment_status_createdAt_idx"
ON "Appointment"("status", "createdAt");

-- Các index đơn bên dưới đã được unique/composite index mới bao phủ theo tiền tố trái.
DROP INDEX "DoctorTimeSlot_doctorId_idx";
DROP INDEX "DoctorTimeSlot_status_idx";
DROP INDEX "Appointment_doctorId_idx";
DROP INDEX "Appointment_status_idx";
