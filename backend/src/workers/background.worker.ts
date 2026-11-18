import "dotenv/config";
import { Worker } from "bullmq";
import { shouldLogWorkerNoop, validateRuntimeEnvironment } from "../config/environment.js";
import { prisma } from "../config/prisma.js";
import OtpSenderService from "../services/otpSender.service.js";
import AppointmentService from "../services/appointment.service.js";
import { BACKGROUND_QUEUE_NAME, type BackgroundJobData } from "../queues/background.queue.js";
import { getRedisConnectionOptions, idleRedisOptions } from "../queues/redis.js";
import { startRuntimeMetrics, stopRuntimeMetrics } from "../observability/runtimeMetrics.js";
import { getRuntimeConfig } from "../config/runtimeConfig.js";
import { logger } from "../observability/logger.js";
import { unsealOtp } from "../utils/otpJobSeal.js";
import { createWorkerSupervisor } from "./workerSupervisor.js";

validateRuntimeEnvironment();
startRuntimeMetrics("background-worker");
const logNoop = shouldLogWorkerNoop();

const createWorker = () => {
  const worker = new Worker<BackgroundJobData>(
  BACKGROUND_QUEUE_NAME,
  async (job) => {
    if (job.data.type === "EXPIRE_PENDING_OTP") {
      const result = await AppointmentService.expirePendingOtpAppointment(job.data.appointmentId);
      if (logNoop || result.outcome !== "NOOP") {
        logger.info(`[APPOINTMENT_EXPIRY] appointment=${job.data.appointmentId} outcome=${result.outcome}`);
      }
      return result;
    }

    const { otpCodeId, email, purpose, sealedOtp, expiresInSeconds } = job.data;
    try {
      await OtpSenderService.send({ email, purpose, otp: unsealOtp(sealedOtp), expiresInSeconds });
      await prisma.otpCode.update({
        where: { id: otpCodeId },
        data: { deliveryStatus: "SENT", deliveryError: null, deliveredAt: new Date() },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không gửi được OTP";
      await prisma.otpCode.update({
        where: { id: otpCodeId },
        data: { deliveryStatus: "FAILED", deliveryError: message.slice(0, 1000) },
      });
      throw error;
    }
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency: getRuntimeConfig().workers.otpConcurrency,
    ...idleRedisOptions,
  },
  );

  worker.on("ready", () => logger.info(`Background worker is listening on queue "${BACKGROUND_QUEUE_NAME}"`));
  worker.on("failed", (job, error) => logger.error(`[BACKGROUND] job=${job?.id || "unknown"} (${job?.name}) failed:`, error));
  return worker;
};

// Lỗi Redis (đặc biệt hết hạn mức) do bộ giám sát xử lý: dừng và thử lại thưa dần thay vì ghi log dồn dập.
const supervisor = createWorkerSupervisor({ name: "Background Worker", create: createWorker, logger });
supervisor.start();

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, closing background worker...`);
  stopRuntimeMetrics();
  await supervisor.stop();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
