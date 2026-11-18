-- Gộp bảng, tách dữ liệu nhạy cảm của lịch hẹn và cho phép nhiều đơn thuốc mỗi hồ sơ khám. Chuyển dữ liệu hiện có, không mất dòng nào
-- (trừ bộ đếm OTP ngắn hạn, vốn chỉ có ý nghĩa trong vài phút).
--   1. DashboardSession đổi tên AuthSession (phiên của cả bệnh nhân lẫn nhân sự).
--   2. OtpVerifyAttempt + DashboardLoginFailure gộp thành AuthAttempt (đích và IP lưu dạng băm).
--   3. SiteSetting + ChatbotSetting gộp thành AppSetting (scope SITE hoặc CHATBOT).
--   4. Nhân khẩu, bảo hiểm, khai báo sức khỏe của Appointment tách sang AppointmentPatientInfo (1-1, xóa lan).
--   5. AppointmentLog gộp vào AuditLog (targetType = APPOINTMENT); các dòng cũ được chuyển sang.
--   6. Prescription từ 1-1 thành 1-N (đơn bổ sung): mỗi hồ sơ tối đa một đơn nháp; dòng thuốc ngoài danh mục bắt buộc là mua ngoài.
-- Mã backend cần đổi theo: xem docs/toi-uu-co-so-du-lieu/so-anh-huong-ma-nguon.md.

-- ===== 1. DashboardSession -> AuthSession =====
ALTER TABLE "DashboardSession" RENAME TO "AuthSession";
ALTER TABLE "AuthSession" RENAME CONSTRAINT "DashboardSession_pkey" TO "AuthSession_pkey";
ALTER TABLE "AuthSession" RENAME CONSTRAINT "DashboardSession_userId_fkey" TO "AuthSession_userId_fkey";
ALTER INDEX "DashboardSession_refreshTokenHash_key" RENAME TO "AuthSession_refreshTokenHash_key";
ALTER INDEX "DashboardSession_tokenFamilyId_key" RENAME TO "AuthSession_tokenFamilyId_key";
ALTER INDEX "DashboardSession_pushToken_key" RENAME TO "AuthSession_pushToken_key";
ALTER INDEX "DashboardSession_userId_kind_revokedAt_idx" RENAME TO "AuthSession_userId_kind_revokedAt_idx";
ALTER INDEX "DashboardSession_expiresAt_idx" RENAME TO "AuthSession_expiresAt_idx";

-- ===== 2. AuthAttempt =====
CREATE TYPE "AuthAttemptKind" AS ENUM ('OTP_VERIFY', 'DASHBOARD_LOGIN');

