import PolicyService from "../policy.service.js";
import type { OtpChannel } from "../../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";
import { enqueuePendingOtpExpiry } from "../../queues/appointmentLifecycle.queue.js";
import AuthOtpService from "../authOtp.service.js";
import {
  ACCOUNT_LOGIN_REQUIRED_CODE,
  ACCOUNT_LOGIN_REQUIRED_MESSAGE,
  decideGuestBookingIdentity,
} from "../bookingIdentity.js";
import { canDeliverSms } from "../../config/otpChannels.js";
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
  getOtpLogNote,
  normalizeOptionalString,
  parseOptionalDate,
  resolveAppointmentOtpTarget,
  resolveBookingIdentity,
  type CreateAppointmentInput,
  type PatientBookingActor,
} from "./appointment.shared.js";
import { AppointmentServiceSupport } from "./appointment.support.js";
import type { AppointmentLifecycleUseCases } from "./appointmentLifecycle.service.js";
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
        "Cần đồng ý cho phép bệnh viện lưu thông tin sức khỏe trước khi đặt lịch",
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
    const normalizedPatientEmail = normalizeOptionalString(input.patientEmail);
    const otpChannel: OtpChannel =
      input.otpChannel || (normalizedPatientEmail ? "EMAIL" : "SMS");
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

    if (otpChannel === "SMS" && !canDeliverSms(input.patientPhone)) {
      throw new AppError(
        "Hệ thống hiện chỉ gửi mã xác thực qua email. Vui lòng nhập email để nhận mã.",
        400,
        "OTP_CHANNEL_UNAVAILABLE",
      );
    }

    if (otpChannel === "EMAIL" && !normalizedPatientEmail) {
      throw new AppError(
        "Email là bắt buộc khi chọn xác thực OTP qua email",
        400,
      );
    }
    const existingUser = await prisma.user.findUnique({
      where: { phone: input.patientPhone },
      select: { id: true, role: true, email: true, isPhoneVerified: true },
    });

    if (existingUser && existingUser.role !== "PATIENT") {
      throw new AppError("Số điện thoại đã thuộc tài khoản nội bộ", 409);
    }

    // Khách chưa đăng nhập: xác thực email không chứng minh sở hữu số điện
    // thoại, nên không được gắn lịch (và dữ liệu xác thực) vào tài khoản đã có
    // chủ khác. Người đã đăng nhập luôn đặt trên chính tài khoản của mình.
    if (
      !bookingIdentity.patientId &&
      decideGuestBookingIdentity({
        channel: otpChannel,
        existing: existingUser,
        bookingEmail: normalizedPatientEmail,
      }) === "LOGIN_REQUIRED"
    ) {
      throw new AppError(
        ACCOUNT_LOGIN_REQUIRED_MESSAGE,
        409,
        ACCOUNT_LOGIN_REQUIRED_CODE,
      );
    }

    let appointmentId = "";
    let bookingCode = "";

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
              where: { phone: input.patientPhone },
              update: {},
              create: {
                fullName: input.patientName,
                phone: input.patientPhone,
                role: "PATIENT",
                isPhoneVerified: false,
              },
              select: {
                id: true,
                role: true,
              },
            });

        if (patient.role !== "PATIENT") {
          throw new AppError("Số điện thoại đã thuộc tài khoản nội bộ", 409);
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
            patientEmail: normalizedPatientEmail,
            otpChannel,
            patientGender: input.gender,
            patientDateOfBirth,
            patientAddress: normalizeOptionalString(input.address),
            patientCccd: normalizeOptionalString(input.cccd),
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
            logs: {
              create: {
                action: "APPOINTMENT_CREATED",
                note: "Người khám tạo lịch hẹn và chờ xác thực OTP",
              },
            },
          },
          select: {
            id: true,
            bookingCode: true,
          },
        });

        return createdAppointment;
      });

      appointmentId = appointment.id;
      bookingCode = appointment.bookingCode;

      try {
        const scheduled = await enqueuePendingOtpExpiry(
          appointmentId,
          holdExpiresAt,
        );
        console.log(
          `[APPOINTMENT_EXPIRY] appointment=${appointmentId} scheduled=${scheduled}`,
        );
      } catch (error) {
        console.error(
          `[APPOINTMENT_EXPIRY] appointment=${appointmentId} scheduling failed:`,
          error,
        );
      }

      const otp = await AuthOtpService.sendOtp(
        otpChannel === "EMAIL"
          ? normalizedPatientEmail || ""
          : input.patientPhone,
        "BOOK_APPOINTMENT",
        ipAddress,
        { channel: otpChannel },
      );

      await prisma.appointmentLog.create({
        data: {
          appointmentId,
          action: "OTP_SENT",
          note: getOtpLogNote("OTP xác thực đặt lịch", otp.deliveryStatus),
        },
      });

      return {
        appointmentId,
        bookingCode,
        patientPhone: input.patientPhone,
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
      if (appointmentId) {
        await this.releasePendingAppointment(appointmentId);
      }

      throw error;
    }
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
        patientPhone: true,
        patientEmail: true,
        otpChannel: true,
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

    const otpTarget = resolveAppointmentOtpTarget(appointment);
    const otp = await AuthOtpService.sendOtp(
      otpTarget.target,
      "BOOK_APPOINTMENT",
      ipAddress,
      {
        channel: otpTarget.channel,
      },
    );

    await prisma.appointmentLog.create({
      data: {
        appointmentId: appointment.id,
        action: "OTP_SENT",
        note: getOtpLogNote(
          "OTP xác thực đặt lịch gửi lại",
          otp.deliveryStatus,
        ),
      },
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
      select: {
        id: true,
        patientId: true,
        dependentProfileId: true,
        patientName: true,
        patientPhone: true,
        patientEmail: true,
        otpChannel: true,
        patientGender: true,
        patientDateOfBirth: true,
        patientAddress: true,
        patientCccd: true,
        hasBHYT: true,
        healthInsuranceCode: true,
        registeredHospital: true,
        allergies: true,
        medicalHistory: true,
        familyHistory: true,
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

    await AuthOtpService.verifyOtp(
      appointment.otpChannel === "EMAIL"
        ? appointment.patientEmail || ""
        : appointment.patientPhone,
      otp,
      "BOOK_APPOINTMENT",
      { ipAddress, channel: appointment.otpChannel },
    );

    const updatedAppointment = await prisma.$transaction(async (tx) => {
      await this.claimAppointmentTransition(tx, {
        id: appointment.id,
        expectedStatuses: ["PENDING_OTP"],
        nextStatus: "PENDING_CONFIRM",
        data: { holdExpiresAt: null },
      });

      if (appointment.dependentProfileId) {
        // The OTP belongs to the managing account. Dependent snapshots must
        // never overwrite the owner's name or patient profile.
        await tx.user.update({
          where: { id: appointment.patientId },
          data: { isPhoneVerified: true },
        });
      } else {
      const emailOwner = appointment.patientEmail
        ? await tx.user.findUnique({
            where: { email: appointment.patientEmail },
            select: { id: true },
          })
        : null;

      if (emailOwner && emailOwner.id !== appointment.patientId) {
        throw new AppError("Email đã được sử dụng cho tài khoản khác", 409);
      }

      // Kiểm tra lại trong transaction: tài khoản có thể đã được người khác
      // nhận (gắn email) sau khi lịch này được tạo nhưng trước khi xác thực.
      if (appointment.otpChannel === "EMAIL") {
        const account = await tx.user.findUniqueOrThrow({
          where: { id: appointment.patientId },
          select: { email: true, isPhoneVerified: true },
        });
        if (
          decideGuestBookingIdentity({
            channel: "EMAIL",
            existing: account,
            bookingEmail: appointment.patientEmail,
          }) === "LOGIN_REQUIRED"
        ) {
          throw new AppError(
            ACCOUNT_LOGIN_REQUIRED_MESSAGE,
            409,
            ACCOUNT_LOGIN_REQUIRED_CODE,
          );
        }
      }

      const cccdOwner = appointment.patientCccd
        ? await tx.patientProfile.findUnique({
            where: { cccd: appointment.patientCccd },
            select: { userId: true },
          })
        : null;

      if (cccdOwner && cccdOwner.userId !== appointment.patientId) {
        throw new AppError(
          "CCCD đã được sử dụng cho hồ sơ người khám khác",
          409,
        );
      }

      await tx.user.update({
        where: { id: appointment.patientId },
        data: {
          fullName: appointment.patientName,
          ...(appointment.patientEmail
            ? { email: appointment.patientEmail }
            : {}),
          // isPhoneVerified giữ nghĩa "tài khoản đã xác thực bằng OTP" vì phiên
          // đăng nhập bệnh nhân đang kiểm tra cờ này; kênh email còn đánh dấu
          // riêng isEmailVerified để biết đúng thứ đã được chứng minh.
          isPhoneVerified: true,
          ...(appointment.otpChannel === "EMAIL" && appointment.patientEmail
            ? { isEmailVerified: true }
            : {}),
        },
      });

      await tx.patientProfile.upsert({
        where: { userId: appointment.patientId },
        update: {
          ...(appointment.patientGender
            ? { gender: appointment.patientGender }
            : {}),
          ...(appointment.patientDateOfBirth
            ? { dateOfBirth: appointment.patientDateOfBirth }
            : {}),
          ...(appointment.patientCccd
            ? { cccd: appointment.patientCccd }
            : {}),
          ...(appointment.patientAddress
            ? { address: appointment.patientAddress }
            : {}),
          ...(appointment.hasBHYT ? { hasBHYT: true } : {}),
          ...(appointment.healthInsuranceCode
            ? { healthInsuranceCode: appointment.healthInsuranceCode }
            : {}),
          ...(appointment.registeredHospital
            ? { registeredHospital: appointment.registeredHospital }
            : {}),
          ...(appointment.allergies
            ? { allergies: appointment.allergies }
            : {}),
          ...(appointment.medicalHistory
            ? { medicalHistory: appointment.medicalHistory }
            : {}),
          ...(appointment.familyHistory
            ? { familyHistory: appointment.familyHistory }
            : {}),
        },
        create: {
          userId: appointment.patientId,
          gender: appointment.patientGender,
          dateOfBirth: appointment.patientDateOfBirth,
          cccd: appointment.patientCccd,
          address: appointment.patientAddress,
          hasBHYT: appointment.hasBHYT,
          healthInsuranceCode: appointment.healthInsuranceCode,
          registeredHospital: appointment.registeredHospital,
          allergies: appointment.allergies,
          medicalHistory: appointment.medicalHistory,
          familyHistory: appointment.familyHistory,
        },
      });
      }

      await tx.appointmentLog.create({
        data: {
          appointmentId: appointment.id,
          action: "OTP_VERIFIED",
          note: "Người khám đã xác thực OTP đặt lịch",
        },
      });

      return tx.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
        select: appointmentSelect,
      });
    });

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
        `Không thể tự hủy trong ${patientCancelCutoffHours} giờ trước giờ khám. Vui lòng liên hệ bệnh viện để được hỗ trợ.`,
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
      await tx.appointmentLog.create({
        data: {
          appointmentId: appointment.id,
          action: "CANCELLED_BY_PATIENT",
          createdById: patientId,
          note: reason.trim(),
        },
      });

      const notification = await this.createAppointmentCancellationNotification(
        tx,
        appointment.id,
        reason.trim(),
      );

      const updatedAppointment = await tx.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
        select: appointmentSelect,
      });
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
