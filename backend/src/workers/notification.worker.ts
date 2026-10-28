import "dotenv/config";
import {
  getNotificationDispatchBatchSize,
  getNotificationCleanupIntervalMs,
  getNotificationRetentionDays,
  getNotificationWorkerIntervalMs,
  validateNotificationWorkerEnvironment,
} from "../config/environment.js";
import { prisma } from "../config/prisma.js";
import NotificationDeliveryService from "../services/notificationDelivery.service.js";
import NotificationService from "../services/notification.service.js";

validateNotificationWorkerEnvironment();

const intervalMs = getNotificationWorkerIntervalMs();
const batchSize = getNotificationDispatchBatchSize();
const cleanupIntervalMs = getNotificationCleanupIntervalMs();
const retentionDays = getNotificationRetentionDays();
let running = false;
let warnedMissingFirebase = false;
let lastCleanupAt = 0;

const dispatch = async () => {
  if (running) return;
  running = true;
  try {
    const result = await NotificationDeliveryService.dispatchDue(batchSize);
    if (Date.now() - lastCleanupAt >= cleanupIntervalMs) {
      const cleanup = await NotificationService.cleanupExpiredAndRead(
        retentionDays,
      );
      lastCleanupAt = Date.now();
      if (cleanup.deletedCount > 0) {
        console.log(
          `[NOTIFICATION_WORKER] cleaned=${cleanup.deletedCount} retentionDays=${retentionDays}`,
        );
      }
    }
    if (!result.configured && !warnedMissingFirebase) {
      warnedMissingFirebase = true;
      console.warn(
        "[NOTIFICATION_WORKER] Firebase Admin is not configured; inbox notifications remain available and push deliveries stay pending.",
      );
    } else if (result.configured) {
      warnedMissingFirebase = false;
    }
    if (
      result.configured &&
      (result.published > 0 || result.scanned > 0 || result.errors > 0)
    ) {
      console.log(
        `[NOTIFICATION_WORKER] published=${result.published} scanned=${result.scanned} sent=${result.sent} retryable=${result.failed} exhausted=${result.exhausted} invalid=${result.invalid} cancelled=${result.cancelled} errors=${result.errors}`,
      );
    }
  } catch (error) {
    console.error("[NOTIFICATION_WORKER] dispatch failed:", error);
  } finally {
    running = false;
  }
};

const timer = setInterval(() => void dispatch(), intervalMs);
void dispatch();

console.log(
  `Notification worker is polling every ${intervalMs}ms with batch size ${batchSize}`,
);

const shutdown = async (signal: string) => {
  console.log(`${signal} received, closing notification worker...`);
  clearInterval(timer);
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
