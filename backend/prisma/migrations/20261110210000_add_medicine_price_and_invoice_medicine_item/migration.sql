-- Giá bán thuốc và dòng tiền thuốc trên hóa đơn.
ALTER TABLE "Medicine" ADD COLUMN "unitPrice" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Medicine" ADD CONSTRAINT "Medicine_unitPrice_nonnegative" CHECK ("unitPrice" >= 0);
ALTER TYPE "InvoiceItemType" ADD VALUE IF NOT EXISTS 'MEDICINE';
