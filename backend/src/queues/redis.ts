export const resolveQueueRedisUrl = (env: NodeJS.ProcessEnv = process.env) =>
  env.QUEUE_REDIS_URL?.trim() || env.REDIS_URL?.trim() || "";

export const hasRedisUrl = (env: NodeJS.ProcessEnv = process.env) =>
  Boolean(resolveQueueRedisUrl(env));

const getRedisUrl = () => {
  const redisUrl = resolveQueueRedisUrl();

  if (!redisUrl) {
    throw new Error("QUEUE_REDIS_URL or REDIS_URL is missing");
  }

  if (redisUrl.startsWith("http://") || redisUrl.startsWith("https://")) {
    throw new Error(
      "QUEUE_REDIS_URL/REDIS_URL must be a Redis TCP URL, not the Upstash REST URL",
    );
  }

  if (!redisUrl.startsWith("redis://") && !redisUrl.startsWith("rediss://")) {
    throw new Error(
      "QUEUE_REDIS_URL/REDIS_URL must start with redis:// or rediss://",
    );
  }

  return redisUrl;
};

export const getRedisConnectionOptions = () => {
  const redisUrl = new URL(getRedisUrl());
  const db = redisUrl.pathname ? Number(redisUrl.pathname.slice(1)) : 0;

  return {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    username: redisUrl.username
      ? decodeURIComponent(redisUrl.username)
      : undefined,
    password: redisUrl.password
      ? decodeURIComponent(redisUrl.password)
      : undefined,
    db: Number.isFinite(db) ? db : 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: redisUrl.protocol === "rediss:" ? {} : undefined,
  };
};

// Gói Redis miễn phí (Upstash) giới hạn số lệnh mỗi tháng. Worker BullMQ rảnh vẫn hỏi Redis đều đặn
// (mặc định 5 giây một lần và kiểm tra job treo mỗi 30 giây; ở đây là 60 giây và 5 phút), đủ để vượt hạn mức nếu API chạy liên tục.
// Job mới vẫn được nhận ngay (worker bị đánh thức khi có job), nên kéo dài các chu kỳ này chỉ giảm lệnh thừa.
export const idleRedisOptions = {
  drainDelay: Math.max(Number(process.env.BULLMQ_DRAIN_DELAY_SECONDS) || 60, 5),
  stalledInterval: Math.max(Number(process.env.BULLMQ_STALLED_INTERVAL_MS) || 300_000, 30_000),
};
