-- Bỏ 13 chỉ mục dư và thêm chỉ mục cho 5 khóa ngoại chưa có. Không đổi dữ liệu.
-- Chỉ mục dư: trùng chỉ mục UNIQUE của cùng cột, hoặc là tiền tố của một chỉ mục ghép đã có nên chỉ mục ghép phục vụ được
-- cùng truy vấn. Bỏ đi chỉ giảm chi phí ghi và dung lượng, không làm chậm truy vấn đọc.
DROP INDEX IF EXISTS "Appointment_patientId_idx";
DROP INDEX IF EXISTS "DashboardSession_userId_idx";
DROP INDEX IF EXISTS "Invoice_barcode_idx";
DROP INDEX IF EXISTS "Invoice_invoiceCode_idx";
DROP INDEX IF EXISTS "Invoice_patientId_idx";
DROP INDEX IF EXISTS "MedicalRecord_patientId_idx";
DROP INDEX IF EXISTS "MedicalRecord_recordCode_idx";
DROP INDEX IF EXISTS "PaymentTransaction_transactionCode_idx";
DROP INDEX IF EXISTS "Prescription_patientId_idx";
DROP INDEX IF EXISTS "Prescription_prescriptionCode_idx";
DROP INDEX IF EXISTS "Prescription_status_idx";
DROP INDEX IF EXISTS "User_email_idx";
DROP INDEX IF EXISTS "User_phone_idx";

-- Khóa ngoại chưa có chỉ mục (cố vấn hiệu năng của Supabase): xóa hoặc tra theo các cột này không phải quét cả bảng.
CREATE INDEX IF NOT EXISTS "Appointment_packageId_idx" ON "Appointment"("packageId");
CREATE INDEX IF NOT EXISTS "OtpCode_userId_idx" ON "OtpCode"("userId");
CREATE INDEX IF NOT EXISTS "Prescription_dispensedById_idx" ON "Prescription"("dispensedById");
CREATE INDEX IF NOT EXISTS "ScheduleChangeRequest_reviewedById_idx" ON "ScheduleChangeRequest"("reviewedById");
CREATE INDEX IF NOT EXISTS "ScheduleChangeRequest_scheduleId_idx" ON "ScheduleChangeRequest"("scheduleId");
