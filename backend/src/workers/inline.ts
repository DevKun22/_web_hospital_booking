// Production chỉ chạy worker ngay trong tiến trình API để có một topology duy nhất.
// Bật toàn bộ bằng biến môi trường:
//   INLINE_WORKERS=otp,appointments,notifications,payments
// Local/test có thể để trống hoặc chọn một phần để chẩn đoán.

import { isProductionLike } from "../config/environment.js";
import { getRuntimeConfig } from "../config/runtimeConfig.js";

export const INLINE_WORKER_NAMES = ["otp", "appointments", "notifications", "payments"] as const;
export type InlineWorkerName = (typeof INLINE_WORKER_NAMES)[number];

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

export const startInlineWorkers = async (value = getRuntimeConfig().workers.inline) => {
  let names: InlineWorkerName[];
  try {
    names = parseInlineWorkers(value);
  } catch (error) {
    console.error("[INLINE_WORKER]", error instanceof Error ? error.message : error);
    if (isProductionLike()) throw error;
    return [];
  }
  for (const name of names) {
    try {
      await loaders[name]();
      console.log(`[INLINE_WORKER] started: ${name}`);
    } catch (error) {
      console.error(`[INLINE_WORKER] cannot start ${name}:`, error);
      // Production phải fail-fast để readiness/host khởi động lại thay vì chạy
      // âm thầm thiếu một tác vụ nền. Local vẫn cho phép chẩn đoán từng worker.
      if (isProductionLike()) throw error;
    }
  }
  return names;
};
