import { Queue } from "bullmq";
import type { OtpChannel, OtpPurpose } from "../../generated/prisma/enums.js";
import { getRedisConnectionOptions, hasRedisUrl } from "./redis.js";

export const OTP_DELIVERY_QUEUE_NAME = "otp-delivery";

export type OtpDeliveryJobData = {
  otpCodeId: string;
  target: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  otp: string;
  expiresInSeconds: number;
};

let otpDeliveryQueue: Queue<OtpDeliveryJobData> | null = null;

export const getOtpDeliveryQueue = () => {
  if (!otpDeliveryQueue) {
    otpDeliveryQueue = new Queue<OtpDeliveryJobData>(OTP_DELIVERY_QUEUE_NAME, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 3000,
        },
        removeOnComplete: {
          age: 60 * 60,
          count: 1000,
        },
        removeOnFail: {
          age: 24 * 60 * 60,
          count: 5000,
        },
      },
    });
  }

  return otpDeliveryQueue;
};

export const enqueueOtpDeliveryJob = async (data: OtpDeliveryJobData) => {
  if (!hasRedisUrl()) return false;

  const queue = getOtpDeliveryQueue();

  await queue.add("send-otp", data, {
    jobId: `otp-${data.otpCodeId}`,
  });

  return true;
};
