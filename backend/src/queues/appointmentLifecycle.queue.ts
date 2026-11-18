import { Queue } from "bullmq";
import {
  getAppointmentReconciliationIntervalMs,
  getSlotReconciliationIntervalMs,
} from "../config/environment.js";
import { getRuntimeConfig } from "../config/runtimeConfig.js";
import { reportRedisUnavailable } from "../services/redisHealth.service.js";
import { guardedEnqueue } from "./queueGuard.js";
import { getRedisConnectionOptions, hasRedisUrl } from "./redis.js";

export const APPOINTMENT_LIFECYCLE_QUEUE_NAME = "appointment-lifecycle";
const APPOINTMENT_RECONCILIATION_SCHEDULER_ID =
  "appointment-pending-otp-reconciliation";
const SLOT_RECONCILIATION_SCHEDULER_ID =
  "doctor-slot-consistency-reconciliation";

export type AppointmentLifecycleJobData =
  | { type: "EXPIRE_PENDING_OTP"; appointmentId: string }
  | { type: "RECONCILE_PENDING_OTP" }
  | { type: "RECONCILE_SLOT_CONSISTENCY" };

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
    // Không có bộ lắng nghe lỗi thì lỗi kết nối Redis có thể làm sập tiến trình.
    appointmentLifecycleQueue.on("error", (error) =>
      reportRedisUnavailable("queue", "appointment-lifecycle-queue", error),
    );
  }

  return appointmentLifecycleQueue;
};

export const enqueuePendingOtpExpiry = async (
  appointmentId: string,
  holdExpiresAt: Date,
) => {
  if (!hasRedisUrl()) return false;

  // Không để request đặt lịch treo khi Redis lỗi: quá hạn hoặc ngắt mạch thì bỏ qua job hẹn giờ, vòng đối soát định kỳ
  // vẫn giải phóng khung giờ khi hết hạn giữ chỗ (chậm hơn tối đa một chu kỳ đối soát).
  const added = await guardedEnqueue(
    () =>
      getAppointmentLifecycleQueue().add(
        "expire-pending-otp",
        { type: "EXPIRE_PENDING_OTP", appointmentId },
        {
          jobId: `expire-pending-otp-${appointmentId}`,
          delay: Math.max(holdExpiresAt.getTime() - Date.now(), 0),
        },
      ),
    { timeoutMs: getRuntimeConfig().redis.enqueueTimeoutMs },
  );

  return added !== false;
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
  await queue.upsertJobScheduler(
    SLOT_RECONCILIATION_SCHEDULER_ID,
    { every: getSlotReconciliationIntervalMs() },
    {
      name: "reconcile-slot-consistency",
      data: { type: "RECONCILE_SLOT_CONSISTENCY" },
    },
  );
};
