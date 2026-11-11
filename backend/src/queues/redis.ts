import {
  getQueueRedisConnectionOptions,
  hasQueueRedisUrl,
  resolveQueueRedisUrl,
} from "../config/redis.js";
import { getRuntimeConfig } from "../config/runtimeConfig.js";

export { resolveQueueRedisUrl };
export const hasRedisUrl = hasQueueRedisUrl;
export const getRedisConnectionOptions = getQueueRedisConnectionOptions;

// Gói Redis miễn phí (Upstash) giới hạn số lệnh mỗi tháng. Worker BullMQ rảnh vẫn hỏi Redis đều đặn
// (mặc định 5 giây một lần và kiểm tra job treo mỗi 30 giây; ở đây là 60 giây và 5 phút), đủ để vượt hạn mức nếu API chạy liên tục.
// Job mới vẫn được nhận ngay (worker bị đánh thức khi có job), nên kéo dài các chu kỳ này chỉ giảm lệnh thừa.
export const idleRedisOptions = {
  drainDelay: getRuntimeConfig().bullmq.drainDelaySeconds,
  stalledInterval: Math.max(getRuntimeConfig().bullmq.stalledIntervalMs, 30_000),
};
