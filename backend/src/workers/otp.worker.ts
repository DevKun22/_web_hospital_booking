import "dotenv/config";
import { Worker } from "bullmq";
import { validateRuntimeEnvironment } from "../config/environment.js";
import { prisma } from "../config/prisma.js";
import OtpSenderService from "../services/otpSender.service.js";
import {
  OTP_DELIVERY_QUEUE_NAME,
  type OtpDeliveryJobData,
} from "../queues/otp.queue.js";
import { getRedisConnectionOptions, idleRedisOptions } from "../queues/redis.js";
import {
  startRuntimeMetrics,
  stopRuntimeMetrics,
} from "../observability/runtimeMetrics.js";
import { getRuntimeConfig } from "../config/runtimeConfig.js";
import { logger } from "../observability/logger.js";

validateRuntimeEnvironment();
startRuntimeMetrics("otp-worker");

const worker = new Worker<OtpDeliveryJobData, void, "send-otp">(
  OTP_DELIVERY_QUEUE_NAME,
  async (job) => {
    const { otpCodeId, email, purpose, otp, expiresInSeconds } = job.data;

    try {
      await OtpSenderService.send({
        email,
        purpose,
        otp,
        expiresInSeconds,
      });

      await prisma.otpCode.update({
        where: { id: otpCodeId },
        data: {
          deliveryStatus: "SENT",
          deliveryError: null,
          deliveredAt: new Date(),
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không gửi được OTP";

      await prisma.otpCode.update({
        where: { id: otpCodeId },
        data: {
          deliveryStatus: "FAILED",
          deliveryError: message.slice(0, 1000),
        },
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

worker.on("ready", () => {
  logger.info(`OTP worker is listening on queue "${OTP_DELIVERY_QUEUE_NAME}"`);
});

worker.on("active", (job) => {
  logger.info(`[OTP] Job ${job.id} is being processed`);
});

worker.on("completed", (job) => {
  logger.info(`[OTP] Job ${job.id} completed successfully`);
});

worker.on("failed", (job, error) => {
  logger.error(`[OTP] Job ${job?.id || "unknown"} failed:`, error);
});

worker.on("error", (error) => {
  logger.error("[OTP Worker] error:", error);
});

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, closing OTP worker...`);
  stopRuntimeMetrics();
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
