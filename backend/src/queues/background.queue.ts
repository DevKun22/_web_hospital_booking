import { Queue } from "bullmq";
import type { OtpPurpose } from "../../generated/prisma/enums.js";
import { getRuntimeConfig } from "../config/runtimeConfig.js";
import { reportRedisUnavailable } from "../services/redisHealth.service.js";
import { sealOtp } from "../utils/otpJobSeal.js";
import { guardedEnqueue } from "./queueGuard.js";
import { getRedisConnectionOptions, hasRedisUrl } from "./redis.js";

// Một hàng đợi, đúng hai loại job (việc định kỳ chạy trên cơ sở dữ liệu, xem maintenance.worker):
//  - send-otp: gửi OTP qua email, thử lại 3 lần giãn cách mũ, jobId chống trùng.
//  - expire-pending-otp: hẹn giờ giải phóng lịch giữ chỗ chưa xác thực OTP; cập nhật có điều kiện nên chạy lặp vẫn an toàn.
export const BACKGROUND_QUEUE_NAME = "background-jobs";

// Dữ liệu OTP nằm trong tiến trình gọi; riêng bản đưa vào Redis thì được niêm phong (không chữ rõ).
export type OtpDeliveryJobData = {
  otpCodeId: string;
  email: string;
  purpose: OtpPurpose;
  otp: string;
  expiresInSeconds: number;
};

export type SendOtpJobData = Omit<OtpDeliveryJobData, "otp"> & { sealedOtp: string };

export type BackgroundJobData =
  | ({ type: "SEND_OTP" } & SendOtpJobData)
  | { type: "EXPIRE_PENDING_OTP"; appointmentId: string };

let backgroundQueue: Queue<BackgroundJobData> | null = null;

export const getBackgroundQueue = () => {
  if (!backgroundQueue) {
    backgroundQueue = new Queue<BackgroundJobData>(BACKGROUND_QUEUE_NAME, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        // Job xong thì xóa ngay (không để dữ liệu OTP nằm lại); job lỗi giữ 24 giờ để điều tra.
        removeOnComplete: true,
        removeOnFail: { age: 24 * 60 * 60, count: 2_000 },
      },
    });
    // Không có bộ lắng nghe lỗi thì lỗi kết nối Redis có thể làm sập tiến trình.
    backgroundQueue.on("error", (error) => reportRedisUnavailable("queue", "background-queue", error));
  }

  return backgroundQueue;
};

export const enqueueOtpDeliveryJob = async (data: OtpDeliveryJobData) => {
  if (!hasRedisUrl()) return false;

  const { otp, ...rest } = data;
  // Redis chậm, lỗi hoặc hết hạn mức: trả về false (đang ngắt mạch) hoặc ném lỗi để nơi gọi gửi OTP trực tiếp.
  const added = await guardedEnqueue(
    () =>
      getBackgroundQueue().add(
        "send-otp",
        { type: "SEND_OTP", ...rest, sealedOtp: sealOtp(otp) },
        { jobId: "otp-" + data.otpCodeId },
      ),
    { timeoutMs: getRuntimeConfig().redis.enqueueTimeoutMs },
  );

  return added !== false;
};

export const enqueuePendingOtpExpiry = async (appointmentId: string, holdExpiresAt: Date) => {
  if (!hasRedisUrl()) return false;

  // Không để request đặt lịch treo khi Redis lỗi: quá hạn hoặc ngắt mạch thì bỏ qua job hẹn giờ, vòng bảo trì định kỳ
  // vẫn giải phóng khung giờ khi hết hạn giữ chỗ (chậm hơn tối đa một chu kỳ bảo trì).
  const added = await guardedEnqueue(
    () =>
      getBackgroundQueue().add(
        "expire-pending-otp",
        { type: "EXPIRE_PENDING_OTP", appointmentId },
        {
          jobId: "expire-pending-otp-" + appointmentId,
          delay: Math.max(holdExpiresAt.getTime() - Date.now(), 0),
          attempts: 5,
        },
      ),
    { timeoutMs: getRuntimeConfig().redis.enqueueTimeoutMs },
  );

  return added !== false;
};
