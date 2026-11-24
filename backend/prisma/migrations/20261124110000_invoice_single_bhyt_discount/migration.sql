-- Tiền BHYT giảm trừ chỉ còn một cột: insuranceDiscountAmount luôn được ghi bằng bhytDiscount nên bỏ.
ALTER TABLE "Invoice" DROP COLUMN "insuranceDiscountAmount";
