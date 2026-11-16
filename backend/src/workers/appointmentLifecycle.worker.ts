import "dotenv/config";
import { Worker } from "bullmq";
import {
  shouldLogWorkerNoop,
  validateRuntimeEnvironment,
} from "../config/environment.js";
import { prisma } from "../config/prisma.js";
import {
  APPOINTMENT_LIFECYCLE_QUEUE_NAME,
  ensurePendingOtpReconciliation,
  type AppointmentLifecycleJobData,
} from "../queues/appointmentLifecycle.queue.js";
import { getRedisConnectionOptions, idleRedisOptions } from "../queues/redis.js";
import AppointmentService from "../services/appointment.service.js";
import AuthOtpService from "../services/authOtp.service.js";
import InvoiceService from "../services/invoice.service.js";
import ScheduleReconciliationService from "../services/scheduleReconciliation.service.js";
import SlotPlannerService from "../services/slotPlanner.service.js";
import {
  startRuntimeMetrics,
  stopRuntimeMetrics,
} from "../observability/runtimeMetrics.js";
import { getRuntimeConfig } from "../config/runtimeConfig.js";
import { logger } from "../observability/logger.js";

const INVOICE_REMINDER_EVERY_MS = 30 * 60 * 1000;
let lastInvoiceReminderAt = 0;

validateRuntimeEnvironment();
await ensurePendingOtpReconciliation();
startRuntimeMetrics("appointment-worker");
const logNoop = shouldLogWorkerNoop();

const worker = new Worker<AppointmentLifecycleJobData>(
  APPOINTMENT_LIFECYCLE_QUEUE_NAME,
  async (job) => {
    if (job.data.type === "EXPIRE_PENDING_OTP") {
      const result = await AppointmentService.expirePendingOtpAppointment(
        job.data.appointmentId,
      );
      if (logNoop || result.outcome !== "NOOP") {
        logger.info(
          `[APPOINTMENT_EXPIRY] appointment=${job.data.appointmentId} outcome=${result.outcome}`,
        );
      }
      return result;
    }

    if (job.data.type === "RECONCILE_SLOT_CONSISTENCY") {
      const result = await ScheduleReconciliationService.reconcile();
      if (logNoop || result.findingCount > 0 || result.repairedCount > 0) {
        logger.info(
          `[SLOT_RECONCILIATION] scanned=${result.scanned} findings=${result.findingCount} repaired=${result.repairedCount}`,
        );
      }
      return result;
    }

    // Giữ cửa sổ khung giờ các ngày tới luôn đầy (có giới hạn tần suất bên trong).
    const slotWindow = await SlotPlannerService.generateRollingWindow().catch((error) => {
      logger.error("[SLOT_PLANNER] rolling window failed:", error);
      return null;
    });
    if (slotWindow && slotWindow.generatedCount > 0) {
      logger.info(`[SLOT_PLANNER] generated=${slotWindow.generatedCount} doctors=${slotWindow.doctors}`);
    }
    // Nhắc thanh toán chỉ cần quét thưa (mỗi hóa đơn chỉ nhắc một lần): tránh tốn truy vấn mỗi chu kỳ.
    const invoiceReminders =
      Date.now() - lastInvoiceReminderAt >= INVOICE_REMINDER_EVERY_MS
        ? await InvoiceService.sendPaymentReminders().catch((error) => {
            logger.error("[INVOICE_REMINDER] sweep failed:", error);
            return null;
          })
        : null;
    if (invoiceReminders) lastInvoiceReminderAt = Date.now();
    if (invoiceReminders && invoiceReminders.reminded > 0) {
      logger.info(`[INVOICE_REMINDER] reminded=${invoiceReminders.reminded}`);
    }
    // Chạy tuần tự các nhóm để RECONCILIATION_CONCURRENCY là trần chung của sweep,
    // không bị nhân lên bởi ba batch cùng khởi động một lúc.
    const pendingOtp = await AppointmentService.reconcileExpiredPendingOtp();
    const pendingConfirm = await AppointmentService.reconcilePastPendingConfirmations();
    const noShows = await AppointmentService.reconcileNoShows();
    const otpCleanup = await AuthOtpService.cleanupExpired();
    if (noShows.marked > 0 || otpCleanup.deleted > 0) {
      logger.info(
        `[LIFECYCLE_MAINTENANCE] noShowMarked=${noShows.marked} otpDeleted=${otpCleanup.deleted}`,
      );
    }
    if (
      logNoop ||
      pendingOtp.scanned > 0 ||
      pendingOtp.expired > 0 ||
      pendingConfirm.scanned > 0 ||
      pendingConfirm.expired > 0
    ) {
      logger.info(
        `[APPOINTMENT_RECONCILIATION] pendingOtp(scanned=${pendingOtp.scanned}, expired=${pendingOtp.expired}, noop=${pendingOtp.noop}) pendingConfirm(scanned=${pendingConfirm.scanned}, expired=${pendingConfirm.expired}, noop=${pendingConfirm.noop})`,
      );
    }
    return { pendingOtp, pendingConfirm, noShows, otpCleanup };
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency: getRuntimeConfig().workers.appointmentLifecycleConcurrency,
    ...idleRedisOptions,
  },
);

worker.on("ready", () => {
  logger.info(
    `Appointment lifecycle worker is listening on queue "${APPOINTMENT_LIFECYCLE_QUEUE_NAME}"`,
  );
});

worker.on("failed", (job, error) => {
  logger.error(
    `[APPOINTMENT_LIFECYCLE] job=${job?.id || "unknown"} failed:`,
    error,
  );
});

worker.on("error", (error) => {
  logger.error("[Appointment Lifecycle Worker] error:", error);
});

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, closing appointment lifecycle worker...`);
  stopRuntimeMetrics();
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
