import PolicyService from "../policy.service.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { enqueuePendingOtpExpiry } from "../../queues/appointmentLifecycle.queue.js";
import AuthOtpService from "../authOtp.service.js";
import { canSkipBookingOtp } from "../bookingIdentity.js";
import { writeAppointmentLog } from "../appointmentLog.service.js";
import { AppError } from "../../utils/appError.js";
import {
  getVietnamNowParts,
  isSlotStartInPastVietnamTime,
  parseDateOnly,
} from "../../utils/time.js";
import StaffNotificationService from "../staffNotification.service.js";
import {
  signBookingHoldReleaseGrant,
  verifyBookingHoldReleaseGrant,
} from "../../utils/bookingHoldGrant.js";
import {
  HEALTH_CONSENT_VERSION,
  PATIENT_CANCEL_ALLOWED_STATUSES,
  appointmentSelect,
  flattenPatientInfo,
  getOtpLogNote,
  normalizeOptionalString,
  parseOptionalDate,
  patientInfoSelect,
  resolveBookingIdentity,
  type CreateAppointmentInput,
  type PatientBookingActor,
} from "./appointment.shared.js";
import { AppointmentServiceSupport } from "./appointment.support.js";
import type { AppointmentLifecycleUseCases } from "./appointmentLifecycle.service.js";
import { logger } from "../../observability/logger.js";
const verifiedAppointmentSelect = {
  id: true,
  patientId: true,
  dependentProfileId: true,
  patientName: true,
  patientPhone: true,
  patientEmail: true,
  patientInfo: { select: patientInfoSelect },
  status: true,
  holdExpiresAt: true,
  createdAt: true,
} satisfies Prisma.AppointmentSelect;

type VerifiedAppointmentRow = Prisma.AppointmentGetPayload<{
  select: typeof verifiedAppointmentSelect;
}>;

/**
 * Căn cứ xác nhận lịch hẹn:
 * - OTP: người đặt vừa nhập đúng mã gửi tới email.
 * - ACCOUNT_SESSION: người đặt đang đăng nhập (phiên đã qua OTP) và đặt cho chính
 *   mình bằng đúng email của tài khoản, nên không cần OTP lần nữa.
 */
type BookingVerificationProof = "OTP" | "ACCOUNT_SESSION";

export class AppointmentBookingUseCases extends AppointmentServiceSupport {
  constructor(
    private readonly lifecycle: Pick<
      AppointmentLifecycleUseCases,
      "expirePendingOtpAppointment"
    >,
  ) {
    super();
  }

