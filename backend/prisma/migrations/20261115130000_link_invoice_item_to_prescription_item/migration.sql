-- Dòng tiền thuốc trên hóa đơn gắn với dòng đơn thuốc đã sinh ra nó, để đồng bộ lặp lại không tính tiền hai lần
-- và gỡ được dòng khi thuốc hết hàng hoặc người khám tự mua. Cột mới cho phép null; dòng cũ không gắn gì.
ALTER TABLE "InvoiceItem" ADD COLUMN "prescriptionItemId" TEXT;
CREATE INDEX "InvoiceItem_prescriptionItemId_idx" ON "InvoiceItem"("prescriptionItemId");
