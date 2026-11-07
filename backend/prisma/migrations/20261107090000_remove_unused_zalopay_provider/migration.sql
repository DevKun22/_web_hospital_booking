-- Gỡ ZALOPAY khỏi enum PaymentProvider: hệ thống chưa bao giờ có adapter cho
-- nhà cung cấp này (chỉ có MOCK, MOMO, VNPAY).
--
-- Dừng sớm với thông báo rõ ràng nếu còn giao dịch dùng giá trị này, thay vì để
-- lệnh chuyển kiểu bên dưới báo lỗi khó hiểu. Migration không xóa hay sửa dữ liệu.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "PaymentTransaction" WHERE "provider"::text = 'ZALOPAY'
  ) THEN
    RAISE EXCEPTION 'Còn giao dịch ZALOPAY trong PaymentTransaction: xử lý dữ liệu này trước khi chạy migration';
  END IF;
END $$;

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentProvider_new" AS ENUM ('MOCK', 'VNPAY', 'MOMO');
ALTER TABLE "PaymentTransaction" ALTER COLUMN "provider" TYPE "PaymentProvider_new" USING ("provider"::text::"PaymentProvider_new");
ALTER TYPE "PaymentProvider" RENAME TO "PaymentProvider_old";
ALTER TYPE "PaymentProvider_new" RENAME TO "PaymentProvider";
DROP TYPE "PaymentProvider_old";
COMMIT;
