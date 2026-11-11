import type { Queue } from "bullmq";
import {
  getDatabasePoolBudget,
  getRuntimeMetricsIntervalMs,
  isRuntimeMetricsEnabled,
} from "../config/environment.js";
import { getDatabasePoolSnapshot } from "../config/prisma.js";
import { hasQueueRedisUrl } from "../config/redis.js";
import {
  APPOINTMENT_LIFECYCLE_QUEUE_NAME,
  getAppointmentLifecycleQueue,
} from "../queues/appointmentLifecycle.queue.js";
import {
  getOtpDeliveryQueue,
  OTP_DELIVERY_QUEUE_NAME,
} from "../queues/otp.queue.js";
import { takeRequestPerformanceMetrics } from "./requestPerformance.js";

type QueueCounts = {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
};

type QueueMetric = QueueCounts & { name: string };

type QueueMetricsResult = {
  status: "up" | "down" | "not_configured";
  queues: QueueMetric[];
  error?: string;
};

const toMiB = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;
const round = (value: number) => Math.round(value * 10) / 10;

const readQueue = async (name: string, queue: Queue): Promise<QueueMetric> => {
  const counts = await queue.getJobCounts(
    "waiting",
    "active",
    "delayed",
    "failed",
  );
  return {
    name,
    waiting: counts.waiting || 0,
    active: counts.active || 0,
    delayed: counts.delayed || 0,
    failed: counts.failed || 0,
  };
};

const getQueueMetrics = async (): Promise<QueueMetricsResult> => {
  if (!hasQueueRedisUrl()) {
    return { status: "not_configured" as const, queues: [] as QueueMetric[] };
  }

  try {
    const queues = await Promise.all([
      readQueue(OTP_DELIVERY_QUEUE_NAME, getOtpDeliveryQueue()),
      readQueue(
        APPOINTMENT_LIFECYCLE_QUEUE_NAME,
        getAppointmentLifecycleQueue(),
      ),
    ]);
    return { status: "up" as const, queues };
  } catch (error) {
    return {
      status: "down" as const,
      queues: [] as QueueMetric[],
      error: error instanceof Error ? error.message : "unknown queue error",
    };
  }
};

type CollectRuntimeMetricsOptions = {
  memoryUsage?: () => NodeJS.MemoryUsage;
  databasePool?: typeof getDatabasePoolSnapshot;
  requestMetrics?: typeof takeRequestPerformanceMetrics;
  queueMetrics?: typeof getQueueMetrics;
};

export const collectRuntimeMetrics = async (
  role: string,
  options: CollectRuntimeMetricsOptions = {},
) => {
  const memory = (options.memoryUsage ?? process.memoryUsage)();
  const databasePool = (options.databasePool ?? getDatabasePoolSnapshot)();
  const requests = (options.requestMetrics ?? takeRequestPerformanceMetrics)();
  // Chỉ API thu backlog queue để không mở thêm hai kết nối BullMQ ở mỗi worker.
  // Test/caller vẫn có thể truyền collector riêng khi cần.
  const queue = options.queueMetrics
    ? await options.queueMetrics()
    : role === "api"
      ? await getQueueMetrics()
      : { status: "not_collector" as const, queues: [] as QueueMetric[] };

  return {
    role,
    uptimeSeconds: Math.round(process.uptime()),
    memoryMiB: {
      rss: toMiB(memory.rss),
      heapUsed: toMiB(memory.heapUsed),
      heapTotal: toMiB(memory.heapTotal),
      external: toMiB(memory.external),
    },
    databasePool: {
      ...databasePool,
      utilization:
        databasePool.max > 0
          ? round((databasePool.total - databasePool.idle) / databasePool.max)
          : 0,
    },
    requests: {
      ...requests,
      averageDurationMs:
        requests.requests > 0
          ? round(requests.durationMs / requests.requests)
          : 0,
      averageDatabaseDurationMs:
        requests.requests > 0
          ? round(requests.databaseDurationMs / requests.requests)
          : 0,
    },
    queue,
  };
};

let metricsTimer: NodeJS.Timeout | null = null;

const reportRuntimeMetrics = async (role: string) => {
  try {
    const metrics = await collectRuntimeMetrics(role);
    console.log(`[RUNTIME_METRICS] ${JSON.stringify(metrics)}`);
  } catch (error) {
    console.error("[RUNTIME_METRICS] collection failed:", error);
  }
};

export const startRuntimeMetrics = (role: string) => {
  if (!isRuntimeMetricsEnabled() || metricsTimer) return false;

  const intervalMs = getRuntimeMetricsIntervalMs();
  console.log(
    `[DATABASE_POOL] ${JSON.stringify(getDatabasePoolBudget())}`,
  );
  void reportRuntimeMetrics(role);
  metricsTimer = setInterval(() => void reportRuntimeMetrics(role), intervalMs);
  metricsTimer.unref();
  return true;
};

export const stopRuntimeMetrics = () => {
  if (!metricsTimer) return;
  clearInterval(metricsTimer);
  metricsTimer = null;
};
