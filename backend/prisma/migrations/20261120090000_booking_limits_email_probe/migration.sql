-- Đặt lịch bằng email không dùng được: ghi lượt dò theo IP để chặn dò email hàng loạt.
ALTER TYPE "AuthAttemptKind" ADD VALUE IF NOT EXISTS 'BOOKING_EMAIL_PROBE';
