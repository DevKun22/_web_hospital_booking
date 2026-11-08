-- Thêm bản ghi đồng ý lưu thông tin sức khỏe cho hồ sơ người khám (nullable, không ảnh hưởng dữ liệu cũ).

-- AlterTable
ALTER TABLE "PatientProfile" ADD COLUMN     "healthConsentAt" TIMESTAMP(3),
ADD COLUMN     "healthConsentVersion" TEXT;
