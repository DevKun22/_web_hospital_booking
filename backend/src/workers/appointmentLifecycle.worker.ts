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

validateRuntimeEnvironment();
await ensurePendingOtpReconciliation();
const logNoop = shouldLogWorkerNoop();

const worker = new Worker<AppointmentLifecycleJobData>(
  APPOINTMENT_LIFECYCLE_QUEUE_NAME,
  async (job) => {
    if (job.data.type === "EXPIRE_PENDING_OTP") {
      const result = await AppointmentService.expirePendingOtpAppointment(
        job.data.appointmentId,
      );
      if (logNoop || result.outcome !== "NOOP") {
        console.log(
          `[APPOINTMENT_EXPIRY] appointment=${job.data.appointmentId} outcome=${result.outcome}`,
        );
      }
      return result;
    }

    if (job.data.type === "RECONCILE_SLOT_CONSISTENCY") {
      const result = await ScheduleReconciliationService.reconcile();
      if (logNoop || result.findingCount > 0 || result.repairedCount > 0) {
        console.log(
          `[SLOT_RECONCILIATION] scanned=${result.scanned} findings=${result.findingCount} repaired=${result.repairedCount}`,
        );
      }
      return result;
    }

    // Giữ cửa sổ khung giờ các ngày tới luôn đầy (có giới hạn tần suất bên trong).
    const slotWindow = await SlotPlannerService.generateRollingWindow().catch((error) => {
      console.error("[SLOT_PLANNER] rolling window failed:", error);
      return null;
    });
    if (slotWindow && slotWindow.generatedCount > 0) {
      console.log(`[SLOT_PLANNER] generated=${slotWindow.generatedCount} doctors=${slotWindow.doctors}`);
    }
    const invoiceReminders = await InvoiceService.sendPaymentReminders().catch((error) => {
      console.error("[INVOICE_REMINDER] sweep failed:", error);
      return null;
    });
    if (invoiceReminders && invoiceReminders.reminded > 0) {
      console.log(`[INVOICE_REMINDER] reminded=${invoiceReminders.reminded}`);
    }
    const [pendingOtp, pendingConfirm, noShows, otpCleanup] = await Promise.all([
      AppointmentService.reconcileExpiredPendingOtp(),
      AppointmentService.reconcilePastPendingConfirmations(),
      AppointmentService.reconcileNoShows(),
      AuthOtpService.cleanupExpired(),
    ]);
    if (noShows.marked > 0 || otpCleanup.deleted > 0) {
      console.log(
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
      console.log(
        `[APPOINTMENT_RECONCILIATION] pendingOtp(scanned=${pendingOtp.scanned}, expired=${pendingOtp.expired}, noop=${pendingOtp.noop}) pendingConfirm(scanned=${pendingConfirm.scanned}, expired=${pendingConfirm.expired}, noop=${pendingConfirm.noop})`,
      );
    }
    return { pendingOtp, pendingConfirm, noShows, otpCleanup };
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency: Number(
      process.env.APPOINTMENT_LIFECYCLE_WORKER_CONCURRENCY || 5,
    ),
    ...idleRedisOptions,
  },
);

worker.on("ready", () => {
  console.log(
    `Appointment lifecycle worker is listening on queue "${APPOINTMENT_LIFECYCLE_QUEUE_NAME}"`,
  );
});

worker.on("failed", (job, error) => {
  console.error(
    `[APPOINTMENT_LIFECYCLE] job=${job?.id || "unknown"} failed:`,
    error,
  );
});

worker.on("error", (error) => {
  console.error("[Appointment Lifecycle Worker] error:", error);
});

const shutdown = async (signal: string) => {
  console.log(`${signal} received, closing appointment lifecycle worker...`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
