// Production chỉ chạy worker ngay trong tiến trình API để có một topology duy nhất.
// Bật toàn bộ bằng biến môi trường:
//   INLINE_WORKERS=otp,appointments,notifications,payments
// Local/test có thể để trống hoặc chọn một phần để chẩn đoán.

import { isProductionLike } from "../config/environment.js";
import { getRuntimeConfig } from "../config/runtimeConfig.js";
import { logger } from "../observability/logger.js";

const INLINE_WORKER_NAMES = ["otp", "appointments", "notifications", "payments"] as const;
type InlineWorkerName = (typeof INLINE_WORKER_NAMES)[number];

export const parseInlineWorkers = (value?: string): InlineWorkerName[] => {
  const requested = (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const unknown = requested.filter(
    (item) => !(INLINE_WORKER_NAMES as readonly string[]).includes(item),
  );
  if (unknown.length > 0) {
    throw new Error(
      `INLINE_WORKERS có giá trị không hợp lệ: ${unknown.join(", ")}. ` +
        `Chỉ nhận: ${INLINE_WORKER_NAMES.join(", ")}.`,
    );
  }
  return [...new Set(requested)] as InlineWorkerName[];
};

const loaders: Record<InlineWorkerName, () => Promise<unknown>> = {
  otp: () => import("./otp.worker.js"),
  appointments: () => import("./appointmentLifecycle.worker.js"),
  notifications: () => import("./notification.worker.js"),
  payments: () => import("./paymentReconciliation.worker.js"),
};

export const startInlineWorkers = async (
  value = getRuntimeConfig().workers.inline,
  load: Record<InlineWorkerName, () => Promise<unknown>> = loaders,
) => {
  let names: InlineWorkerName[];
  try {
    names = parseInlineWorkers(value);
  } catch (error) {
    logger.error("[INLINE_WORKER]", error instanceof Error ? error.message : error);
    if (isProductionLike()) throw error;
    return [];
  }
  for (const name of names) {
    try {
      await load[name]();
      logger.info(`[INLINE_WORKER] started: ${name}`);
    } catch (error) {
      // Một worker lỗi không được kéo sập API (đặt lịch, đăng nhập vẫn phải phục vụ được): ghi lỗi rõ ràng và chạy
      // tiếp. Cấu hình sai INLINE_WORKERS vẫn dừng ngay lúc khởi động ở bước phân tích phía trên.
      logger.error(`[INLINE_WORKER] cannot start ${name}; API continues without it:`, error);
    }
  }
  return names;
};
