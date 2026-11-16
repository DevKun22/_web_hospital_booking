import "dotenv/config";
import PaymentService from "../services/payment.service.js";
import { startRuntimeMetrics } from "../observability/runtimeMetrics.js";
import { getRuntimeConfig } from "../config/runtimeConfig.js";
import { logger } from "../observability/logger.js";

// Đối soát định kỳ giao dịch VNPAY treo PENDING bằng API querydr. Dùng vòng lặp trong
// tiến trình (không cần Redis) vì tác vụ idempotent và nhẹ; chạy nhiều bản cùng lúc
// vẫn an toàn vì việc ghi nhận thanh toán đã khóa theo hóa đơn.
const INTERVAL_MS = Math.max(
  getRuntimeConfig().workers.paymentReconciliationIntervalMs,
  60 * 1000,
);
startRuntimeMetrics("payment-worker");

let running = false;
const tick = async () => {
  if (running) return;
  running = true;
  try {
    const summary = await PaymentService.reconcilePendingVnpay();
    if (summary.scanned > 0) {
      logger.info(
        `[PAYMENT_RECONCILIATION] scanned=${summary.scanned} paid=${summary.paid} failed=${summary.failed} expired=${summary.expired} pending=${summary.pending} errors=${summary.errors}`,
      );
    }
  } catch (error) {
    logger.error("[PAYMENT_RECONCILIATION] sweep failed:", error);
  } finally {
    running = false;
  }
};

setInterval(() => void tick(), INTERVAL_MS);
logger.info(`[PAYMENT_RECONCILIATION] started, interval=${INTERVAL_MS}ms`);
