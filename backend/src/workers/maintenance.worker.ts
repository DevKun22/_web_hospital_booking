import "dotenv/config";
import {
  getAppointmentReconciliationIntervalMs,
  getSlotReconciliationIntervalMs,
  validateRuntimeEnvironment,
} from "../config/environment.js";
import { prisma } from "../config/prisma.js";
import { getRuntimeConfig } from "../config/runtimeConfig.js";
import MaintenanceService from "../services/maintenance.service.js";
import PublicSearchService from "../services/search/search.service.js";
import { logger } from "../observability/logger.js";

// Việc định kỳ chạy thẳng trên cơ sở dữ liệu, không cần Redis: tiết kiệm hạn mức lệnh (gói miễn phí) và vẫn chạy khi Redis lỗi.
// Khóa tư vấn Postgres bảo đảm chỉ một bản API làm mỗi lượt khi chạy nhiều instance.
validateRuntimeEnvironment();

const lifecycleEveryMs = getAppointmentReconciliationIntervalMs();
const slotEveryMs = getSlotReconciliationIntervalMs();
const searchRefreshEveryMs = getRuntimeConfig().publicSearch.refreshIntervalMs;

const guarded = (name: string, task: () => Promise<unknown>) => {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      const outcome = await MaintenanceService.runExclusive(name, task);
      if (outcome === null) logger.debug?.(`[MAINTENANCE] ${name} skipped: another instance holds the lock`);
    } catch (error) {
      logger.error(`[MAINTENANCE] ${name} failed:`, error);
    } finally {
      running = false;
    }
  };
};

const lifecycle = guarded("lifecycle", () => MaintenanceService.runLifecycleSweep());
const slots = guarded("slot-consistency", () => MaintenanceService.runSlotReconciliation());
// Làm mới view tìm kiếm không cần khóa tư vấn: REFRESH ... CONCURRENTLY tự tuần tự hóa các lượt chạy trùng.
const searchIndex = async () => {
  try {
    await PublicSearchService.refresh();
  } catch (error) {
    logger.error("[MAINTENANCE] search-index refresh failed:", error);
  }
};

// Lượt đầu chạy sau ít giây để API kịp khởi động rồi mới làm việc nền.
const timers = [
  setTimeout(() => void lifecycle(), 15_000),
  setTimeout(() => void slots(), 45_000),
  setInterval(() => void lifecycle(), lifecycleEveryMs),
  setInterval(() => void slots(), slotEveryMs),
  setTimeout(() => void searchIndex(), 60_000),
  setInterval(() => void searchIndex(), searchRefreshEveryMs),
];

logger.info(`[MAINTENANCE] started: lifecycle every ${lifecycleEveryMs}ms, slot reconciliation every ${slotEveryMs}ms, search index every ${searchRefreshEveryMs}ms`);

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, closing maintenance worker...`);
  for (const timer of timers) {
    clearTimeout(timer);
    clearInterval(timer);
  }
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
