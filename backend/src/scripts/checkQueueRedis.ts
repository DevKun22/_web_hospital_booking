import "dotenv/config";
import { Redis } from "ioredis";

import { getRedisConnectionOptions } from "../queues/redis.js";

const redis = new Redis({
  ...getRedisConnectionOptions(),
  lazyConnect: true,
  connectTimeout: 5_000,
});

try {
  await redis.connect();
  const memoryInfo = await redis.info("memory");
  const policy =
    memoryInfo
      .split(/\r?\n/)
      .find((line: string) => line.startsWith("maxmemory_policy:"))
      ?.split(":", 2)[1]
      ?.trim() || "unknown";

  console.log(`[QUEUE_REDIS_CHECK] maxmemory-policy=${policy}`);
  if (policy !== "noeviction") {
    throw new Error(
      `Queue Redis must use maxmemory-policy=noeviction (current: ${policy}).`,
    );
  }
} finally {
  await redis.quit().catch(() => redis.disconnect());
}