  async create(
    input: CreateAppointmentInput,
    ipAddress: string,
    actor?: PatientBookingActor,
  ) {
    // Chỉ tính dữ liệu sức khỏe do người đặt khai báo ở yêu cầu này; hồ sơ đã lưu của
    // tài khoản/người thân được gộp vào sau đó và không đòi đồng ý lại mỗi lần đặt.
    const hasHealthData = [input.allergies, input.medicalHistory, input.familyHistory].some(
      (value) => normalizeOptionalString(value),
    );
    const bookingIdentity = await resolveBookingIdentity(input, actor);
    input = bookingIdentity.input;
    // Khai báo dị ứng/tiền sử là dữ liệu sức khỏe: chỉ lưu khi người đặt đồng ý rõ ràng.
    if (hasHealthData && input.healthConsent !== true) {
      throw new AppError(
        "Cần đồng ý cho phép cơ sở khám lưu thông tin sức khỏe trước khi đặt lịch",
        400,
        "HEALTH_CONSENT_REQUIRED",
      );
    }
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: input.doctorId },
      select: {
        id: true,
        departmentId: true,
        consultationFee: true,
        isAvailable: true,
        user: { select: { isActive: true } },
        department: { select: { isActive: true } },
      },
    });

    if (!doctor || !doctor.isAvailable || !doctor.user.isActive) {
      throw new AppError("Bác sĩ không sẵn sàng nhận lịch", 400);
    }

    if (
      doctor.departmentId !== input.departmentId ||
      !doctor.department.isActive
    ) {
      throw new AppError("Bác sĩ không thuộc chuyên khoa đã chọn", 400);
    }

    const department = await prisma.department.findUnique({
      where: { id: input.departmentId },
      select: { id: true, isActive: true },
    });

    if (!department || !department.isActive) {
      throw new AppError("Chuyên khoa không hoạt động", 400);
    }

    const packageItem = input.packageId
      ? await prisma.package.findUnique({
          where: { id: input.packageId },
          select: {
            id: true,
            basePrice: true,
            serviceFee: true,
            isActive: true,
            departmentId: true,
            items: {
              select: {
                price: true,
                included: true,
              },
            },
          },
        })
      : null;

    if (input.packageId && !packageItem) {
      throw new AppError("Không tìm thấy gói khám", 404);
    }

    if (packageItem && !packageItem.isActive) {
      throw new AppError("Gói khám không hoạt động", 400);
    }

    if (
      packageItem?.departmentId &&
      packageItem.departmentId !== input.departmentId
    ) {
      throw new AppError("Gói khám không thuộc chuyên khoa đã chọn", 400);
    }

    const timeSlot = await prisma.doctorTimeSlot.findUnique({
      where: { id: input.timeSlotId },
      select: {
        id: true,
        doctorId: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        isActive: true,
        appointment: { select: { id: true } },
      },
    });

    if (
      !timeSlot ||
      timeSlot.doctorId !== input.doctorId ||
      timeSlot.status !== "AVAILABLE" ||
      !timeSlot.isActive ||
      timeSlot.appointment
    ) {
      throw new AppError("Khung giờ không khả dụng", 409);
    }

    const packageIncludedItemsTotal =
      packageItem?.items
        .filter((item) => item.included)
        .reduce((total, item) => total + item.price, 0) || 0;
    const estimatedPrice = packageItem
      ? packageIncludedItemsTotal || packageItem.basePrice
      : doctor.consultationFee;
    const serviceFee = packageItem?.serviceFee ?? 0;
    const bhytDiscount = 0;
    const finalAmount = estimatedPrice + serviceFee - bhytDiscount;
    const patientDateOfBirth = parseOptionalDate(input.dateOfBirth);
    const patientEmail = input.patientEmail.trim().toLowerCase();
    const skipOtp = canSkipBookingOtp({
      isAuthenticated: Boolean(bookingIdentity.patientId),
      dependentProfileId: bookingIdentity.dependentProfileId,
    });
    const holdExpiresAt = new Date(
      Date.now() + (await PolicyService.get()).bookingHoldMinutes * 60 * 1000,
    );

    if (isSlotStartInPastVietnamTime(timeSlot.date, timeSlot.startTime)) {
      throw new AppError("Khung giờ khám đã qua", 400);
    }

    if (
      patientDateOfBirth &&
      patientDateOfBirth >= parseDateOnly(getVietnamNowParts().date)
    ) {
      throw new AppError("Ngày sinh phải nhỏ hơn ngày hiện tại", 400);
    }

    // Email là định danh duy nhất: OTP gửi về chính email này nên người xác thực thành công là chủ email.
    const existingUser = await prisma.user.findUnique({
      where: { email: patientEmail },
      select: { id: true, role: true },
    });

    if (existingUser && existingUser.role !== "PATIENT") {
      throw new AppError("Email này thuộc tài khoản nội bộ, không dùng để đặt lịch", 409, "EMAIL_RESERVED");
    }

    let appointmentId = "";
    let bookingCode = "";
    let confirmed = false;

    try {
      const appointment = await prisma.$transaction(async (tx) => {
        const slotUpdate = await tx.doctorTimeSlot.updateMany({
          where: {
            id: input.timeSlotId,
            status: "AVAILABLE",
            isActive: true,
          },
          data: {
            status: "BOOKED",
          },
        });

        if (slotUpdate.count !== 1) {
          throw new AppError("Khung giờ đã được đặt", 409);
        }

        const patient = bookingIdentity.patientId
          ? await tx.user.findUniqueOrThrow({
              where: { id: bookingIdentity.patientId },
              select: { id: true, role: true },
            })
          : await tx.user.upsert({
              where: { email: patientEmail },
              update: {},
              create: {
                fullName: input.patientName,
                email: patientEmail,
                phone: input.patientPhone,
                role: "PATIENT",
              },
              select: {
                id: true,
                role: true,
              },
            });

        if (patient.role !== "PATIENT") {
          throw new AppError("Email này thuộc tài khoản nội bộ, không dùng để đặt lịch", 409, "EMAIL_RESERVED");
        }

        const createdAppointment = await tx.appointment.create({
          data: {
            bookingCode: await this.generateUniqueBookingCode(tx),
            appointmentDate: timeSlot.date,
            startTime: timeSlot.startTime,
            endTime: timeSlot.endTime,
            status: "PENDING_OTP",
            holdExpiresAt,
            reason: normalizeOptionalString(input.reason),
            patientName: input.patientName,
            patientPhone: input.patientPhone,
            patientEmail,
            // Nhân khẩu, bảo hiểm và khai báo sức khỏe nằm ở bảng riêng (dữ liệu nhạy cảm).
            patientInfo: {
              create: {
                gender: input.gender,
                dateOfBirth: patientDateOfBirth,
                address: normalizeOptionalString(input.address),
                cccd: normalizeOptionalString(input.cccd),
                hasBHYT: input.hasBHYT ?? false,
                healthInsuranceCode: normalizeOptionalString(
                  input.healthInsuranceCode,
                ),
                registeredHospital: normalizeOptionalString(
                  input.registeredHospital,
                ),
                ...(hasHealthData
                  ? {
                      healthConsentAt: new Date(),
                      healthConsentVersion: HEALTH_CONSENT_VERSION,
                    }
                  : {}),
                allergies: normalizeOptionalString(input.allergies),
                medicalHistory: normalizeOptionalString(input.medicalHistory),
                familyHistory: normalizeOptionalString(input.familyHistory),
              },
            },
            estimatedPrice,
            serviceFee,
            bhytDiscount,
            finalAmount,
            patientId: patient.id,
            dependentProfileId: bookingIdentity.dependentProfileId,
            doctorId: input.doctorId,
            departmentId: input.departmentId,
            packageId: input.packageId || null,
            timeSlotId: input.timeSlotId,
          },
          select: {
            id: true,
            bookingCode: true,
          },
        });

        await writeAppointmentLog(tx, {
          appointmentId: createdAppointment.id,
          action: "APPOINTMENT_CREATED",
          note: "Người khám tạo lịch hẹn và chờ xác thực OTP",
        });

        return createdAppointment;
      });

      appointmentId = appointment.id;
      bookingCode = appointment.bookingCode;

      if (skipOtp) {
        const verified = await prisma.appointment.findUniqueOrThrow({
          where: { id: appointmentId },
          select: verifiedAppointmentSelect,
        });
        const confirmedAppointment = await this.confirmVerifiedAppointment(
          verified,
          "ACCOUNT_SESSION",
        );
        confirmed = true;
        try {
          await StaffNotificationService.notifyAppointmentEvent(
            confirmedAppointment.id,
            "CREATED",
            { includeReception: true },
          );
        } catch (error) {
          // Lịch đã xác nhận; lỗi báo lễ tân không được làm mất lịch của người khám.
          logger.error(
            `[APPOINTMENT_NOTIFY] appointment=${appointmentId} failed:`,
            error,
          );
        }
        return {
          appointmentId,
          bookingCode,
          patientPhone: input.patientPhone,
          otpRequired: false as const,
          holdExpiresAt: null,
          appointment: confirmedAppointment,
        };
      }

      try {
        const scheduled = await enqueuePendingOtpExpiry(
          appointmentId,
          holdExpiresAt,
        );
        logger.info(
          `[APPOINTMENT_EXPIRY] appointment=${appointmentId} scheduled=${scheduled}`,
        );
      } catch (error) {
        logger.error(
          `[APPOINTMENT_EXPIRY] appointment=${appointmentId} scheduling failed:`,
          error,
        );
      }

      const otp = await AuthOtpService.sendOtp(patientEmail, "BOOK_APPOINTMENT", ipAddress);

      await writeAppointmentLog(prisma, {
        appointmentId,
        action: "OTP_SENT",
        note: getOtpLogNote("OTP xác thực đặt lịch", otp.deliveryStatus),
      });

      return {
        appointmentId,
        bookingCode,
        patientPhone: input.patientPhone,
        otpRequired: true as const,
        holdExpiresAt,
        holdReleaseToken: signBookingHoldReleaseGrant({
          appointmentId,
          expiresAt: holdExpiresAt,
        }),
        otpDeliveryStatus: otp.deliveryStatus,
        debugOtp: otp.debugOtp,
        expiresIn: otp.expiresIn,
      };
    } catch (error) {
      if (appointmentId && !confirmed) {
        await this.releasePendingAppointment(appointmentId);
      }

      throw error;
    }
  }

  /**
   * Chuyển lịch từ PENDING_OTP sang CONFIRMED (tự xác nhận) và cập nhật hồ sơ người khám.
   * Chỉ căn cứ OTP mới được ghi email/SĐT "đã xác thực" vào tài khoản; căn cứ phiên
   * đăng nhập thì giữ nguyên các cờ xác thực vì chưa có bằng chứng mới.
   */
  private async confirmVerifiedAppointment(
    appointment: VerifiedAppointmentRow,
    proof: BookingVerificationProof,
  ) {
    return prisma.$transaction(async (tx) => {
      await this.claimAppointmentTransition(tx, {
        id: appointment.id,
        expectedStatuses: ["PENDING_OTP"],
        // Đặt online đã xác thực thì xác nhận luôn: lễ tân không phải bấm thêm một bước cho mọi lịch.
        nextStatus: "CONFIRMED",
        data: { holdExpiresAt: null, confirmedAt: new Date() },
      });

      if (appointment.dependentProfileId) {
        // OTP thuộc tài khoản quản lý. Thông tin người thân không bao giờ ghi đè tên hay hồ sơ của chủ tài khoản.
        if (proof === "OTP") {
          await tx.user.update({
            where: { id: appointment.patientId },
            data: { isEmailVerified: true },
          });
        }
      } else {
        const info = appointment.patientInfo;

        const cccdOwner = info?.cccd
          ? await tx.patientProfile.findUnique({
              where: { cccd: info.cccd },
              select: { userId: true },
            })
          : null;

        if (cccdOwner && cccdOwner.userId !== appointment.patientId) {
          throw new AppError(
            "CCCD đã được sử dụng cho hồ sơ người khám khác",
            409,
          );
        }

        if (proof === "OTP") {
          // Chỉ căn cứ OTP mới ghi "email đã xác thực" vào tài khoản; số điện thoại chỉ bổ sung khi tài khoản chưa có.
          const account = await tx.user.findUniqueOrThrow({
            where: { id: appointment.patientId },
            select: { phone: true },
          });
          await tx.user.update({
            where: { id: appointment.patientId },
            data: {
              fullName: appointment.patientName,
              isEmailVerified: true,
              ...(account.phone ? {} : { phone: appointment.patientPhone }),
            },
          });
        }

        await tx.patientProfile.upsert({
          where: { userId: appointment.patientId },
          update: {
            ...(info?.gender ? { gender: info.gender } : {}),
            ...(info?.dateOfBirth ? { dateOfBirth: info.dateOfBirth } : {}),
            ...(info?.cccd ? { cccd: info.cccd } : {}),
            ...(info?.address ? { address: info.address } : {}),
            ...(info?.hasBHYT ? { hasBHYT: true } : {}),
            ...(info?.healthInsuranceCode
              ? { healthInsuranceCode: info.healthInsuranceCode }
              : {}),
            ...(info?.registeredHospital
              ? { registeredHospital: info.registeredHospital }
              : {}),
            ...(info?.allergies ? { allergies: info.allergies } : {}),
            ...(info?.medicalHistory
              ? { medicalHistory: info.medicalHistory }
              : {}),
            ...(info?.familyHistory
              ? { familyHistory: info.familyHistory }
              : {}),
          },
          create: {
            userId: appointment.patientId,
            gender: info?.gender,
            dateOfBirth: info?.dateOfBirth,
            cccd: info?.cccd,
            address: info?.address,
            hasBHYT: info?.hasBHYT ?? false,
            healthInsuranceCode: info?.healthInsuranceCode,
            registeredHospital: info?.registeredHospital,
            allergies: info?.allergies,
            medicalHistory: info?.medicalHistory,
            familyHistory: info?.familyHistory,
          },
        });
      }

      await writeAppointmentLog(tx, {
        appointmentId: appointment.id,
        action: "OTP_VERIFIED",
        note:
          proof === "OTP"
            ? "Người khám đã xác thực OTP đặt lịch"
            : "Người khám đang đăng nhập, đặt cho chính mình nên không cần OTP",
      });

      await this.createTransitionLog(tx, {
        appointmentId: appointment.id,
        action: "CONFIRMED",
        note: "Lịch hẹn được xác nhận tự động sau khi xác thực",
      });
      await this.createAppointmentConfirmationNotification(tx, appointment.id);
      await this.createAppointmentReminderNotification(tx, appointment.id);

      return flattenPatientInfo(
        await tx.appointment.findUniqueOrThrow({
          where: { id: appointment.id },
          select: appointmentSelect,
        }),
      );
    });
  }

  async abandonPendingOtp(id: string, holdReleaseToken: string) {
    try {
      verifyBookingHoldReleaseGrant(holdReleaseToken, id);
    } catch {
      throw new AppError(
        "Quyền hủy giữ lịch không hợp lệ hoặc đã hết hạn",
        401,
        "BOOKING_HOLD_GRANT_INVALID",
      );
    }

    return prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id },
        select: { status: true, timeSlotId: true },
      });
      if (!appointment) {
        throw new AppError("Không tìm thấy lịch chờ xác thực", 404);
      }
      if (appointment.status === "CANCELLED_BY_PATIENT") {
        return { released: true, alreadyReleased: true };
      }
      if (appointment.status !== "PENDING_OTP") {
        throw new AppError(
          "Lịch hẹn không còn ở trạng thái chờ xác thực",
          409,
          "APPOINTMENT_STATE_CONFLICT",
        );
      }

      const releasedAt = new Date();
      const claimed = await tx.appointment.updateMany({
        where: { id, status: "PENDING_OTP" },
        data: {
          status: "CANCELLED_BY_PATIENT",
          cancelledAt: releasedAt,
          cancelledReason: "Người đặt chủ động bỏ lịch trước khi xác thực OTP",
        },
      });
      if (claimed.count !== 1) {
        throw new AppError(
          "Trạng thái lịch hẹn đã thay đổi, vui lòng tải lại dữ liệu",
          409,
          "APPOINTMENT_STATE_CONFLICT",
        );
      }

      await this.releaseAppointmentSlot(tx, id, appointment.timeSlotId);
      await this.createTransitionLog(tx, {
        appointmentId: id,
        action: "CANCELLED_BY_PATIENT",
        note: "Người đặt chủ động bỏ lịch trước khi xác thực OTP",
      });

      return { released: true, alreadyReleased: false };
    });
  }

  async resendOtp(id: string, ipAddress: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: {
        id: true,
        patientEmail: true,
        status: true,
        holdExpiresAt: true,
        createdAt: true,
      },
    });

    if (!appointment) {
      throw new AppError("Không tìm thấy lịch hẹn", 404);
    }

    if (appointment.status !== "PENDING_OTP") {
      throw new AppError("Lịch hẹn không ở trạng thái chờ OTP", 400);
    }

    if (this.isPendingOtpHoldExpired(appointment)) {
      await this.lifecycle.expirePendingOtpAppointment(appointment.id);
      throw new AppError(
        "Thời gian giữ lịch đã hết, vui lòng chọn lại khung giờ",
        410,
        "BOOKING_HOLD_EXPIRED",
      );
    }

    const otp = await AuthOtpService.sendOtp(
      appointment.patientEmail,
      "BOOK_APPOINTMENT",
      ipAddress,
    );

    await writeAppointmentLog(prisma, {
      appointmentId: appointment.id,
      action: "OTP_SENT",
      note: getOtpLogNote(
        "OTP xác thực đặt lịch gửi lại",
        otp.deliveryStatus,
      ),
    });

    return {
      otpDeliveryStatus: otp.deliveryStatus,
      debugOtp: otp.debugOtp,
      expiresIn: otp.expiresIn,
      holdExpiresAt: appointment.holdExpiresAt,
    };
  }

  async verifyOtp(id: string, otp: string, ipAddress?: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: verifiedAppointmentSelect,
    });

    if (!appointment) {
      throw new AppError("Không tìm thấy lịch hẹn", 404);
    }

    if (appointment.status !== "PENDING_OTP") {
      throw new AppError("Lịch hẹn không ở trạng thái chờ OTP", 400);
    }

    if (this.isPendingOtpHoldExpired(appointment)) {
      await this.lifecycle.expirePendingOtpAppointment(appointment.id);
      throw new AppError(
        "Thời gian giữ lịch đã hết, vui lòng chọn lại khung giờ",
        410,
        "BOOKING_HOLD_EXPIRED",
      );
    }

    await AuthOtpService.verifyOtp(
      appointment.patientEmail,
      otp,
      "BOOK_APPOINTMENT",
      { ipAddress },
    );

    const updatedAppointment = await this.confirmVerifiedAppointment(
      appointment,
      "OTP",
    );

    await StaffNotificationService.notifyAppointmentEvent(
      updatedAppointment.id,
      "CREATED",
      { includeReception: true },
    );
    return updatedAppointment;
  }

  async cancelByPatient(id: string, patientId: string, reason: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id, patientId },
      select: {
        id: true,
        status: true,
        timeSlotId: true,
        appointmentDate: true,
        startTime: true,
      },
    });

    if (!appointment) {
      throw new AppError("Không tìm thấy lịch hẹn", 404);
    }

    const { patientCancelCutoffHours } = await PolicyService.get();
    if (
      patientCancelCutoffHours > 0 &&
      Date.now() >
        this.getAppointmentStartAt(
          appointment.appointmentDate,
          appointment.startTime,
        ).getTime() -
          patientCancelCutoffHours * 3_600_000
    ) {
      throw new AppError(
        `Không thể tự hủy trong ${patientCancelCutoffHours} giờ trước giờ khám. Vui lòng liên hệ cơ sở khám để được hỗ trợ.`,
        409,
        "PATIENT_CANCEL_CUTOFF",
      );
    }

    const transition = await prisma.$transaction(async (tx) => {
      await this.claimAppointmentTransition(tx, {
        id: appointment.id,
        expectedStatuses: PATIENT_CANCEL_ALLOWED_STATUSES,
        nextStatus: "CANCELLED_BY_PATIENT",
        data: {
          cancelledAt: new Date(),
          cancelledByRole: "PATIENT",
          cancelledById: patientId,
          cancelledReason: reason.trim(),
        },
      });

      await this.releaseAppointmentSlot(
        tx,
        appointment.id,
        appointment.timeSlotId,
      );
      await writeAppointmentLog(tx, {
        appointmentId: appointment.id,
        action: "CANCELLED_BY_PATIENT",
        actorId: patientId,
        note: reason.trim(),
      });

      const notification = await this.createAppointmentCancellationNotification(
        tx,
        appointment.id,
        reason.trim(),
      );

      const updatedAppointment = flattenPatientInfo(
        await tx.appointment.findUniqueOrThrow({
          where: { id: appointment.id },
          select: appointmentSelect,
        }),
      );
      return { appointment: updatedAppointment, notificationId: notification.id };
    });

    await StaffNotificationService.notifyAppointmentEvent(
      transition.appointment.id,
      "CANCELLED",
      { includeReception: true },
    );
    return transition.appointment;
  }
}
