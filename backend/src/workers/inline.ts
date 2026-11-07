// Chạy worker ngay trong tiến trình API khi không có tiến trình worker riêng
// (ví dụ Render gói free chỉ có một Web Service). Bật bằng biến môi trường:
//   INLINE_WORKERS=otp,appointments,notifications
// Để trống thì API không chạy worker nào (dùng `npm run worker:*` như trước).

export const INLINE_WORKER_NAMES = ["otp", "appointments", "notifications"] as const;
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
};

export const startInlineWorkers = async (value = process.env.INLINE_WORKERS) => {
  let names: InlineWorkerName[];
  try {
    names = parseInlineWorkers(value);
  } catch (error) {
    console.error("[INLINE_WORKER]", error instanceof Error ? error.message : error);
    return [];
  }
  for (const name of names) {
    try {
      await loaders[name]();
      console.log(`[INLINE_WORKER] started: ${name}`);
    } catch (error) {
      // Một worker lỗi không được làm sập API đang phục vụ người dùng.
      console.error(`[INLINE_WORKER] cannot start ${name}:`, error);
    }
  }
  return names;
};
