-- Trợ lý ảo không còn nhận số điện thoại khách (đăng nhập chỉ bằng email; cột luôn trống).
ALTER TABLE "ChatbotLog" DROP COLUMN "guestPhone";
ALTER TABLE "ChatbotSession" DROP COLUMN "guestPhone";

-- Trạng thái sự kiện outbox: chuỗi tự do -> kiểu liệt kê, chặn giá trị lạ ngay trong cơ sở dữ liệu.
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');
ALTER TABLE "OutboxEvent" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "OutboxEvent" ALTER COLUMN "status" TYPE "OutboxEventStatus" USING ("status"::"OutboxEventStatus");
ALTER TABLE "OutboxEvent" ALTER COLUMN "status" SET DEFAULT 'PENDING';
