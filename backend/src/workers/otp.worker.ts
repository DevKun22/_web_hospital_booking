import "dotenv/config";
import { Worker } from "bullmq";
import { prisma } from "../config/prisma.js";
import OtpSenderService from "../services/otpSender.service.js";
import {
  OTP_DELIVERY_QUEUE_NAME,
  type OtpDeliveryJobData,
} from "../queues/otp.queue.js";
import { getRedisConnectionOptions } from "../queues/redis.js";

const worker = new Worker<OtpDeliveryJobData, void, "send-otp">(
  OTP_DELIVERY_QUEUE_NAME,
  async (job) => {
    const { otpCodeId, target, channel, purpose, otp, expiresInSeconds } =
      job.data;

    try {
      await OtpSenderService.send({
        target,
        channel,
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
    concurrency: Number(process.env.OTP_WORKER_CONCURRENCY || 5),
  },
);

worker.on("ready", () => {
  console.log(`OTP worker is listening on queue "${OTP_DELIVERY_QUEUE_NAME}"`);
});

worker.on("active", (job) => {
  console.log(`[OTP] Job ${job.id} is being processed`);
});

worker.on("completed", (job) => {
  console.log(`[OTP] Job ${job.id} completed successfully`);
});

worker.on("failed", (job, error) => {
  console.error(`[OTP] Job ${job?.id || "unknown"} failed:`, error);
});

worker.on("error", (error) => {
  console.error("[OTP Worker] error:", error);
});

const shutdown = async (signal: string) => {
  console.log(`${signal} received, closing OTP worker...`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
