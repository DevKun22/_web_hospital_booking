import { isQuotaError } from "../queues/queueGuard.js";

// Giám sát worker BullMQ khi Redis lỗi. Không có lớp này, khi Upstash trả "max requests limit exceeded" mỗi lệnh lỗi ngay và
// vòng lặp của worker gọi lại liên tục: hàng trăm dòng log mỗi giây (kèm stack trace) và CPU của máy chủ gói miễn phí bị chiếm.
//  - Lỗi hạn mức: TẠM DỪNG worker (pause) rồi tiếp tục (resume) sau một khoảng giãn dần (10 phút, 20 phút... tối đa 60 phút).
//    Trong lúc dừng không gọi Redis nữa; việc gửi OTP đã có đường gửi trực tiếp và việc định kỳ chạy trên cơ sở dữ liệu.
//    Không đóng (close) worker: đóng sẽ gỡ bộ lắng nghe lỗi của kết nối trong khi socket còn phát sự kiện "error"/từ chối
//    lệnh đang chờ, nên lỗi không ai bắt làm Node thoát với mã 1 (đã xảy ra trên production ở PR 218).
//  - Lỗi khác (đứt kết nối thoáng qua): ghi log nhưng tối đa một dòng mỗi 30 giây, kèm số lỗi đã bị gộp.

export const QUOTA_RETRY_BASE_MS = 10 * 60_000;
export const QUOTA_RETRY_MAX_MS = 60 * 60_000;
export const ERROR_LOG_INTERVAL_MS = 30_000;
// Chạy ổn định chừng này mà không gặp lỗi hạn mức thì coi như Redis đã hồi phục, đặt lại bộ đếm lùi.
export const STABLE_AFTER_MS = 5 * 60_000;

export type SupervisedWorker = {
  on(event: "error", listener: (error: Error) => void): unknown;
  pause(doNotWaitActive?: boolean): Promise<void>;
  resume(): void;
  close(force?: boolean): Promise<void>;
};

type Logger = {
  info(message: string, ...details: unknown[]): void;
  warn(message: string, ...details: unknown[]): void;
  error(message: string, ...details: unknown[]): void;
};

type Cancel = () => void;

export const createWorkerSupervisor = <W extends SupervisedWorker>(options: {
  name: string;
  create: () => W;
  logger: Logger;
  now?: () => number;
  schedule?: (callback: () => void, delayMs: number) => Cancel;
}) => {
  const now = options.now ?? Date.now;
  const schedule =
    options.schedule ??
    ((callback: () => void, delayMs: number) => {
      const timer = setTimeout(callback, delayMs);
      timer.unref?.();
      return () => clearTimeout(timer);
    });

  let worker: W | null = null;
  let stopped = false;
  let pausedForQuota = false;
  let quotaPauses = 0;
  let lastErrorLogAt = 0;
  let suppressedErrors = 0;
  let cancelResume: Cancel | null = null;
  let cancelStable: Cancel | null = null;

  const armStableTimer = () => {
    cancelStable?.();
    cancelStable = schedule(() => {
      quotaPauses = 0;
    }, STABLE_AFTER_MS);
  };

  const pauseForQuota = (current: W, error: Error) => {
    pausedForQuota = true;
    cancelStable?.();
    cancelStable = null;
    const delayMs = Math.min(QUOTA_RETRY_BASE_MS * 2 ** quotaPauses, QUOTA_RETRY_MAX_MS);
    quotaPauses += 1;
    options.logger.warn(
      `[${options.name}] Redis hết hạn mức lệnh, tạm dừng worker và thử lại sau ${Math.round(delayMs / 60_000)} phút: ${error.message}`,
    );
    // doNotWaitActive: không chờ job đang chạy để khỏi treo bộ xử lý lỗi.
    current.pause(true).catch(() => undefined);
    cancelResume = schedule(() => {
      cancelResume = null;
      if (stopped || worker !== current) return;
      pausedForQuota = false;
      armStableTimer();
      current.resume();
    }, delayMs);
  };

  const handleError = (current: W, error: Error) => {
    if (stopped || current !== worker) return;
    if (isQuotaError(error)) {
      if (!pausedForQuota) pauseForQuota(current, error);
      return;
    }

    if (now() - lastErrorLogAt >= ERROR_LOG_INTERVAL_MS) {
      const suffix = suppressedErrors > 0 ? ` (đã gộp thêm ${suppressedErrors} lỗi tương tự)` : "";
      options.logger.error(`[${options.name}] error${suffix}:`, error);
      lastErrorLogAt = now();
      suppressedErrors = 0;
    } else {
      suppressedErrors += 1;
    }
  };

  return {
    start() {
      pausedForQuota = false;
      const created = options.create();
      worker = created;
      // Bộ lắng nghe này tồn tại suốt vòng đời worker (kể cả lúc tạm dừng) nên mọi lỗi kết nối đều có nơi nhận.
      created.on("error", (error) => handleError(created, error));
      armStableTimer();
      return created;
    },
    isPausedForQuota: () => pausedForQuota,
    current: () => worker,
    async stop() {
      stopped = true;
      cancelResume?.();
      cancelStable?.();
      const current = worker;
      worker = null;
      if (current) await current.close();
    },
  };
};
