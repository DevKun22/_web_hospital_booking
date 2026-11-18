-- Tối ưu cơ sở dữ liệu: OTP chỉ qua email, bỏ cột và index thừa, thêm index đúng truy vấn.
-- Cột bị bỏ và lý do:
--   OtpCode / OtpVerifyAttempt: phone, channel, target (chỉ còn email); OtpCode.isUsed, DashboardLoginChallenge.isUsed
--   (trùng với usedAt); Appointment.otpChannel; User.isPhoneVerified; maxPatients (luôn bằng 1); MedicalRecord.prescription
--   (trùng mô hình Prescription); bảng ScheduleChangeLog (chỉ có mã ghi, không có mã đọc).
-- Mã backend cần đổi theo: xem sổ ảnh hưởng trong thư mục docs/toi-uu-co-so-du-lieu.

-- Bù dữ liệu trước khi đặt NOT NULL.
-- Mã OTP và lượt nhập sai chỉ tồn tại vài phút: bỏ các dòng không có email (kênh SMS cũ).
DELETE FROM "OtpCode" WHERE "email" IS NULL;
DELETE FROM "OtpVerifyAttempt" WHERE "email" IS NULL;
-- Lịch hẹn đặt bằng số điện thoại chưa có email: lấy email của tài khoản đặt lịch (người nhận OTP).
UPDATE "Appointment" a
SET "patientEmail" = u."email"
FROM "User" u
WHERE a."patientId" = u."id" AND (a."patientEmail" IS NULL OR a."patientEmail" = '');

-- DropForeignKey
ALTER TABLE "ScheduleChangeLog" DROP CONSTRAINT "ScheduleChangeLog_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "ScheduleChangeLog" DROP CONSTRAINT "ScheduleChangeLog_changedById_fkey";

-- DropIndex
DROP INDEX "User_phone_key";

-- DropIndex
DROP INDEX "User_role_idx";

-- DropIndex
DROP INDEX "OtpCode_phone_idx";

-- DropIndex
DROP INDEX "OtpCode_email_idx";

-- DropIndex
DROP INDEX "OtpCode_target_idx";

-- DropIndex
DROP INDEX "OtpCode_channel_idx";

-- DropIndex
DROP INDEX "OtpCode_deliveryStatus_idx";

-- DropIndex
DROP INDEX "OtpCode_purpose_idx";

-- DropIndex
DROP INDEX "OtpCode_ipAddress_idx";

-- DropIndex
DROP INDEX "OtpSecurityBlock_targetType_target_idx";

-- DropIndex
DROP INDEX "OtpSecurityBlock_purpose_idx";

-- DropIndex
DROP INDEX "OtpSecurityBlock_blockedUntil_idx";

-- DropIndex
DROP INDEX "OtpVerifyAttempt_phone_purpose_createdAt_idx";

-- DropIndex
DROP INDEX "OtpVerifyAttempt_target_channel_purpose_createdAt_idx";

-- DropIndex
DROP INDEX "OtpVerifyAttempt_success_idx";

-- DropIndex
DROP INDEX "DashboardLoginChallenge_isUsed_idx";

-- DropIndex
DROP INDEX "DashboardSession_revokedAt_idx";

-- DropIndex
DROP INDEX "AuthRefreshToken_revokedAt_idx";

-- DropIndex
DROP INDEX "DoctorSchedule_dayOfWeek_idx";

-- DropIndex
DROP INDEX "ScheduleChangeRequest_reviewedById_idx";

-- DropIndex
DROP INDEX "Appointment_patientPhone_idx";

-- DropIndex
DROP INDEX "AppointmentLog_action_idx";

-- DropIndex
DROP INDEX "Review_doctorId_idx";

-- DropIndex
DROP INDEX "Review_isVisible_idx";

-- DropIndex
DROP INDEX "PrescriptionItem_sortOrder_idx";

-- DropIndex
DROP INDEX "Medicine_isActive_idx";