CREATE TABLE "AuthAttempt" (
    "id" TEXT NOT NULL,
    "kind" "AuthAttemptKind" NOT NULL,
    "targetKey" TEXT NOT NULL,
    "ipKey" TEXT,
    "purpose" "OtpPurpose",
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthAttempt_kind_targetKey_createdAt_idx" ON "AuthAttempt"("kind", "targetKey", "createdAt");
CREATE INDEX "AuthAttempt_kind_ipKey_createdAt_idx" ON "AuthAttempt"("kind", "ipKey", "createdAt");

-- Giữ lại lượt đăng nhập thất bại gần đây (đã là băm HMAC) để không xóa bộ đếm chống dò mật khẩu đang chạy.
-- Lượt nhập sai OTP lưu email dạng rõ nên không chuyển sang: bộ đếm này chỉ sống vài phút.
INSERT INTO "AuthAttempt" ("id", "kind", "targetKey", "ipKey", "success", "createdAt")
SELECT "id", 'DASHBOARD_LOGIN', "targetHash", "ipHash", false, "createdAt" FROM "DashboardLoginFailure";

DROP TABLE "OtpVerifyAttempt";
DROP TABLE "DashboardLoginFailure";

-- ===== 3. AppSetting =====
CREATE TYPE "SettingScope" AS ENUM ('SITE', 'CHATBOT');

CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL,
    "scope" "SettingScope" NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppSetting_scope_key_key" ON "AppSetting"("scope", "key");

INSERT INTO "AppSetting" ("id", "scope", "key", "value", "description", "isActive", "createdAt", "updatedAt")
SELECT "id", 'SITE', "key", "value", "description", "isActive", "createdAt", "updatedAt" FROM "SiteSetting";
INSERT INTO "AppSetting" ("id", "scope", "key", "value", "description", "isActive", "createdAt", "updatedAt")
SELECT "id", 'CHATBOT', "key", "value", "description", "isActive", "createdAt", "updatedAt" FROM "ChatbotSetting";

DROP TABLE "SiteSetting";
DROP TABLE "ChatbotSetting";

-- ===== 4. AppointmentPatientInfo =====
CREATE TABLE "AppointmentPatientInfo" (
    "appointmentId" TEXT NOT NULL,
    "gender" "Gender",
    "dateOfBirth" TIMESTAMP(3),
    "address" TEXT,
    "cccd" TEXT,
    "hasBHYT" BOOLEAN NOT NULL DEFAULT false,
    "healthInsuranceCode" TEXT,
    "registeredHospital" TEXT,
    "allergies" TEXT,
    "medicalHistory" TEXT,
    "familyHistory" TEXT,
    "healthConsentAt" TIMESTAMP(3),
    "healthConsentVersion" TEXT,

    CONSTRAINT "AppointmentPatientInfo_pkey" PRIMARY KEY ("appointmentId")
);

ALTER TABLE "AppointmentPatientInfo" ADD CONSTRAINT "AppointmentPatientInfo_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mỗi lịch hẹn luôn có đúng một dòng thông tin người khám.
INSERT INTO "AppointmentPatientInfo" (
    "appointmentId", "gender", "dateOfBirth", "address", "cccd", "hasBHYT", "healthInsuranceCode", "registeredHospital",
    "allergies", "medicalHistory", "familyHistory", "healthConsentAt", "healthConsentVersion"
)
SELECT "id", "patientGender", "patientDateOfBirth", "patientAddress", "patientCccd", "hasBHYT", "healthInsuranceCode", "registeredHospital",
    "allergies", "medicalHistory", "familyHistory", "healthConsentAt", "healthConsentVersion"
FROM "Appointment";

ALTER TABLE "Appointment" DROP COLUMN "patientGender",
DROP COLUMN "patientDateOfBirth",
DROP COLUMN "patientAddress",
DROP COLUMN "patientCccd",
DROP COLUMN "hasBHYT",
DROP COLUMN "healthInsuranceCode",
DROP COLUMN "registeredHospital",
DROP COLUMN "allergies",
DROP COLUMN "medicalHistory",
DROP COLUMN "familyHistory",
DROP COLUMN "healthConsentAt",
DROP COLUMN "healthConsentVersion";

-- ===== 5. AppointmentLog -> AuditLog =====
CREATE INDEX "AuditLog_targetType_targetId_createdAt_idx" ON "AuditLog"("targetType", "targetId", "createdAt");

-- Tên hành động chung chung (CONFIRMED, COMPLETED...) được thêm tiền tố APPOINTMENT_ để không lẫn với nhật ký truy cập khác;
-- các hành động đã có ngữ cảnh (MEDICAL_RESULT_*, PRESCRIPTION_*, INVOICE_*, PAYMENT_*) giữ nguyên. Các cột đổi giờ cũ và mới vào meta.
INSERT INTO "AuditLog" ("id", "actorId", "actorName", "actorRole", "action", "targetType", "targetId", "meta", "createdAt")
SELECT
    l."id",
    l."createdById",
    u."fullName",
    u."role"::text,
    CASE
        WHEN l."action"::text IN (
            'OTP_SENT', 'OTP_VERIFIED', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED_BY_PATIENT', 'CANCELLED_BY_DOCTOR',
            'CANCELLED_BY_ADMIN', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW'
        ) THEN 'APPOINTMENT_' || l."action"::text
        ELSE l."action"::text
    END,
    'APPOINTMENT',
    l."appointmentId",
    NULLIF(
        jsonb_strip_nulls(jsonb_build_object(
            'note', l."note",
            'oldDate', l."oldDate", 'oldStartTime', l."oldStartTime", 'oldEndTime', l."oldEndTime",
            'newDate', l."newDate", 'newStartTime', l."newStartTime", 'newEndTime', l."newEndTime"
        )),
        '{}'::jsonb
    ),
    l."createdAt"
FROM "AppointmentLog" l
LEFT JOIN "User" u ON u."id" = l."createdById";

DROP TABLE "AppointmentLog";
DROP TYPE "AppointmentLogAction";

-- ===== 6. Đơn thuốc 1-N (đơn bổ sung) =====
DROP INDEX "Prescription_medicalRecordId_key";
DROP INDEX "Prescription_appointmentId_key";
CREATE INDEX "Prescription_medicalRecordId_idx" ON "Prescription"("medicalRecordId");
CREATE INDEX "Prescription_appointmentId_idx" ON "Prescription"("appointmentId");

-- Ràng buộc viết tay (Prisma chưa khai báo được): mỗi hồ sơ khám tối đa MỘT đơn nháp cùng lúc.
CREATE UNIQUE INDEX "Prescription_one_draft_per_record" ON "Prescription"("medicalRecordId") WHERE "status" = 'DRAFT';

-- Dòng không thuộc danh mục kho (không có medicineId) chỉ có thể là thuốc mua ngoài: không trừ kho, không tính tiền.
UPDATE "PrescriptionItem" SET "fulfillmentStatus" = 'OUTSIDE' WHERE "medicineId" IS NULL AND "fulfillmentStatus" <> 'OUTSIDE';
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_stock_item_has_medicine"
    CHECK ("medicineId" IS NOT NULL OR "fulfillmentStatus" = 'OUTSIDE');
