-- Trạng thái xử lý từng dòng thuốc khi dược sĩ cấp: đã cấp, người khám tự mua, hết hàng.
-- Chỉ thêm cột mới có mặc định nên không đổi dữ liệu hiện có; phần dữ liệu cũ được gán trạng thái ở cuối.
CREATE TYPE "FulfillmentStatus" AS ENUM ('PENDING', 'DISPENSED', 'OUTSIDE', 'OUT_OF_STOCK');

ALTER TABLE "PrescriptionItem"
  ADD COLUMN "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "fulfillmentNote" TEXT;

-- Đơn đã cấp trước khi có cột này: dòng có thuốc kho và đã trừ kho là DISPENSED, dòng còn lại là thuốc người khám tự mua.
UPDATE "PrescriptionItem" AS item
SET "fulfillmentStatus" = CASE
  WHEN item."medicineId" IS NOT NULL AND item."dispensedQuantity" > 0 THEN 'DISPENSED'::"FulfillmentStatus"
  ELSE 'OUTSIDE'::"FulfillmentStatus"
END
FROM "Prescription" AS prescription
WHERE item."prescriptionId" = prescription.id
  AND prescription."dispenseStatus" = 'DISPENSED';
