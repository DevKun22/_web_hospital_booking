-- Thông báo nội bộ cho nhân sự (bác sĩ, lễ tân): lịch hẹn mới và yêu cầu đổi lịch.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_CREATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SCHEDULE_REQUEST_CREATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SCHEDULE_REQUEST_REVIEWED';
