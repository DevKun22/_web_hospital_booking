import { prisma } from "../config/prisma.js";
import { shouldLogWorkerNoop } from "../config/environment.js";
import { logger } from "../observability/logger.js";
import AppointmentService from "./appointment.service.js";
import AuthOtpService from "./authOtp.service.js";
import InvoiceService from "./invoice.service.js";
import ScheduleReconciliationService from "./scheduleReconciliation.service.js";
import SlotPlannerService from "./slotPlanner.service.js";

const INVOICE_REMINDER_EVERY_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// Phiên và mã làm mới đã hết hạn/thu hồi chỉ giữ ít ngày cho điều tra rồi xóa (khóa ngoại cascade xóa kèm mã làm mới).
const AUTH_ARTIFACT_RETENTION_DAYS = 30;
// Tài khoản người khám chưa xác thực email và không có dữ liệu gì được giữ chừng này ngày.
const UNVERIFIED_PATIENT_RETENTION_DAYS = 14;
// Trợ lý ảo: phiên hết hạn giữ thêm ít ngày rồi xóa (nhật ký còn lại tách khỏi phiên, khóa ngoại SetNull); nhật ký trò chuyện
// (tin đã che thông tin cá nhân, vết xử lý) giữ chừng này ngày để đo chất lượng rồi xóa. Đổi bằng biến môi trường nếu cần.
const CHATBOT_SESSION_RETENTION_DAYS = Number(process.env.CHATBOT_SESSION_RETENTION_DAYS) || 30;
const CHATBOT_LOG_RETENTION_DAYS = Number(process.env.CHATBOT_LOG_RETENTION_DAYS) || 180;
export const chatbotRetentionMode = (value = process.env.CHATBOT_RETENTION_MODE): "off" | "dry-run" | "delete" =>
  value === "delete" || value === "off" ? value : "dry-run";
const LOCK_TRANSACTION_TIMEOUT_MS = 5 * 60 * 1000;

let lastInvoiceReminderAt = 0;

