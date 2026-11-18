import { reportRedisAvailable, reportRedisUnavailable } from "../services/redisHealth.service.js";

// Bảo vệ đường đưa job vào hàng đợi (producer) khi Redis chậm, lỗi hoặc hết hạn mức lệnh.
//
// Vì sao cần: kết nối hàng đợi dùng maxRetriesPerRequest = null nên khi Redis không với tới được, `queue.add` treo cho
// đến khi nối lại được, và request đặt lịch/gửi OTP treo theo. Khi Redis báo hết hạn mức lệnh (gói miễn phí), mỗi lần
// thử cũng tốn thêm một lệnh. Chiến lược: giới hạn thời gian chờ, và sau một lần lỗi thì tạm không gọi Redis nữa
// (ngắt mạch) để request đi thẳng sang đường dự phòng (gửi OTP trực tiếp, lưới đối soát giải phóng lịch giữ chỗ).

const FAILURE_COOLDOWN_MS = 30_000;
// Hết hạn mức tháng thì thử lại sớm cũng vô ích; 10 phút đủ để phát hiện sớm khi hạn mức được nâng lên.
const QUOTA_COOLDOWN_MS = 10 * 60_000;
const QUOTA_ERROR_PATTERN = /max (daily )?requests limit|limit exceeded|quota/i;

export class QueueEnqueueTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Redis queue did not accept the job within ${timeoutMs}ms`);
    this.name = "QueueEnqueueTimeoutError";
  }
}

export const isQuotaError = (error: unknown) =>
  QUOTA_ERROR_PATTERN.test(error instanceof Error ? error.message : String(error));

let cooldownUntil = 0;

export const isQueueCoolingDown = (now: () => number = Date.now) => now() < cooldownUntil;

export const resetQueueGuard = () => {
  cooldownUntil = 0;
};

type GuardOptions = {
  timeoutMs: number;
  now?: () => number;
};

// Trả về `false` khi đang ngắt mạch (không gọi Redis), ngược lại trả kết quả của `run`. Lỗi và quá hạn được ném lại
// cho nơi gọi xử lý đường dự phòng, sau khi đã bật ngắt mạch.
export const guardedEnqueue = async <T>(
  run: () => Promise<T>,
  options: GuardOptions,
): Promise<T | false> => {
  const now = options.now ?? Date.now;
  if (now() < cooldownUntil) return false;

  let timer: NodeJS.Timeout | undefined;
  try {
    const pending = run();
    // Nếu quá hạn thắng cuộc đua thì lời hứa gốc vẫn chạy tiếp; chặn việc nó từ chối muộn thành lỗi không ai bắt.
    pending.catch(() => undefined);
    const result = await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new QueueEnqueueTimeoutError(options.timeoutMs)),
          options.timeoutMs,
        );
      }),
    ]);
    reportRedisAvailable("queue", "enqueue");
    return result;
  } catch (error) {
    cooldownUntil = now() + (isQuotaError(error) ? QUOTA_COOLDOWN_MS : FAILURE_COOLDOWN_MS);
    reportRedisUnavailable("queue", "enqueue", error);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
};
