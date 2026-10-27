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
import { getRedisConnectionOptions } from "../queues/redis.js";
import AppointmentService from "../services/appointment.service.js";
import ScheduleReconciliationService from "../services/scheduleReconciliation.service.js";

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

    const [pendingOtp, pendingConfirm] = await Promise.all([
      AppointmentService.reconcileExpiredPendingOtp(),
      AppointmentService.reconcilePastPendingConfirmations(),
    ]);
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
    return { pendingOtp, pendingConfirm };
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency: Number(
      process.env.APPOINTMENT_LIFECYCLE_WORKER_CONCURRENCY || 5,
    ),
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
