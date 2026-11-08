-- AlterTable: theo dõi yêu cầu hoàn tiền gửi VNPAY (cột nullable, không ảnh hưởng dữ liệu cũ)
ALTER TABLE "Invoice" ADD COLUMN "refundRequestId" TEXT,
ADD COLUMN "refundAttemptedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_refundRequestId_key" ON "Invoice"("refundRequestId");
