import { logger } from "./logger.js";

// Worker BullMQ chạy ngay trong tiến trình API. Khi Redis lỗi (hết hạn mức, đứt kết nối) thư viện ioredis/BullMQ đôi khi phát
// lỗi ở nơi không ai lắng nghe (sự kiện "error" của kết nối đã đóng, lệnh đang chờ bị từ chối). Mặc định Node thoát với mã 1, kéo
// theo cả API (đặt lịch, đăng nhập) dù Redis chỉ phục vụ việc nền. Lưới an toàn này chỉ nuốt đúng lỗi xuất phát từ Redis và ghi
// log có giới hạn tần suất; mọi lỗi khác vẫn làm tiến trình thoát như trước để không che lỗi thật.

const REDIS_STACK_PATTERN = /node_modules[\\/](ioredis|bullmq|redis-parser)[\\/]/;
const REDIS_MESSAGE_PATTERN = /Connection is closed|max requests limit exceeded|ECONNRESET.*redis|READONLY|LOADING Redis/i;
const LOG_INTERVAL_MS = 30_000;

export const isRedisOriginatedError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  if (error.name === "ReplyError" || error.name === "MaxRetriesPerRequestError") return true;
  return REDIS_STACK_PATTERN.test(error.stack || "") || REDIS_MESSAGE_PATTERN.test(error.message);
};

let lastLogAt = 0;
let suppressed = 0;

export const handleProcessLevelError = (
  kind: "uncaughtException" | "unhandledRejection",
  error: unknown,
  options: { now?: () => number; exit?: (code: number) => void } = {},
) => {
  const now = options.now ?? Date.now;
  const exit = options.exit ?? ((code: number) => process.exit(code));

  if (isRedisOriginatedError(error)) {
    if (now() - lastLogAt >= LOG_INTERVAL_MS) {
      const suffix = suppressed > 0 ? ` (đã gộp thêm ${suppressed} lỗi tương tự)` : "";
      logger.error(`[REDIS_GUARD] ${kind} từ Redis được bỏ qua, API tiếp tục chạy${suffix}:`, error);
      lastLogAt = now();
      suppressed = 0;
    } else {
      suppressed += 1;
    }
    return "ignored" as const;
  }

  logger.error(`[PROCESS] ${kind}, tiến trình thoát:`, error);
  exit(1);
  return "fatal" as const;
};

export const installRedisErrorGuard = () => {
  process.on("uncaughtException", (error) => handleProcessLevelError("uncaughtException", error));
  process.on("unhandledRejection", (reason) => handleProcessLevelError("unhandledRejection", reason));
};

export const resetRedisErrorGuardForTests = () => {
  lastLogAt = 0;
  suppressed = 0;
};
