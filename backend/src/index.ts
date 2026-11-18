import "dotenv/config";

import { isProductionLike, validateRuntimeEnvironment } from "./config/environment.js";
import { configureHttpServer } from "./config/httpServer.js";
import { getRuntimeConfig } from "./config/runtimeConfig.js";
import { logger } from "./observability/logger.js";
import { installRedisErrorGuard } from "./observability/redisErrorGuard.js";

// Redis chỉ phục vụ việc nền: lỗi từ Redis không được làm sập cả API (xem redisErrorGuard).
installRedisErrorGuard();
validateRuntimeEnvironment();

const [
  { createApp },
  { prisma },
  { startRuntimeMetrics, stopRuntimeMetrics },
] = await Promise.all([
  import("./app.js"),
  import("./config/prisma.js"),
  import("./observability/runtimeMetrics.js"),
]);
const { closeRbacInvalidation } = await import(
  "./services/rbacInvalidation.service.js"
);
const { closeCacheRedis } = await import("./services/cacheRedis.service.js");

const app = createApp();

const PORT = getRuntimeConfig().server.port;

const server = app.listen(PORT, () => {
  logger.info(`Server running on port http://localhost:${PORT}`);
});
configureHttpServer(server);
startRuntimeMetrics("api");

// Gói free chỉ có một tiến trình: cho phép chạy worker OTP/lịch hẹn ngay tại đây.
const { parseInlineWorkers, startInlineWorkers } = await import("./workers/inline.js");
// Cấu hình sai thì dừng ngay lúc khởi động; còn lỗi khi chạy worker không được làm sập API.
if (isProductionLike()) parseInlineWorkers(getRuntimeConfig().workers.inline);
startInlineWorkers().catch((error) => {
  logger.error("[INLINE_WORKER] startup failed; API continues without background workers:", error);
});

const shutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully...`);

  server.close(async () => {
    stopRuntimeMetrics();
    await closeRbacInvalidation();
    closeCacheRedis();
    await prisma.$disconnect();
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Force shutdown after timeout");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
