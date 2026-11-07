-- Gộp tra cứu public vào cổng bệnh nhân, gộp hai bảng FAQ,
-- bỏ Search Analytics và Consultation Request.

-- 1. FAQ: tạo bảng hợp nhất và chuyển dữ liệu từ PublicFAQ + ChatbotFAQ.
CREATE TABLE "FAQ" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "showOnWeb" BOOLEAN NOT NULL DEFAULT true,
    "useInChatbot" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FAQ_pkey" PRIMARY KEY ("id")
);

INSERT INTO "FAQ" ("id", "question", "answer", "category", "keywords", "order", "showOnWeb", "useInChatbot", "isActive", "createdAt", "updatedAt")
SELECT "id", "question", "answer", "category", ARRAY[]::TEXT[], "order", true, false, "isActive", "createdAt", "updatedAt"
FROM "PublicFAQ";

INSERT INTO "FAQ" ("id", "question", "answer", "category", "keywords", "order", "showOnWeb", "useInChatbot", "isActive", "createdAt", "updatedAt")
SELECT "id", "question", "answer", NULL, "keywords", 0, false, true, "isActive", "createdAt", "updatedAt"
FROM "ChatbotFAQ"
ON CONFLICT ("id") DO NOTHING;

CREATE INDEX "FAQ_isActive_showOnWeb_order_idx" ON "FAQ"("isActive", "showOnWeb", "order");
CREATE INDEX "FAQ_isActive_useInChatbot_idx" ON "FAQ"("isActive", "useInChatbot");
CREATE INDEX "FAQ_category_idx" ON "FAQ"("category");

DROP TABLE "PublicFAQ";
DROP TABLE "ChatbotFAQ";

-- 2. Bỏ các tính năng phụ.
DROP TABLE "SearchAnalyticsLog";
DROP TABLE "ConsultationRequest";
DROP TYPE "ConsultationStatus";

-- 3. OTP: bỏ các mục đích của luồng tra cứu public cũ. Bản ghi OTP chỉ có
-- giá trị ngắn hạn nên xóa trước khi thu hẹp enum.
DELETE FROM "OtpCode" WHERE "purpose" IN ('LOOKUP_APPOINTMENT', 'CANCEL_APPOINTMENT', 'REVIEW_APPOINTMENT', 'LOOKUP_RESULT');
DELETE FROM "OtpVerifyAttempt" WHERE "purpose" IN ('LOOKUP_APPOINTMENT', 'CANCEL_APPOINTMENT', 'REVIEW_APPOINTMENT', 'LOOKUP_RESULT');
DELETE FROM "OtpSecurityBlock" WHERE "purpose" IN ('LOOKUP_APPOINTMENT', 'CANCEL_APPOINTMENT', 'REVIEW_APPOINTMENT', 'LOOKUP_RESULT');
DELETE FROM "DashboardLoginChallenge" WHERE "purpose" IN ('LOOKUP_APPOINTMENT', 'CANCEL_APPOINTMENT', 'REVIEW_APPOINTMENT', 'LOOKUP_RESULT');

CREATE TYPE "OtpPurpose_new" AS ENUM ('BOOK_APPOINTMENT', 'PATIENT_PORTAL_LOGIN', 'ADMIN_LOGIN', 'DOCTOR_LOGIN', 'STAFF_LOGIN');
ALTER TABLE "OtpCode" ALTER COLUMN "purpose" TYPE "OtpPurpose_new" USING ("purpose"::text::"OtpPurpose_new");
ALTER TABLE "OtpVerifyAttempt" ALTER COLUMN "purpose" TYPE "OtpPurpose_new" USING ("purpose"::text::"OtpPurpose_new");
ALTER TABLE "OtpSecurityBlock" ALTER COLUMN "purpose" TYPE "OtpPurpose_new" USING ("purpose"::text::"OtpPurpose_new");
ALTER TABLE "DashboardLoginChallenge" ALTER COLUMN "purpose" TYPE "OtpPurpose_new" USING ("purpose"::text::"OtpPurpose_new");
ALTER TYPE "OtpPurpose" RENAME TO "OtpPurpose_old";
ALTER TYPE "OtpPurpose_new" RENAME TO "OtpPurpose";
DROP TYPE "OtpPurpose_old";
