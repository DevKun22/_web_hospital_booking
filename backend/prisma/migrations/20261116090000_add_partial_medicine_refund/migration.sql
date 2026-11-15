-- Hoàn tiền thuốc một phần (dòng thuốc kho hết hàng hoặc người khám tự mua sau khi đã thanh toán).
-- Tiền được hoàn ở cổng thanh toán hoặc bằng tiền mặt; hệ thống chỉ ghi nhận để đối soát. Chỉ thêm cột có mặc định
-- hoặc cho phép null nên không đổi dữ liệu hiện có.
ALTER TABLE "Invoice" ADD COLUMN "refundedAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "InvoiceItem"
  ADD COLUMN "refundedAt" TIMESTAMP(3),
  ADD COLUMN "refundReference" TEXT;