-- DropIndex
DROP INDEX "PaymentTransaction_provider_idx";

-- DropIndex
DROP INDEX "PaymentTransaction_status_idx";

-- DropIndex
DROP INDEX "PaymentTransaction_expiredAt_idx";

-- DropIndex
DROP INDEX "MediaAsset_isUsed_idx";

-- DropIndex
DROP INDEX "Article_authorId_idx";

-- DropIndex
DROP INDEX "Article_reviewedById_idx";

-- DropIndex
DROP INDEX "SiteSetting_isActive_idx";

-- DropIndex
DROP INDEX "Banner_position_idx";

-- DropIndex
DROP INDEX "Banner_isActive_idx";

-- DropIndex
DROP INDEX "Banner_order_idx";

-- DropIndex
DROP INDEX "ChatbotLog_guestPhone_idx";

-- DropIndex
DROP INDEX "ChatbotLog_intent_idx";

-- DropIndex
DROP INDEX "ChatKnowledgeChunk_sourceType_idx";

-- DropIndex
DROP INDEX "ChatbotSession_guestPhone_idx";

-- DropIndex
DROP INDEX "ChatbotSession_currentIntent_idx";

-- DropIndex
DROP INDEX "ChatbotSession_currentState_idx";

-- DropIndex
DROP INDEX "ChatbotSession_isActive_idx";

-- DropIndex
DROP INDEX "ChatbotSetting_isActive_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isPhoneVerified",
ALTER COLUMN "email" SET NOT NULL;

-- AlterTable
ALTER TABLE "OtpCode" DROP COLUMN "channel",
DROP COLUMN "isUsed",
DROP COLUMN "phone",
DROP COLUMN "target",
ALTER COLUMN "email" SET NOT NULL;

-- AlterTable
ALTER TABLE "OtpVerifyAttempt" DROP COLUMN "channel",
DROP COLUMN "phone",
DROP COLUMN "target",
ALTER COLUMN "email" SET NOT NULL;

-- AlterTable
ALTER TABLE "DashboardLoginChallenge" DROP COLUMN "isUsed";

-- AlterTable
ALTER TABLE "DoctorSchedule" DROP COLUMN "maxPatients";

-- AlterTable
ALTER TABLE "ScheduleChangeRequest" DROP COLUMN "maxPatients";

-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "otpChannel",
ALTER COLUMN "patientEmail" SET NOT NULL;

-- AlterTable
ALTER TABLE "MedicalRecord" DROP COLUMN "prescription";

-- DropTable
DROP TABLE "ScheduleChangeLog";

-- DropEnum
DROP TYPE "OtpChannel";

-- DropEnum
DROP TYPE "ScheduleChangeType";

-- CreateIndex
CREATE INDEX "OtpCode_email_purpose_createdAt_idx" ON "OtpCode"("email", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "OtpCode_ipAddress_createdAt_idx" ON "OtpCode"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "OtpSecurityBlock_targetType_target_blockedUntil_idx" ON "OtpSecurityBlock"("targetType", "target", "blockedUntil");

-- CreateIndex
CREATE INDEX "OtpVerifyAttempt_email_purpose_createdAt_idx" ON "OtpVerifyAttempt"("email", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "Review_doctorId_isVisible_idx" ON "Review"("doctorId", "isVisible");

-- CreateIndex
CREATE INDEX "PaymentTransaction_status_expiredAt_idx" ON "PaymentTransaction"("status", "expiredAt");

-- CreateIndex
CREATE INDEX "Banner_position_isActive_idx" ON "Banner"("position", "isActive");

-- CreateIndex
CREATE INDEX "ChatbotLog_createdAt_idx" ON "ChatbotLog"("createdAt");

-- Hàm trigger chỉ dùng hàm dựng sẵn: cố định search_path để tránh bị chiếm quyền qua schema khác.
ALTER FUNCTION "stock_movement_is_append_only"() SET search_path = '';
ALTER FUNCTION "audit_log_is_append_only"() SET search_path = '';
