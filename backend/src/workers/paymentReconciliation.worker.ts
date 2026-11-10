import "dotenv/config";
import PaymentService from "../services/payment.service.js";

// Đối soát định kỳ giao dịch VNPAY treo PENDING bằng API querydr. Dùng vòng lặp trong
// tiến trình (không cần Redis) vì tác vụ idempotent và nhẹ; chạy nhiều bản cùng lúc
// vẫn an toàn vì việc ghi nhận thanh toán đã khóa theo hóa đơn.
const INTERVAL_MS = Math.max(
  Number(process.env.PAYMENT_RECONCILIATION_INTERVAL_MS) || 10 * 60 * 1000,
  60 * 1000,
);

let running = false;
const tick = async () => {
  if (running) return;
  running = true;
  try {
    const summary = await PaymentService.reconcilePendingVnpay();
    if (summary.scanned > 0) {
      console.log(
        `[PAYMENT_RECONCILIATION] scanned=${summary.scanned} paid=${summary.paid} failed=${summary.failed} expired=${summary.expired} pending=${summary.pending} errors=${summary.errors}`,
      );
    }
  } catch (error) {
    console.error("[PAYMENT_RECONCILIATION] sweep failed:", error);
  } finally {
    running = false;
  }
};

setInterval(() => void tick(), INTERVAL_MS);
console.log(`[PAYMENT_RECONCILIATION] started, interval=${INTERVAL_MS}ms`);
