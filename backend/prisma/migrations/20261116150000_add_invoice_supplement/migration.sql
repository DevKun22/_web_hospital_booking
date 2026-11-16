-- Hóa đơn bổ sung tiền thuốc: tiền thuốc phát sinh sau khi hóa đơn chính đã thanh toán (đơn phát hành muộn). Thu tại quầy,
-- hóa đơn chính không bị sửa. Chỉ thêm bảng và kiểu mới nên không đổi dữ liệu hiện có.
CREATE TYPE "InvoiceSupplementStatus" AS ENUM ('UNPAID', 'PAID', 'CANCELLED');

CREATE TABLE "InvoiceSupplement" (
  "id" TEXT NOT NULL,
  "supplementCode" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" "InvoiceSupplementStatus" NOT NULL DEFAULT 'UNPAID',
  "paymentMethod" "PaymentMethod",
  "paymentReference" TEXT,
  "paidAt" TIMESTAMP(3),
  "collectedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceSupplement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceSupplementItem" (
  "id" TEXT NOT NULL,
  "supplementId" TEXT NOT NULL,
  "prescriptionItemId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceSupplementItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceSupplement_supplementCode_key" ON "InvoiceSupplement"("supplementCode");
CREATE INDEX "InvoiceSupplement_invoiceId_status_idx" ON "InvoiceSupplement"("invoiceId", "status");
CREATE UNIQUE INDEX "InvoiceSupplementItem_prescriptionItemId_key" ON "InvoiceSupplementItem"("prescriptionItemId");
CREATE INDEX "InvoiceSupplementItem_supplementId_idx" ON "InvoiceSupplementItem"("supplementId");

ALTER TABLE "InvoiceSupplement"
  ADD CONSTRAINT "InvoiceSupplement_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceSupplementItem"
  ADD CONSTRAINT "InvoiceSupplementItem_supplementId_fkey" FOREIGN KEY ("supplementId") REFERENCES "InvoiceSupplement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
