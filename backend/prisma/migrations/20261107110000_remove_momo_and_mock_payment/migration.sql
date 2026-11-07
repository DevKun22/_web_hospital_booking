-- Chỉ còn VNPay là cổng thanh toán online: gỡ MOCK và MOMO khỏi enum
-- PaymentProvider, và gỡ MOMO khỏi enum PaymentMethod.
--
-- Migration KHÔNG xóa hay sửa dữ liệu. Nếu còn bản ghi dùng các giá trị sắp bị
-- gỡ (thường là dữ liệu demo từ seed hoặc giao dịch thử), migration dừng lại với
-- thông báo rõ ràng để người vận hành tự quyết định cách xử lý:
--   * Giao dịch thử/demo: xóa các dòng PaymentTransaction có provider MOCK hoặc MOMO.
--   * Hóa đơn đã thu bằng MoMo: đổi paymentMethod sang OTHER (giữ nguyên paymentReference)
--     hoặc xử lý theo quy định kế toán của đơn vị.
-- Xem trước số lượng:
--   SELECT "provider", count(*) FROM "PaymentTransaction" GROUP BY 1;
--   SELECT "paymentMethod", count(*) FROM "Invoice" GROUP BY 1;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "PaymentTransaction" WHERE "provider"::text IN ('MOCK', 'MOMO')
  ) THEN
    RAISE EXCEPTION 'Còn giao dịch MOCK hoặc MOMO trong PaymentTransaction: xử lý dữ liệu này trước khi chạy migration';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Invoice" WHERE "paymentMethod"::text = 'MOMO'
  ) THEN
    RAISE EXCEPTION 'Còn hóa đơn có paymentMethod = MOMO: xử lý dữ liệu này trước khi chạy migration';
  END IF;
END $$;

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentMethod_new" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'VNPAY', 'OTHER');
ALTER TABLE "Invoice" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new" USING ("paymentMethod"::text::"PaymentMethod_new");
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "PaymentMethod_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentProvider_new" AS ENUM ('VNPAY');
ALTER TABLE "PaymentTransaction" ALTER COLUMN "provider" TYPE "PaymentProvider_new" USING ("provider"::text::"PaymentProvider_new");
ALTER TYPE "PaymentProvider" RENAME TO "PaymentProvider_old";
ALTER TYPE "PaymentProvider_new" RENAME TO "PaymentProvider";
DROP TYPE "PaymentProvider_old";
COMMIT;
