-- Chuẩn bị dữ liệu cho phân quyền theo vai trò, kho thuốc và các bổ sung vận hành.
--
-- Chỉ thêm mới, không xóa hay sửa dữ liệu hiện có:
--   * Role: thêm PHARMACIST; OtpPurpose: thêm PHARMACIST_LOGIN.
--   * AppointmentLogAction: thêm 6 hành động nhật ký thao tác lâm sàng.
--   * Appointment: thêm healthConsentAt, healthConsentVersion (đồng ý dữ liệu sức khỏe).
--   * Prescription và PrescriptionItem: thêm trạng thái và số lượng đã cấp phát.
--   * Bảng mới Medicine (danh mục kiêm tồn kho) và StockMovement (sổ kho).
--
-- Đơn thuốc cũ nhận dispenseStatus = NOT_DISPENSED; dòng thuốc cũ không có
-- medicineId nên được coi là thuốc mua ngoài, không đi qua kho.

-- CreateEnum
CREATE TYPE "DispenseStatus" AS ENUM ('NOT_DISPENSED', 'DISPENSED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'DISPENSE', 'ADJUSTMENT');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PHARMACIST';

-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'PHARMACIST_LOGIN';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AppointmentLogAction" ADD VALUE 'MEDICAL_RESULT_UPDATED';
ALTER TYPE "AppointmentLogAction" ADD VALUE 'MEDICAL_RESULT_PUBLISHED';
ALTER TYPE "AppointmentLogAction" ADD VALUE 'LAB_RESULT_CHANGED';
ALTER TYPE "AppointmentLogAction" ADD VALUE 'PRESCRIPTION_ISSUED';
ALTER TYPE "AppointmentLogAction" ADD VALUE 'PRESCRIPTION_CANCELLED';
ALTER TYPE "AppointmentLogAction" ADD VALUE 'PRESCRIPTION_DISPENSED';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "healthConsentAt" TIMESTAMP(3),
ADD COLUMN     "healthConsentVersion" TEXT;

-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN     "dispenseNote" TEXT,
ADD COLUMN     "dispenseStatus" "DispenseStatus" NOT NULL DEFAULT 'NOT_DISPENSED',
ADD COLUMN     "dispensedAt" TIMESTAMP(3),
ADD COLUMN     "dispensedById" TEXT;

-- AlterTable
ALTER TABLE "PrescriptionItem" ADD COLUMN     "dispensedQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "medicineId" TEXT;

-- CreateTable
CREATE TABLE "Medicine" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activeIngredient" TEXT,
    "strength" TEXT,
    "dosageForm" TEXT,
    "unit" TEXT NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medicine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "prescriptionItemId" TEXT,
    "actorId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Medicine_code_key" ON "Medicine"("code");

-- CreateIndex
CREATE INDEX "Medicine_name_idx" ON "Medicine"("name");

-- CreateIndex
CREATE INDEX "Medicine_isActive_idx" ON "Medicine"("isActive");

-- CreateIndex
CREATE INDEX "StockMovement_medicineId_createdAt_idx" ON "StockMovement"("medicineId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_prescriptionItemId_idx" ON "StockMovement"("prescriptionItemId");

-- CreateIndex
CREATE INDEX "StockMovement_actorId_idx" ON "StockMovement"("actorId");

-- CreateIndex
CREATE INDEX "Prescription_status_dispenseStatus_issuedAt_idx" ON "Prescription"("status", "dispenseStatus", "issuedAt");

-- CreateIndex
CREATE INDEX "PrescriptionItem_medicineId_idx" ON "PrescriptionItem"("medicineId");

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_dispensedById_fkey" FOREIGN KEY ("dispensedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_prescriptionItemId_fkey" FOREIGN KEY ("prescriptionItemId") REFERENCES "PrescriptionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===========================================================================
-- Ràng buộc viết tay (Prisma chưa khai báo được CHECK và trigger)
-- ===========================================================================

-- Tồn kho và ngưỡng cảnh báo không bao giờ âm. Ràng buộc nằm ở cơ sở dữ liệu
-- để hai dược sĩ cấp phát song song hay một lỗi code cũng không làm tồn âm.
ALTER TABLE "Medicine"
  ADD CONSTRAINT "Medicine_stockQuantity_nonnegative" CHECK ("stockQuantity" >= 0),
  ADD CONSTRAINT "Medicine_minStock_nonnegative" CHECK ("minStock" >= 0);

-- Mỗi dòng sổ kho phải nhất quán với loại của nó:
--   RECEIPT: số lượng dương; DISPENSE: số lượng âm và gắn với dòng thuốc của đơn;
--   ADJUSTMENT: số lượng có dấu khác 0 và bắt buộc có lý do.
ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_quantity_nonzero" CHECK ("quantity" <> 0),
  ADD CONSTRAINT "StockMovement_balanceAfter_nonnegative" CHECK ("balanceAfter" >= 0),
  ADD CONSTRAINT "StockMovement_sign_matches_type" CHECK (
    ("type" = 'RECEIPT' AND "quantity" > 0)
    OR ("type" = 'DISPENSE' AND "quantity" < 0)
    OR "type" = 'ADJUSTMENT'
  ),
  ADD CONSTRAINT "StockMovement_dispense_has_item" CHECK (
    "type" <> 'DISPENSE' OR "prescriptionItemId" IS NOT NULL
  ),
  ADD CONSTRAINT "StockMovement_adjustment_has_reason" CHECK (
    "type" <> 'ADJUSTMENT' OR ("reason" IS NOT NULL AND length(btrim("reason")) > 0)
  );

-- Số lượng đã cấp của một dòng thuốc không âm.
ALTER TABLE "PrescriptionItem"
  ADD CONSTRAINT "PrescriptionItem_dispensedQuantity_nonnegative" CHECK ("dispensedQuantity" >= 0);

-- Sổ kho chỉ thêm dòng: chặn sửa và xóa ở cấp cơ sở dữ liệu. Sửa sai bằng dòng
-- ADJUSTMENT đối ứng. TRUNCATE không bị chặn nên môi trường test vẫn dọn được dữ liệu.
CREATE FUNCTION "stock_movement_is_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'StockMovement là sổ kho chỉ thêm dòng: không được % dòng đã ghi', lower(TG_OP);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StockMovement_append_only"
  BEFORE UPDATE OR DELETE ON "StockMovement"
  FOR EACH ROW EXECUTE FUNCTION "stock_movement_is_append_only"();
