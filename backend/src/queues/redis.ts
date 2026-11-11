import {
  getQueueRedisConnectionOptions,
  hasQueueRedisUrl,
  resolveQueueRedisUrl,
} from "../config/redis.js";

export { resolveQueueRedisUrl };
export const hasRedisUrl = hasQueueRedisUrl;
export const getRedisConnectionOptions = getQueueRedisConnectionOptions;

// Gói Redis miễn phí (Upstash) giới hạn số lệnh mỗi tháng. Worker BullMQ rảnh vẫn hỏi Redis đều đặn
// (mặc định 5 giây một lần và kiểm tra job treo mỗi 30 giây; ở đây là 60 giây và 5 phút), đủ để vượt hạn mức nếu API chạy liên tục.
// Job mới vẫn được nhận ngay (worker bị đánh thức khi có job), nên kéo dài các chu kỳ này chỉ giảm lệnh thừa.
export const idleRedisOptions = {
  drainDelay: Math.max(Number(process.env.BULLMQ_DRAIN_DELAY_SECONDS) || 60, 5),
  stalledInterval: Math.max(
    Number(process.env.BULLMQ_STALLED_INTERVAL_MS) || 300_000,
    30_000,
  ),
};
