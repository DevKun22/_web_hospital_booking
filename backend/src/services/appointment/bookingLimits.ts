import type { Prisma } from "../../../generated/prisma/client.js";
import { AppError } from "../../utils/appError.js";
import { getVietnamNowParts, parseDateOnly } from "../../utils/time.js";
import PolicyService from "../policy.service.js";

// Giới hạn đặt lịch theo trạng thái lưu trữ (không theo số lần bấm), để người dùng làm đúng quy trình không bị khóa oan:
//  - trùng bác sĩ cùng ngày, trùng giờ (cùng một người khám);
//  - số lịch sắp tới đang hiệu lực mỗi tài khoản;
//  - hủy lịch đã xác nhận liên tục (giữ chỗ rồi hủy để chiếm khung giờ).
// Chạy trong giao dịch tạo lịch, sau khóa theo tài khoản, nên hai yêu cầu đồng thời không cùng vượt trần.
// Lịch chờ OTP có trần riêng (MAX_OPEN_HOLDS_PER_EMAIL) và lịch bỏ giữ chỗ trước OTP không tính là hủy.

const ACTIVE_STATUSES = ["PENDING_CONFIRM", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] as const;
const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;
const CANCEL_COOLDOWN_MS = 60 * 60 * 1000;

export type BookingLimitInput = {
  patientId: string;
  dependentProfileId: string | null;
  doctorId: string;
  date: Date;
  startTime: string;
  endTime: string;
};

const BookingLimits = {
  // Khóa theo tài khoản đến hết giao dịch, dùng cho cả tạo lịch lẫn xác nhận lịch: hai việc của cùng một tài khoản không chạy chen nhau.
  // SELECT bọc ngoài vì Prisma không đọc được kiểu void của pg_advisory_xact_lock.
  async lockAccount(tx: Prisma.TransactionClient, patientId: string) {
    await tx.$queryRaw`SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(hashtext(${"booking-limit:" + patientId}))) AS locked`;
  },

  async assertAllowed(tx: Prisma.TransactionClient, input: BookingLimitInput, now = new Date()) {
    await this.lockAccount(tx, input.patientId);
    const policy = await PolicyService.get();

    // Hủy lịch đã xác nhận liên tục: tạm khóa đặt mới một giờ tính từ lần hủy gần nhất.
    const recentCancels = await tx.appointment.findMany({
      where: {
        patientId: input.patientId,
        status: "CANCELLED_BY_PATIENT",
        confirmedAt: { not: null },
        cancelledAt: { gte: new Date(now.getTime() - CANCEL_WINDOW_MS) },
      },
      select: { cancelledAt: true },
      orderBy: { cancelledAt: "desc" },
      take: policy.cancelBurstLimit,
    });
    if (recentCancels.length >= policy.cancelBurstLimit && recentCancels[0]?.cancelledAt) {
      const retryAfterSeconds = Math.ceil((recentCancels[0].cancelledAt.getTime() + CANCEL_COOLDOWN_MS - now.getTime()) / 1000);
      if (retryAfterSeconds > 0) {
        throw new AppError(
          `Bạn đã hủy ${policy.cancelBurstLimit} lịch trong 24 giờ qua nên tạm thời chưa đặt thêm được. Vui lòng thử lại sau hoặc liên hệ cơ sở khám.`,
          429,
          "CANCEL_COOLDOWN",
          { retryAfterSeconds },
        );
      }
    }

    // Cùng một người khám (bản thân hoặc một người thân): không trùng bác sĩ trong ngày, không trùng giờ với lịch khác.
    const sameDay = await tx.appointment.findMany({
      where: {
        patientId: input.patientId,
        dependentProfileId: input.dependentProfileId,
        appointmentDate: input.date,
        OR: [{ status: { in: [...ACTIVE_STATUSES] } }, { status: "PENDING_OTP", holdExpiresAt: { gt: now } }],
      },
      select: { doctorId: true, startTime: true, endTime: true },
    });
    if (sameDay.some((item) => item.doctorId === input.doctorId)) {
      throw new AppError(
        "Bạn đã có lịch khám với bác sĩ này trong ngày đã chọn. Vui lòng xem lại lịch hẹn của bạn hoặc chọn ngày khác.",
        409,
        "DUPLICATE_SAME_DAY",
      );
    }
    // Giờ dạng HH:MM nên so sánh chuỗi đúng thứ tự thời gian.
    if (sameDay.some((item) => item.startTime < input.endTime && item.endTime > input.startTime)) {
      throw new AppError(
        "Khung giờ này trùng với một lịch khám khác của bạn. Vui lòng chọn khung giờ khác.",
        409,
        "TIME_OVERLAP",
      );
    }

    // Trần số lịch sắp tới của tài khoản; tài khoản đặt hộ người thân được nới cao hơn.
    const today = parseDateOnly(getVietnamNowParts().date);
    // Lịch đang giữ chỗ chờ OTP cũng tính: đó là lịch sắp thành thật, và lịch đặt khi đã đăng nhập tồn tại ở trạng thái này cho tới khi xác nhận.
    const active = await tx.appointment.count({
      where: {
        patientId: input.patientId,
        OR: [
          { status: { in: [...ACTIVE_STATUSES] }, appointmentDate: { gte: today } },
          { status: "PENDING_OTP", holdExpiresAt: { gt: now } },
        ],
      },
    });
    const hasDependents =
      input.dependentProfileId !== null || (await tx.dependentProfile.count({ where: { ownerId: input.patientId } })) > 0;
    const cap = hasDependents ? policy.maxActiveWithDependents : policy.maxActiveAppointments;
    if (active >= cap) {
      throw new AppError(
        `Bạn đang có ${active} lịch khám sắp tới, đã đạt mức tối đa ${cap}. Vui lòng khám hoặc hủy bớt lịch rồi đặt thêm.`,
        409,
        "ACTIVE_LIMIT",
      );
    }
  },
};

export default BookingLimits;
