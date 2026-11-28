import type { AppointmentStatus } from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { maskEmail } from "../config/otpChannels.js";
import { AppError } from "../utils/appError.js";
import AuditLogService from "./auditLog.service.js";
import AuthOtpService from "./authOtp.service.js";
import AuthSessionService from "./authSession.service.js";

// Người khám tự xóa tài khoản (Google Play bắt buộc với ứng dụng có tạo tài khoản).
// Hồ sơ khám, đơn thuốc, hóa đơn phải giữ theo quy định lưu trữ nên không xóa dòng: tài khoản bị đóng và ẩn danh
// (tên, email, số điện thoại, giấy tờ, địa chỉ, BHYT), mọi phiên bị thu hồi. Email cũ dùng đăng ký lại được.
// Không làm được hoàn tác: bắt buộc xác thực OTP gửi tới email của chính tài khoản ngay trước khi xóa.

const PURPOSE = "ACCOUNT_DELETION" as const;
const CHALLENGE_EXPIRES_SECONDS = 5 * 60;
const MAX_CHALLENGE_ATTEMPTS = 5;
const ANONYMOUS_NAME = "Người khám đã xóa tài khoản";
const ANONYMOUS_DEPENDENT_NAME = "Người thân (tài khoản đã xóa)";

// Lịch còn hiệu lực: phải hủy (hoặc khám xong) trước khi xóa, để cơ sở khám không giữ chỗ cho tài khoản không còn liên lạc được.
const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = ["PENDING_OTP", "PENDING_CONFIRM", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "RESCHEDULED"];

const anonymousEmail = (userId: string) => `deleted-${userId}@deleted.invalid`;

// Endpoint này đã đăng nhập sẵn: ứng dụng coi 401 là "phiên hết hạn" nên tự làm mới phiên rồi gửi lại đúng yêu cầu đó. Mã xác nhận sai
// hay thử thách không hợp lệ là lỗi nhập liệu (400), không phải lỗi phiên, nên không bao giờ trả 401 ở đây.
const INVALID_CODE_CODE = "ACCOUNT_DELETION_CODE_INVALID";
const asInputError = (error: unknown) =>
  error instanceof AppError && error.statusCode === 401
    ? new AppError(error.message, 400, INVALID_CODE_CODE)
    : error;

type RequestMeta = { ipAddress: string; sessionId?: string };

async function assertDeletable(userId: string) {
  const [activeAppointments, unpaidInvoices] = await Promise.all([
    prisma.appointment.count({ where: { patientId: userId, status: { in: ACTIVE_APPOINTMENT_STATUSES } } }),
    prisma.invoice.count({ where: { patientId: userId, status: "UNPAID" } }),
  ]);
  if (activeAppointments > 0) {
    throw new AppError(
      "Bạn còn lịch hẹn chưa khám. Vui lòng hủy lịch (hoặc chờ khám xong) trước khi xóa tài khoản.",
      409,
      "ACCOUNT_HAS_ACTIVE_APPOINTMENTS",
    );
  }
  if (unpaidInvoices > 0) {
    throw new AppError(
      "Bạn còn hóa đơn chưa thanh toán. Vui lòng thanh toán hoặc liên hệ cơ sở khám trước khi xóa tài khoản.",
      409,
      "ACCOUNT_HAS_UNPAID_INVOICES",
    );
  }
}

async function findPatient(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true, isActive: true } });
  if (!user || user.role !== "PATIENT" || !user.isActive) throw new AppError("Vui lòng đăng nhập", 401);
  return user;
}

