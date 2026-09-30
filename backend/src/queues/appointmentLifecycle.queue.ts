import { Queue } from "bullmq";
import {
  getAppointmentReconciliationIntervalMs,
} from "../config/environment.js";
import { getRedisConnectionOptions, hasRedisUrl } from "./redis.js";

export const APPOINTMENT_LIFECYCLE_QUEUE_NAME = "appointment-lifecycle";
export const APPOINTMENT_RECONCILIATION_SCHEDULER_ID =
  "appointment-pending-otp-reconciliation";

export type AppointmentLifecycleJobData =
  | { type: "EXPIRE_PENDING_OTP"; appointmentId: string }
  | { type: "RECONCILE_PENDING_OTP" };

let appointmentLifecycleQueue: Queue<AppointmentLifecycleJobData> | null = null;

export const getAppointmentLifecycleQueue = () => {
  if (!appointmentLifecycleQueue) {
    appointmentLifecycleQueue = new Queue<AppointmentLifecycleJobData>(
      APPOINTMENT_LIFECYCLE_QUEUE_NAME,
      {
        connection: getRedisConnectionOptions(),
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: { age: 60 * 60, count: 2_000 },
          removeOnFail: { age: 7 * 24 * 60 * 60, count: 5_000 },
        },
      },
    );
  }

  return appointmentLifecycleQueue;
};

export const enqueuePendingOtpExpiry = async (
  appointmentId: string,
  holdExpiresAt: Date,
) => {
  if (!hasRedisUrl()) return false;

  await getAppointmentLifecycleQueue().add(
    "expire-pending-otp",
    { type: "EXPIRE_PENDING_OTP", appointmentId },
    {
      jobId: `expire-pending-otp-${appointmentId}`,
      delay: Math.max(holdExpiresAt.getTime() - Date.now(), 0),
    },
  );

  return true;
};

export const ensurePendingOtpReconciliation = async () => {
  const queue = getAppointmentLifecycleQueue();
  await queue.upsertJobScheduler(
    APPOINTMENT_RECONCILIATION_SCHEDULER_ID,
    { every: getAppointmentReconciliationIntervalMs() },
    {
      name: "reconcile-pending-otp",
      data: { type: "RECONCILE_PENDING_OTP" },
    },
  );
};