class MaintenanceService {
  // Khóa tư vấn Postgres theo giao dịch: nhiều bản API cùng chạy thì chỉ một bản làm việc định kỳ mỗi chu kỳ; khóa tự nhả
  // khi giao dịch kết thúc (kể cả tiến trình chết). Trả về null nếu bản khác đang chạy.
  async runExclusive<T>(name: string, task: () => Promise<T>): Promise<T | null> {
    return prisma.$transaction(
      async (tx) => {
        const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtext(${"hb-maintenance:" + name})) AS locked
        `;
        if (!locked) return null;
        return task();
      },
      { timeout: LOCK_TRANSACTION_TIMEOUT_MS, maxWait: 10_000 },
    );
  }

  // Xóa phiên/mã làm mới/thử thách đăng nhập đã hết hạn quá hạn giữ để các bảng xác thực không phình vô hạn.
  async cleanupAuthArtifacts(now = new Date()) {
    const cutoff = new Date(now.getTime() - AUTH_ARTIFACT_RETENTION_DAYS * DAY_MS);
    const challengeCutoff = new Date(now.getTime() - DAY_MS);
    const [sessions, challenges] = await Promise.all([
      prisma.authSession.deleteMany({
        where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
      }),
      prisma.dashboardLoginChallenge.deleteMany({ where: { expiresAt: { lt: challengeCutoff } } }),
    ]);
    return { sessions: sessions.count, challenges: challenges.count };
  }

  // Dọn phiên trò chuyện đã hết hạn quá hạn giữ và nhật ký trò chuyện cũ (quyền riêng tư: không giữ hội thoại vô thời hạn).
  // Xóa là không hoàn tác được nên mặc định CHỈ ĐẾM (dry-run) và ghi nhật ký số bản ghi sẽ xóa; chỉ xóa thật khi đặt
  // CHATBOT_RETENTION_MODE=delete sau khi đã duyệt. "off" tắt hẳn.
  async cleanupChatbotData(now = new Date(), mode = chatbotRetentionMode()) {
    if (mode === "off") return { mode, sessions: 0, logs: 0 };
    const sessionCutoff = new Date(now.getTime() - CHATBOT_SESSION_RETENTION_DAYS * DAY_MS);
    const logCutoff = new Date(now.getTime() - CHATBOT_LOG_RETENTION_DAYS * DAY_MS);
    const sessionWhere = { OR: [{ expiresAt: { lt: sessionCutoff } }, { isActive: false, updatedAt: { lt: sessionCutoff } }] };
    const logWhere = { createdAt: { lt: logCutoff } };
    if (mode === "dry-run") {
      const [sessions, logs] = await Promise.all([prisma.chatbotSession.count({ where: sessionWhere }), prisma.chatbotLog.count({ where: logWhere })]);
      return { mode, sessions, logs };
    }
    const [sessions, logs] = await Promise.all([
      prisma.chatbotSession.deleteMany({ where: sessionWhere }),
      prisma.chatbotLog.deleteMany({ where: logWhere }),
    ]);
    return { mode, sessions: sessions.count, logs: logs.count };
  }

  // Gửi OTP đăng nhập người khám tạo sẵn tài khoản cho email chưa có (xác thực xong mới dùng được), nên ai cũng có thể sinh ra tài khoản
  // rác bằng cách gõ email bất kỳ. Tài khoản chưa xác thực email, không có lịch hẹn và quá hạn giữ thì xóa; tài khoản đã có dữ liệu
  // liên quan (lịch, hồ sơ, hóa đơn...) bị khóa ngoại giữ lại nên bỏ qua êm, không xóa nhầm.
  async cleanupUnverifiedPatients(now = new Date(), batchSize = 200) {
    const cutoff = new Date(now.getTime() - UNVERIFIED_PATIENT_RETENTION_DAYS * DAY_MS);
    const candidates = await prisma.user.findMany({
      where: {
        role: "PATIENT",
        isEmailVerified: false,
        createdAt: { lt: cutoff },
        appointments: { none: {} },
      },
      select: { id: true },
      take: batchSize,
    });

    let deleted = 0;
    for (const candidate of candidates) {
      try {
        await prisma.user.delete({ where: { id: candidate.id } });
        deleted += 1;
      } catch {
        // Còn dữ liệu liên quan: giữ lại.
      }
    }
    return { deleted };
  }

  // Bảo trì lịch hẹn (mỗi vài phút): khung giờ, nhắc thanh toán, hủy lịch quá hạn, không đến, dọn OTP và dữ liệu xác thực cũ.
  async runLifecycleSweep() {
    const logNoop = shouldLogWorkerNoop();

    // Giữ cửa sổ khung giờ các ngày tới luôn đầy (có giới hạn tần suất bên trong).
    const slotWindow = await SlotPlannerService.generateRollingWindow().catch((error) => {
      logger.error("[SLOT_PLANNER] rolling window failed:", error);
      return null;
    });
    if (slotWindow && slotWindow.generatedCount > 0) {
      logger.info(`[SLOT_PLANNER] generated=${slotWindow.generatedCount} doctors=${slotWindow.doctors}`);
    }

    // Nhắc thanh toán chỉ cần quét thưa (mỗi hóa đơn chỉ nhắc một lần).
    const invoiceReminders =
      Date.now() - lastInvoiceReminderAt >= INVOICE_REMINDER_EVERY_MS
        ? await InvoiceService.sendPaymentReminders().catch((error) => {
            logger.error("[INVOICE_REMINDER] sweep failed:", error);
            return null;
          })
        : null;
    if (invoiceReminders) lastInvoiceReminderAt = Date.now();
    if (invoiceReminders && invoiceReminders.reminded > 0) {
      logger.info(`[INVOICE_REMINDER] reminded=${invoiceReminders.reminded}`);
    }

    // Chạy tuần tự để RECONCILIATION_CONCURRENCY là trần chung của một lượt quét.
    const pendingOtp = await AppointmentService.reconcileExpiredPendingOtp();
    const pendingConfirm = await AppointmentService.reconcilePastPendingConfirmations();
    const noShows = await AppointmentService.reconcileNoShows();
    const otpCleanup = await AuthOtpService.cleanupExpired();
    const authCleanup = await this.cleanupAuthArtifacts().catch((error) => {
      logger.error("[AUTH_CLEANUP] failed:", error);
      return { sessions: 0, challenges: 0 };
    });
    await this.cleanupUnverifiedPatients().catch((error) => logger.error("[UNVERIFIED_PATIENT_CLEANUP] failed:", error));
    const chatbotCleanup = await this.cleanupChatbotData().catch((error) => {
      logger.error("[CHATBOT_CLEANUP] failed:", error);
      return { mode: "off" as const, sessions: 0, logs: 0 };
    });
    if (chatbotCleanup.sessions > 0 || chatbotCleanup.logs > 0) {
      const verb = chatbotCleanup.mode === "delete" ? "Deleted" : "WouldDelete";
      logger.info(`[CHATBOT_CLEANUP] mode=${chatbotCleanup.mode} sessions${verb}=${chatbotCleanup.sessions} logs${verb}=${chatbotCleanup.logs}`);
    }

    if (noShows.marked > 0 || otpCleanup.deleted > 0 || authCleanup.sessions > 0 || authCleanup.challenges > 0) {
      logger.info(
        `[LIFECYCLE_MAINTENANCE] noShowMarked=${noShows.marked} otpDeleted=${otpCleanup.deleted} sessionsDeleted=${authCleanup.sessions} challengesDeleted=${authCleanup.challenges}`,
      );
    }
    if (
      logNoop ||
      pendingOtp.scanned > 0 ||
      pendingOtp.expired > 0 ||
      pendingConfirm.scanned > 0 ||
      pendingConfirm.expired > 0
    ) {
      logger.info(
        `[APPOINTMENT_RECONCILIATION] pendingOtp(scanned=${pendingOtp.scanned}, expired=${pendingOtp.expired}, noop=${pendingOtp.noop}) pendingConfirm(scanned=${pendingConfirm.scanned}, expired=${pendingConfirm.expired}, noop=${pendingConfirm.noop})`,
      );
    }
    return { pendingOtp, pendingConfirm, noShows, otpCleanup, authCleanup };
  }

  async runSlotReconciliation() {
    const result = await ScheduleReconciliationService.reconcile();
    if (shouldLogWorkerNoop() || result.findingCount > 0 || result.repairedCount > 0) {
      logger.info(
        `[SLOT_RECONCILIATION] scanned=${result.scanned} findings=${result.findingCount} repaired=${result.repairedCount}`,
      );
    }
    return result;
  }
}

export default new MaintenanceService();
