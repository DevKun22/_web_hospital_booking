-- Lô thuốc có hạn dùng cho kho thuốc.
--   * Bảng mới StockBatch: mỗi lô có số lô, hạn dùng, số nhập và số còn lại.
--   * StockMovement.batchId (tùy chọn): dòng sổ kho tác động vào lô nào.
-- Tồn hiện có không bị đổi: phần chưa gắn lô vẫn nằm trong Medicine.stockQuantity.

-- CreateTable
CREATE TABLE "StockBatch" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" DATE NOT NULL,
    "receivedQuantity" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBatch_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StockBatch_quantity_check" CHECK ("quantity" >= 0),
    CONSTRAINT "StockBatch_receivedQuantity_check" CHECK ("receivedQuantity" > 0)
);

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "batchId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "StockBatch_medicineId_batchNumber_key" ON "StockBatch"("medicineId", "batchNumber");

-- CreateIndex
CREATE INDEX "StockBatch_medicineId_expiryDate_idx" ON "StockBatch"("medicineId", "expiryDate");

-- CreateIndex
CREATE INDEX "StockBatch_expiryDate_idx" ON "StockBatch"("expiryDate");

-- CreateIndex
CREATE INDEX "StockMovement_batchId_idx" ON "StockMovement"("batchId");

-- AddForeignKey
ALTER TABLE "StockBatch" ADD CONSTRAINT "StockBatch_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "StockBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
