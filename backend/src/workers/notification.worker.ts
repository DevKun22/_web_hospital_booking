import "dotenv/config";
import {
  getNotificationDispatchBatchSize,
  getNotificationCleanupIntervalMs,
  getNotificationRetentionDays,
  getNotificationWorkerIdleMaxMs,
  getNotificationWorkerIntervalMs,
  validateNotificationWorkerEnvironment,
} from "../config/environment.js";
import { prisma } from "../config/prisma.js";
import NotificationDeliveryService from "../services/notificationDelivery.service.js";
import NotificationService from "../services/notification.service.js";
import OutboxEventService from "../services/outboxEvent.service.js";
import { startRuntimeMetrics, stopRuntimeMetrics } from "../observability/runtimeMetrics.js";
import { logger } from "../observability/logger.js";
import { onWork } from "../utils/workSignal.js";

validateNotificationWorkerEnvironment();
startRuntimeMetrics("notification-worker");

// Nhịp quét thích ứng: có việc thì quét dày (busyMs), rảnh thì giãn dần đến idleMaxMs để bớt truy vấn rỗng; có thông báo
// mới trong cùng tiến trình thì đánh thức ngay (sau một khoảng ngắn cho giao dịch ghi xong).
const busyMs = getNotificationWorkerIntervalMs();
const idleMaxMs = Math.max(getNotificationWorkerIdleMaxMs(), busyMs);
const WAKE_DELAY_MS = 1_000;
const batchSize = getNotificationDispatchBatchSize();
const cleanupIntervalMs = getNotificationCleanupIntervalMs();
const retentionDays = getNotificationRetentionDays();
let running = false;
let warnedMissingFirebase = false;
let lastCleanupAt = 0;
let currentDelayMs = busyMs;
let timer: NodeJS.Timeout | null = null;
let stopped = false;

const schedule = (delayMs: number) => {
  if (stopped) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void dispatch(), delayMs);
};

const dispatch = async () => {
  if (running) return;
  running = true;
  let hadWork = false;
  try {
    const [result, outbox] = await Promise.all([
      NotificationDeliveryService.dispatchDue(batchSize),
      OutboxEventService.dispatchDue(),
    ]);
    hadWork = result.published > 0 || result.scanned > 0 || outbox.scanned > 0;
    if (Date.now() - lastCleanupAt >= cleanupIntervalMs) {
      const [cleanup, outboxCleanup, deliveryCleanup] = await Promise.all([
        NotificationService.cleanupExpiredAndRead(retentionDays),
        OutboxEventService.cleanupProcessed(),
        NotificationDeliveryService.cleanupFinished(),
      ]);
      lastCleanupAt = Date.now();
      if (cleanup.deletedCount > 0 || outboxCleanup.deletedCount > 0 || deliveryCleanup.deletedCount > 0) {
        logger.info(
          `[NOTIFICATION_WORKER] cleaned=${cleanup.deletedCount} outboxCleaned=${outboxCleanup.deletedCount} deliveriesCleaned=${deliveryCleanup.deletedCount} retentionDays=${retentionDays}`,
        );
      }
    }
    if (!result.configured && !warnedMissingFirebase) {
      warnedMissingFirebase = true;
      logger.warn(
        "[NOTIFICATION_WORKER] Firebase Admin is not configured; inbox notifications remain available and push deliveries stay pending.",
      );
    } else if (result.configured) {
      warnedMissingFirebase = false;
    }
    if (result.configured && (result.published > 0 || result.scanned > 0 || result.errors > 0)) {
      logger.info(
        `[NOTIFICATION_WORKER] published=${result.published} scanned=${result.scanned} sent=${result.sent} retryable=${result.failed} exhausted=${result.exhausted} invalid=${result.invalid} cancelled=${result.cancelled} errors=${result.errors}`,
      );
    }
    if (outbox.scanned > 0) {
      logger.info(
        `[OUTBOX] scanned=${outbox.scanned} processed=${outbox.processed} retrying=${outbox.retrying} failed=${outbox.failed}`,
      );
    }
  } catch (error) {
    logger.error("[NOTIFICATION_WORKER] dispatch failed:", error);
  } finally {
    running = false;
    currentDelayMs = hadWork ? busyMs : Math.min(currentDelayMs * 2, idleMaxMs);
    schedule(currentDelayMs);
  }
};

const stopListening = onWork("notifications", () => {
  currentDelayMs = busyMs;
  if (!running) schedule(WAKE_DELAY_MS);
});

schedule(0);

logger.info(
  `Notification worker is adaptive: ${busyMs}ms when busy up to ${idleMaxMs}ms when idle, batch size ${batchSize}`,
);

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, closing notification worker...`);
  stopped = true;
  if (timer) clearTimeout(timer);
  stopListening();
  stopRuntimeMetrics();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