const PatientAccountDeletionService = {
  /** Gửi mã xác nhận xóa tài khoản tới email của tài khoản đang đăng nhập. */
  async requestOtp(userId: string, meta: RequestMeta) {
    const user = await findPatient(userId);
    await assertDeletable(userId);

    const challenge = await prisma.dashboardLoginChallenge.create({
      data: { userId, purpose: PURPOSE, ipAddress: meta.ipAddress, expiresAt: new Date(Date.now() + CHALLENGE_EXPIRES_SECONDS * 1000) },
      select: { id: true, expiresAt: true },
    });
    try {
      const otp = await AuthOtpService.sendOtp(user.email, PURPOSE, meta.ipAddress, { challengeId: challenge.id, userId });
      if (otp.deliveryStatus === "FAILED" && !otp.debugOtp) {
        throw new AppError("Chưa gửi được mã tới email. Vui lòng thử lại sau ít phút.", 503, "OTP_DELIVERY_FAILED");
      }
      // Chỉ mã mới nhất dùng được.
      await prisma.dashboardLoginChallenge.updateMany({
        where: { userId, purpose: PURPOSE, usedAt: null, id: { not: challenge.id } },
        data: { usedAt: new Date() },
      });
      return {
        challengeId: challenge.id,
        maskedTarget: maskEmail(user.email),
        deliveryStatus: otp.deliveryStatus,
        expiresAt: challenge.expiresAt,
        expiresIn: CHALLENGE_EXPIRES_SECONDS,
        debugOtp: otp.debugOtp,
      };
    } catch (error) {
      await prisma.dashboardLoginChallenge.deleteMany({ where: { id: challenge.id } });
      throw error;
    }
  },

  /** Xác thực mã rồi đóng và ẩn danh tài khoản trong một giao dịch. */
  async confirm(userId: string, input: { challengeId: string; otp: string }, meta: RequestMeta) {
    const user = await findPatient(userId);
    const challenge = await prisma.dashboardLoginChallenge.findUnique({
      where: { id: input.challengeId },
      include: { otpCodes: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    // Thử thách phải là của chính tài khoản này và đúng mục đích xóa: mã đăng nhập hay mã của người khác không dùng được.
    if (!challenge || challenge.userId !== userId || challenge.purpose !== PURPOSE || challenge.usedAt || challenge.expiresAt <= new Date()) {
      throw new AppError("Mã xác nhận không hợp lệ hoặc đã hết hạn", 400, "ACCOUNT_DELETION_CHALLENGE_INVALID");
    }
    if (challenge.attempts >= MAX_CHALLENGE_ATTEMPTS) throw new AppError("Bạn đã nhập sai mã quá nhiều lần", 429);

    try {
      await AuthOtpService.verifyOtp(challenge.otpCodes[0]?.email || user.email, input.otp, PURPOSE, {
        challengeId: challenge.id,
        ipAddress: challenge.ipAddress || undefined,
      });
    } catch (error) {
      await prisma.dashboardLoginChallenge.updateMany({ where: { id: challenge.id, usedAt: null }, data: { attempts: { increment: 1 } } });
      throw asInputError(error);
    }

    const claimed = await prisma.dashboardLoginChallenge.updateMany({ where: { id: challenge.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw new AppError("Mã xác nhận đã được sử dụng", 400, "ACCOUNT_DELETION_CHALLENGE_INVALID");

    // Kiểm lại ngay trước khi xóa: có thể vừa đặt lịch mới trong lúc chờ mã.
    await assertDeletable(userId);

    await prisma.$transaction(async (tx) => {
      await AuthSessionService.revokeAllForUser({ userId, kind: "PATIENT" }, tx);

      await tx.user.update({
        where: { id: userId },
        data: {
          fullName: ANONYMOUS_NAME,
          email: anonymousEmail(userId),
          phone: null,
          avatar: null,
          password: null,
          isActive: false,
          isEmailVerified: false,
        },
      });
      await tx.patientProfile.deleteMany({ where: { userId } });

      // Hồ sơ người thân: giữ dòng (lịch cũ trỏ tới) nhưng bỏ mọi thông tin nhận diện.
      await tx.dependentProfile.updateMany({
        where: { ownerId: userId },
        data: {
          fullName: ANONYMOUS_DEPENDENT_NAME,
          phone: null,
          email: null,
          dateOfBirth: null,
          cccd: null,
          address: null,
          healthInsuranceCode: null,
          registeredHospital: null,
          isActive: false,
        },
      });

      // Lịch cũ: thông tin liên hệ chụp lúc đặt và nhân khẩu kèm lịch được ẩn danh; nội dung khám giữ nguyên.
      await tx.appointment.updateMany({
        where: { patientId: userId },
        data: { patientName: ANONYMOUS_NAME, patientPhone: "", patientEmail: anonymousEmail(userId) },
      });
      await tx.appointmentPatientInfo.updateMany({
        where: { appointment: { patientId: userId } },
        data: { dateOfBirth: null, address: null, cccd: null, healthInsuranceCode: null, registeredHospital: null },
      });

      // Dữ liệu chỉ phục vụ người dùng (không thuộc hồ sơ khám): xóa.
      await tx.notification.deleteMany({ where: { userId } });
      await tx.notificationPreference.deleteMany({ where: { userId } });
      await tx.chatbotSession.deleteMany({ where: { userId } });
      await tx.chatbotLog.deleteMany({ where: { userId } });
      await tx.dashboardLoginChallenge.deleteMany({ where: { userId, id: { not: challenge.id } } });
      // Bản ghi mã cũ lưu email đích: bỏ để email không còn gắn với tài khoản đã xóa.
      await tx.otpCode.deleteMany({ where: { OR: [{ userId }, { email: user.email }] } });

      // Nhật ký chỉ ghi mã tài khoản (không ghi email, tên).
      await AuditLogService.record(
        { actor: { userId, role: "PATIENT" }, action: "PATIENT_ACCOUNT_DELETED", targetType: "USER", targetId: userId, ipAddress: meta.ipAddress },
        tx,
      );
    });

    return { deleted: true };
  },
};

export default PatientAccountDeletionService;
