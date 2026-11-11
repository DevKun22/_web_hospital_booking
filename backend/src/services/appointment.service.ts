import PolicyService from "./policy.service.js";
import { roleHasAnyPermission } from "./rbac.service.js";
import { Prisma } from "../../generated/prisma/client.js";
import type {
  AppointmentLogAction,
  AppointmentStatus,
  Gender,
  OtpChannel,
  OtpDeliveryStatus,
  Role,
} from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import {
  getAppointmentReconciliationBatchSize,
  getBookingHoldMinutes,
  getReconciliationConcurrency,
} from "../config/environment.js";
import { enqueuePendingOtpExpiry } from "../queues/appointmentLifecycle.queue.js";
import AuthOtpService from "./authOtp.service.js";
import {
  ACCOUNT_LOGIN_REQUIRED_CODE,
  ACCOUNT_LOGIN_REQUIRED_MESSAGE,
  decideGuestBookingIdentity,
} from "./bookingIdentity.js";
import { canDeliverSms } from "../config/otpChannels.js";
import { AppError } from "../utils/appError.js";
import { mapWithConcurrency } from "../utils/concurrency.js";
import { generateBookingCode } from "../utils/bookingCode.js";
import {
  getVietnamNowParts,
  isSlotStartInPastVietnamTime,
  parseDateOnly,
} from "../utils/time.js";
import MedicalRecordService from "./medicalRecord.service.js";
import NotificationDeliveryService from "./notificationDelivery.service.js";
import NotificationService from "./notification.service.js";
import StaffNotificationService from "./staffNotification.service.js";
import {
  signBookingHoldReleaseGrant,
  verifyBookingHoldReleaseGrant,
} from "../utils/bookingHoldGrant.js";

type Actor = {
  userId: string;
  role: Role;
};

type RescheduleAppointmentInput = {
  timeSlotId: string;
  reason: string;
};

type CreateAppointmentInput = {
  dependentProfileId?: string | null;
  packageId?: string | null;
  departmentId: string;
  doctorId: string;
  timeSlotId: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string | null;
  otpChannel?: OtpChannel;
  reason?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  cccd?: string | null;
  address?: string | null;
  hasBHYT?: boolean;
  healthInsuranceCode?: string | null;
  registeredHospital?: string | null;
  allergies?: string | null;
  medicalHistory?: string | null;
  familyHistory?: string | null;
  healthConsent?: boolean;
};

type PatientBookingActor = {
  userId: string;
};

const resolveBookingIdentity = async (
  input: CreateAppointmentInput,
  actor?: PatientBookingActor,
) => {
  if (input.dependentProfileId && !actor) {
    throw new AppError(
      "Vui lòng đăng nhập để đặt lịch cho người thân",
      401,
      "AUTH_REQUIRED_FOR_DEPENDENT_BOOKING",
    );
  }

  if (!actor) {
    return {
      input,
      patientId: undefined,
      dependentProfileId: null,
    };
  }

  const owner = await prisma.user.findFirst({
    where: { id: actor.userId, role: "PATIENT", isActive: true },
    select: { id: true, phone: true, email: true },
  });
  if (!owner?.phone) {
    throw new AppError("Không tìm thấy tài khoản người khám hợp lệ", 401);
  }

  if (!input.dependentProfileId) {
    return {
      input: { ...input, patientPhone: owner.phone },
      patientId: owner.id,
      dependentProfileId: null,
    };
  }

  const dependent = await prisma.dependentProfile.findFirst({
    where: {
      id: input.dependentProfileId,
      ownerId: owner.id,
      isActive: true,
    },
    select: {
      id: true,
      fullName: true,
      dateOfBirth: true,
      gender: true,
      cccd: true,
      address: true,
      hasBHYT: true,
      healthInsuranceCode: true,
      registeredHospital: true,
      allergies: true,
      medicalHistory: true,
      familyHistory: true,
    },
  });
  if (!dependent) {
    throw new AppError(
      "Không tìm thấy hồ sơ người thân thuộc tài khoản này",
      404,
      "DEPENDENT_NOT_FOUND",
    );
  }

  return {
    input: {
      ...input,
      patientName: dependent.fullName,
      patientPhone: owner.phone,
      patientEmail: owner.email,
      gender: dependent.gender,
      dateOfBirth: dependent.dateOfBirth
        ? dependent.dateOfBirth.toISOString().slice(0, 10)
        : null,
      cccd: dependent.cccd,
      address: dependent.address,
      hasBHYT: dependent.hasBHYT,
      healthInsuranceCode: dependent.healthInsuranceCode,
      registeredHospital: dependent.registeredHospital,
      allergies: dependent.allergies,
      medicalHistory: dependent.medicalHistory,
      familyHistory: dependent.familyHistory,
    },
    patientId: owner.id,
    dependentProfileId: dependent.id,
  };
};

type UpdateAppointmentPatientInfoInput = {
  patientName?: string;
  patientEmail?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  cccd?: string | null;
  address?: string | null;
  hasBHYT?: boolean;
  healthInsuranceCode?: string | null;
  registeredHospital?: string | null;
  allergies?: string | null;
  medicalHistory?: string | null;
  familyHistory?: string | null;
};

// Đổi giá trị khi nội dung đồng ý thay đổi để biết ai đã đồng ý phiên bản nào.
export const HEALTH_CONSENT_VERSION = "2026-11";

const getOtpLogNote = (label: string, status: OtpDeliveryStatus) => {
  if (status === "FAILED")
    return `${label} đã được tạo nhưng chưa đưa được vào hàng đợi gửi mã`;
  if (status === "PENDING")
    return `${label} đã được tạo và đang chờ hệ thống gửi mã`;
  return `${label} đã được gửi`;
};

const resolveAppointmentOtpTarget = (appointment: {
  patientPhone: string;
  patientEmail?: string | null;
  otpChannel?: OtpChannel | null;
}) => {
  const channel: OtpChannel =
    appointment.otpChannel === "EMAIL" && appointment.patientEmail
      ? "EMAIL"
      : "SMS";

  return {
    channel,
    target:
      channel === "EMAIL"
        ? appointment.patientEmail || ""
        : appointment.patientPhone,
  };
};

const PATIENT_CANCEL_ALLOWED_STATUSES: AppointmentStatus[] = [
  "PENDING_CONFIRM",
  "CONFIRMED",
];
const DASHBOARD_CANCEL_ALLOWED_STATUSES: AppointmentStatus[] = [
  "PENDING_OTP",
  "PENDING_CONFIRM",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "RESCHEDULED",
  "NO_SHOW",
];

const appointmentSelect = {
  id: true,
  bookingCode: true,
  appointmentDate: true,
  startTime: true,
  endTime: true,
  status: true,
  holdExpiresAt: true,
  reason: true,
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
  estimatedPrice: true,
  serviceFee: true,
  bhytDiscount: true,
  finalAmount: true,
  confirmedAt: true,
  cancelledAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  patient: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      isPhoneVerified: true,
    },
  },
  doctor: {
    select: {
      id: true,
      title: true,
      specialization: true,
      consultationFee: true,
      user: {
        select: {
          fullName: true,
          avatar: true,
        },
      },
    },
  },
  department: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  package: {
    select: {
      id: true,
      name: true,
      slug: true,
      basePrice: true,
      serviceFee: true,
    },
  },
  timeSlot: {
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      status: true,
    },
  },
  invoice: {
    select: {
      id: true,
      invoiceCode: true,
      barcode: true,
      totalAmount: true,
      bhytDiscount: true,
      finalAmount: true,
      insuranceEligibleAmount: true,
      insuranceCoverageRate: true,
      insuranceDiscountAmount: true,
      insuranceRouteType: true,
      insuranceNote: true,
      status: true,
      paymentMethod: true,
      paymentReference: true,
      paidAt: true,
      refundReason: true,
      refundReference: true,
      refundedAt: true,
      createdAt: true,
      updatedAt: true,
      items: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          type: true,
          description: true,
          quantity: true,
          unitPrice: true,
          amount: true,
          sortOrder: true,
        },
      },
      paymentTransactions: {
        orderBy: {
          createdAt: "desc",
        },
        take: 3,
        select: {
          id: true,
          provider: true,
          status: true,
          amount: true,
          transactionCode: true,
          paymentUrl: true,
          paidAt: true,
          expiredAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  },
} satisfies Prisma.AppointmentSelect;

const normalizeOptionalString = (value?: string | null) =>
  value === undefined ? undefined : value || null;

const parseOptionalDate = (value?: string | null) =>
  value ? parseDateOnly(value) : null;

// Tiền sử và dị ứng là dữ liệu y tế: người không có quyền record.view chỉ thấy phần tiếp đón.
const maskClinicalFields = <T extends { allergies?: unknown; medicalHistory?: unknown; familyHistory?: unknown }>(
  appointment: T,
): T => ({ ...appointment, allergies: null, medicalHistory: null, familyHistory: null });

class AppointmentService {
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
      await this.expirePendingOtpAppointment(appointment.id);
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
      await this.expirePendingOtpAppointment(appointment.id);
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

    await this.dispatchNotificationBestEffort(transition.notificationId);
    await StaffNotificationService.notifyAppointmentEvent(
      transition.appointment.id,
      "CANCELLED",
      { includeReception: true },
    );
    return transition.appointment;
  }

  async dashboardList(
    query: {
      status?: AppointmentStatus;
      doctorId?: string;
      date?: string;
      phone?: string;
      bookingCode?: string;
      /** Tìm gần đúng theo mã lịch, số điện thoại hoặc tên người khám (gõ đến đâu lọc đến đó). */
      q?: string;
      billingState?: "PENDING_INVOICE" | "HAS_INVOICE";
      page?: number;
      limit?: number;
    },
    actor: Actor,
  ) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;
    const searchTerm = query.q?.trim() || undefined;

    const where: Prisma.AppointmentWhereInput = {
      status: query.status,
      doctorId: query.doctorId,
      appointmentDate: query.date ? parseDateOnly(query.date) : undefined,
      patientPhone: query.phone ? { contains: query.phone } : undefined,
      bookingCode: query.bookingCode,
      AND: searchTerm
        ? [{ OR: [{ bookingCode: { contains: searchTerm, mode: "insensitive" as const } }, { patientPhone: { contains: searchTerm, mode: "insensitive" as const } }, { patientName: { contains: searchTerm, mode: "insensitive" as const } }] }]
        : undefined,
      invoice:
        query.billingState === "PENDING_INVOICE"
          ? { is: null }
          : query.billingState === "HAS_INVOICE"
            ? { isNot: null }
            : undefined,
    };

    if (actor.role === "DOCTOR") {
      where.doctor = {
        userId: actor.userId,
      };
    }

    const [items, total] = await prisma.$transaction([
      prisma.appointment.findMany({
        where,
        select: appointmentSelect,
        orderBy: [{ appointmentDate: "desc" }, { startTime: "asc" }],
        skip,
        take: limit,
      }),
      prisma.appointment.count({ where }),
    ]);

    const canViewClinical = await roleHasAnyPermission(actor.role, ["record.view"]);

    return {
      items: items.map((item) => (canViewClinical ? item : maskClinicalFields(item))),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async dashboardGetById(id: string, actor: Actor) {
    const where: Prisma.AppointmentWhereInput = { id };

    if (actor.role === "DOCTOR") {
      where.doctor = { userId: actor.userId };
    }

    const appointment = await prisma.appointment.findFirst({
      where,
      select: appointmentSelect,
    });

    if (!appointment) {
      throw new AppError("Không tìm thấy lịch hẹn", 404);
    }

    return (await roleHasAnyPermission(actor.role, ["record.view"]))
      ? appointment
      : maskClinicalFields(appointment);
  }

  async updatePatientInfo(
    id: string,
    input: UpdateAppointmentPatientInfoInput,
    actor: Actor,
  ) {
    if (actor.role === "DOCTOR") {
      throw new AppError(
        "Bác sĩ không có quyền cập nhật thông tin tiếp nhận",
        403,
      );
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        patientId: true,
        dependentProfileId: true,
        invoice: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new AppError("Không tìm thấy lịch hẹn", 404);
    }

    if (appointment.invoice) {
      throw new AppError(
        "Không thể cập nhật thông tin khi lịch hẹn đã có hóa đơn",
        400,
      );
    }

    if (
      [
        "PENDING_OTP",
        "CANCELLED_BY_ADMIN",
        "CANCELLED_BY_DOCTOR",
        "CANCELLED_BY_PATIENT",
        "NO_SHOW",
      ].includes(appointment.status)
    ) {
      throw new AppError(
        "Chỉ cập nhật thông tin tiếp nhận cho lịch đã xác thực và chưa hủy",
        400,
      );
    }

    const patientDateOfBirth =
      input.dateOfBirth === undefined
        ? undefined
        : parseOptionalDate(input.dateOfBirth);

    if (
      patientDateOfBirth &&
      patientDateOfBirth >= parseDateOnly(getVietnamNowParts().date)
    ) {
      throw new AppError("Ngày sinh phải nhỏ hơn ngày hiện tại", 400);
    }

    const hasBHYT = input.hasBHYT;
    const appointmentData: Prisma.AppointmentUpdateInput = {
      patientName: input.patientName,
      patientEmail: normalizeOptionalString(input.patientEmail),
      patientGender: input.gender,
      patientDateOfBirth,
      patientCccd: normalizeOptionalString(input.cccd),
      patientAddress: normalizeOptionalString(input.address),
      hasBHYT,
      healthInsuranceCode:
        hasBHYT === false
          ? null
          : normalizeOptionalString(input.healthInsuranceCode),
      registeredHospital:
        hasBHYT === false
          ? null
          : normalizeOptionalString(input.registeredHospital),
      allergies: normalizeOptionalString(input.allergies),
      medicalHistory: normalizeOptionalString(input.medicalHistory),
      familyHistory: normalizeOptionalString(input.familyHistory),
      bhytDiscount: hasBHYT === false ? 0 : undefined,
    };

    return prisma.$transaction(async (tx) => {
      const current = await tx.appointment.findUniqueOrThrow({
        where: { id },
        select: {
          estimatedPrice: true,
          serviceFee: true,
        },
      });

      if (hasBHYT === false) {
        appointmentData.finalAmount =
          current.estimatedPrice + current.serviceFee;
      }

      if (appointment.dependentProfileId) {
        await tx.dependentProfile.update({
          where: { id: appointment.dependentProfileId },
          data: {
            fullName: input.patientName,
            email: normalizeOptionalString(input.patientEmail),
            gender: input.gender,
            dateOfBirth: patientDateOfBirth,
            cccd: normalizeOptionalString(input.cccd),
            address: normalizeOptionalString(input.address),
            hasBHYT,
            healthInsuranceCode:
              hasBHYT === false
                ? null
                : normalizeOptionalString(input.healthInsuranceCode),
            registeredHospital:
              hasBHYT === false
                ? null
                : normalizeOptionalString(input.registeredHospital),
            allergies: normalizeOptionalString(input.allergies),
            medicalHistory: normalizeOptionalString(input.medicalHistory),
            familyHistory: normalizeOptionalString(input.familyHistory),
          },
        });
      } else {
      await tx.user.update({
        where: { id: appointment.patientId },
        data: {
          fullName: input.patientName,
          email: normalizeOptionalString(input.patientEmail),
        },
      });

      await tx.patientProfile.upsert({
        where: { userId: appointment.patientId },
        update: {
          gender: input.gender,
          dateOfBirth: patientDateOfBirth,
          cccd: normalizeOptionalString(input.cccd),
          address: normalizeOptionalString(input.address),
          hasBHYT,
          healthInsuranceCode:
            hasBHYT === false
              ? null
              : normalizeOptionalString(input.healthInsuranceCode),
          registeredHospital:
            hasBHYT === false
              ? null
              : normalizeOptionalString(input.registeredHospital),
          allergies: normalizeOptionalString(input.allergies),
          medicalHistory: normalizeOptionalString(input.medicalHistory),
          familyHistory: normalizeOptionalString(input.familyHistory),
        },
        create: {
          userId: appointment.patientId,
          gender: input.gender,
          dateOfBirth: patientDateOfBirth,
          cccd: normalizeOptionalString(input.cccd),
          address: normalizeOptionalString(input.address),
          hasBHYT: hasBHYT ?? false,
          healthInsuranceCode:
            hasBHYT === false
              ? null
              : normalizeOptionalString(input.healthInsuranceCode),
          registeredHospital:
            hasBHYT === false
              ? null
              : normalizeOptionalString(input.registeredHospital),
          allergies: normalizeOptionalString(input.allergies),
          medicalHistory: normalizeOptionalString(input.medicalHistory),
          familyHistory: normalizeOptionalString(input.familyHistory),
        },
      });
      }

      return tx.appointment.update({
        where: { id },
        data: appointmentData,
        select: appointmentSelect,
      });
    });
  }

  async confirm(id: string, actor: Actor) {
    const transition = await prisma.$transaction(async (tx) => {
      await this.claimAppointmentTransition(tx, {
        id,
        actor,
        expectedStatuses: ["PENDING_CONFIRM"],
        nextStatus: "CONFIRMED",
        data: { confirmedAt: new Date() },
      });
      await this.createTransitionLog(tx, {
        appointmentId: id,
        action: "CONFIRMED",
        actor,
        note: "Lịch hẹn đã được xác nhận",
      });
      const notification = await this.createAppointmentConfirmationNotification(
        tx,
        id,
      );
      const reminder = await this.createAppointmentReminderNotification(tx, id);
      const appointment = await this.getTransitionResult(tx, id);
      return {
        appointment,
        notificationId: notification.id,
        dueReminderId: reminder?.publishedAt ? reminder.id : null,
      };
    });

    await this.dispatchNotificationBestEffort(transition.notificationId);
    if (transition.dueReminderId) {
      await this.dispatchNotificationBestEffort(transition.dueReminderId);
    }
    await StaffNotificationService.notifyAppointmentEvent(id, "CONFIRMED", {
      actorId: actor.userId,
    });
    return transition.appointment;
  }

  async cancel(id: string, reason: string, actor: Actor) {
    const cancelStatus =
      actor.role === "DOCTOR" ? "CANCELLED_BY_DOCTOR" : "CANCELLED_BY_ADMIN";
    const cancelAction =
      actor.role === "DOCTOR" ? "CANCELLED_BY_DOCTOR" : "CANCELLED_BY_ADMIN";

    const transition = await prisma.$transaction(async (tx) => {
      await this.claimAppointmentTransition(tx, {
        id,
        actor,
        expectedStatuses: DASHBOARD_CANCEL_ALLOWED_STATUSES,
        nextStatus: cancelStatus,
        data: {
          cancelledAt: new Date(),
          cancelledByRole: actor.role,
          cancelledById: actor.userId,
          cancelledReason: reason,
        },
      });

      await this.releaseAppointmentSlot(tx, id);

      await this.createTransitionLog(tx, {
        appointmentId: id,
        action: cancelAction,
        actor,
        note: reason,
      });

      const notification = await this.createAppointmentCancellationNotification(
        tx,
        id,
        reason,
      );

      const appointment = await this.getTransitionResult(tx, id);
      return { appointment, notificationId: notification.id };
    });

    await this.dispatchNotificationBestEffort(transition.notificationId);
    await StaffNotificationService.notifyAppointmentEvent(id, "CANCELLED", {
      actorId: actor.userId,
    });
    return transition.appointment;
  }

  async reschedule(
    id: string,
    input: RescheduleAppointmentInput,
    actor: Actor,
  ) {
    const reason = input.reason.trim();
    const transition = await prisma.$transaction(async (tx) => {
      const current = await tx.appointment.findFirst({
        where: {
          ...this.getActorScopedAppointmentWhere(id, actor),
          status: "CONFIRMED",
        },
      });
      if (!current) {
        throw new AppError(
          "Chỉ có thể đổi lịch đã được xác nhận",
          409,
          "APPOINTMENT_STATE_CONFLICT",
        );
      }

      const targetSlot = await tx.doctorTimeSlot.findUnique({
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
        !targetSlot ||
        targetSlot.doctorId !== current.doctorId ||
        targetSlot.status !== "AVAILABLE" ||
        !targetSlot.isActive ||
        targetSlot.appointment ||
        isSlotStartInPastVietnamTime(targetSlot.date, targetSlot.startTime)
      ) {
        throw new AppError(
          "Khung giờ đổi lịch không khả dụng hoặc không thuộc bác sĩ hiện tại",
          409,
          "APPOINTMENT_SLOT_CONFLICT",
        );
      }

      const reserved = await tx.doctorTimeSlot.updateMany({
        where: {
          id: targetSlot.id,
          doctorId: current.doctorId,
          status: "AVAILABLE",
          isActive: true,
        },
        data: { status: "BOOKED" },
      });
      if (reserved.count !== 1) {
        throw new AppError(
          "Khung giờ đổi lịch vừa được người khác chọn",
          409,
          "APPOINTMENT_SLOT_CONFLICT",
        );
      }

      const claimed = await tx.appointment.updateMany({
        where: {
          id: current.id,
          status: "CONFIRMED",
          timeSlotId: current.timeSlotId,
        },
        data: {
          status: "RESCHEDULED",
          timeSlotId: null,
        },
      });
      if (claimed.count !== 1) {
        throw new AppError(
          "Lịch hẹn đã thay đổi, vui lòng tải lại dữ liệu",
          409,
          "APPOINTMENT_STATE_CONFLICT",
        );
      }

      if (current.timeSlotId) {
        await tx.doctorTimeSlot.update({
          where: { id: current.timeSlotId },
          data: { status: "AVAILABLE", isActive: true, lockReason: null },
        });
      }
      await this.cancelAppointmentReminders(tx, current.id);
      await this.createTransitionLog(tx, {
        appointmentId: current.id,
        action: "RESCHEDULED",
        actor,
        note: reason,
      });

      const rescheduledAt = new Date();
      const created = await tx.appointment.create({
        data: {
          bookingCode: await this.generateUniqueBookingCode(tx),
          appointmentDate: targetSlot.date,
          startTime: targetSlot.startTime,
          endTime: targetSlot.endTime,
          status: "CONFIRMED",
          reason: current.reason,
          patientName: current.patientName,
          patientPhone: current.patientPhone,
          patientEmail: current.patientEmail,
          otpChannel: current.otpChannel,
          patientGender: current.patientGender,
          patientDateOfBirth: current.patientDateOfBirth,
          patientAddress: current.patientAddress,
          patientCccd: current.patientCccd,
          hasBHYT: current.hasBHYT,
          healthInsuranceCode: current.healthInsuranceCode,
          registeredHospital: current.registeredHospital,
          allergies: current.allergies,
          medicalHistory: current.medicalHistory,
          familyHistory: current.familyHistory,
          estimatedPrice: current.estimatedPrice,
          serviceFee: current.serviceFee,
          bhytDiscount: current.bhytDiscount,
          finalAmount: current.finalAmount,
          patientId: current.patientId,
          doctorId: current.doctorId,
          departmentId: current.departmentId,
          packageId: current.packageId,
          timeSlotId: targetSlot.id,
          rescheduledFromId: current.id,
          rescheduledReason: reason,
          rescheduledAt,
          confirmedAt: rescheduledAt,
          logs: {
            create: {
              action: "RESCHEDULED",
              createdById: actor.userId,
              note: `Đổi từ lịch ${current.bookingCode}: ${reason}`,
            },
          },
        },
        select: { id: true, bookingCode: true },
      });

      const notification = await NotificationService.create(
        {
          userId: current.patientId,
          type: "APPOINTMENT_RESCHEDULED",
          title: "Lịch khám đã được đổi",
          body: `Lịch ${current.bookingCode} đã được đổi sang mã ${created.bookingCode}, ngày ${this.formatNotificationDate(targetSlot.date)} lúc ${targetSlot.startTime}.`,
          entityType: "APPOINTMENT",
          entityId: created.id,
          payload: {
            previousAppointmentId: current.id,
            previousBookingCode: current.bookingCode,
            bookingCode: created.bookingCode,
            status: "CONFIRMED",
          },
          dedupeKey: `appointment:${current.id}:rescheduled:${created.id}`,
        },
        tx,
      );
      const reminder = await this.createAppointmentReminderNotification(
        tx,
        created.id,
      );
      const appointment = await this.getTransitionResult(tx, created.id);
      return {
        appointment,
        notificationId: notification.id,
        dueReminderId: reminder?.publishedAt ? reminder.id : null,
      };
    });

    await this.dispatchNotificationBestEffort(transition.notificationId);
    if (transition.dueReminderId) {
      await this.dispatchNotificationBestEffort(transition.dueReminderId);
    }
    await StaffNotificationService.notifyAppointmentEvent(
      transition.appointment.id,
      "RESCHEDULED",
      { actorId: actor.userId },
    );
    return transition.appointment;
  }

  async checkIn(id: string, actor: Actor) {
    const transition = await prisma.$transaction(async (tx) => {
      await this.claimAppointmentTransition(tx, {
        id,
        actor,
        expectedStatuses: ["CONFIRMED"],
        nextStatus: "CHECKED_IN",
      });
      await this.cancelAppointmentReminders(tx, id);
      await this.createTransitionLog(tx, {
        appointmentId: id,
        action: "CHECKED_IN",
        actor,
        note: "Benh nhan da check-in",
      });
      const notification = await this.createAppointmentProgressNotification(
        tx,
        id,
        "CHECKED_IN",
      );
      const appointment = await this.getTransitionResult(tx, id);
      return { appointment, notificationId: notification.id };
    });

    await this.dispatchNotificationBestEffort(transition.notificationId);
    await StaffNotificationService.notifyAppointmentEvent(id, "CHECKED_IN", {
      actorId: actor.userId,
    });
    return transition.appointment;
  }

  async start(id: string, actor: Actor) {
    const transition = await prisma.$transaction(async (tx) => {
      await this.claimAppointmentTransition(tx, {
        id,
        actor,
        expectedStatuses: ["CHECKED_IN"],
        nextStatus: "IN_PROGRESS",
      });
      await MedicalRecordService.ensureForAppointment(id, tx);
      await this.createTransitionLog(tx, {
        appointmentId: id,
        action: "IN_PROGRESS",
        actor,
        note: "Bắt đầu khám và tạo hồ sơ khám",
      });
      const notification = await this.createAppointmentProgressNotification(
        tx,
        id,
        "IN_PROGRESS",
      );
      const appointment = await this.getTransitionResult(tx, id);
      return { appointment, notificationId: notification.id };
    });

    await this.dispatchNotificationBestEffort(transition.notificationId);
    return transition.appointment;
  }

  async complete(id: string, actor: Actor) {
    const transition = await prisma.$transaction(async (tx) => {
      await this.claimAppointmentTransition(tx, {
        id,
        actor,
        expectedStatuses: ["IN_PROGRESS"],
        nextStatus: "COMPLETED",
        data: { completedAt: new Date() },
      });
      await this.createTransitionLog(tx, {
        appointmentId: id,
        action: "COMPLETED",
        actor,
        note: "Hoàn thành khám",
      });
      const notification = await this.createAppointmentProgressNotification(
        tx,
        id,
        "COMPLETED",
      );
      const appointment = await this.getTransitionResult(tx, id);
      return { appointment, notificationId: notification.id };
    });

    await this.dispatchNotificationBestEffort(transition.notificationId);
    // Lễ tân cần lập hóa đơn cho lịch vừa khám xong.
    await StaffNotificationService.notifyAppointmentEvent(id, "COMPLETED", {
      actorId: actor.userId,
      includeDoctor: false,
      includeReception: true,
    });
    return transition.appointment;
  }

  async markNoShow(id: string, actor?: Actor, note = "Người khám không đến") {
    const transition = await prisma.$transaction(async (tx) => {
      await this.claimAppointmentTransition(tx, {
        id,
        actor,
        expectedStatuses: ["CONFIRMED", "CHECKED_IN"],
        nextStatus: "NO_SHOW",
      });

      await this.releaseAppointmentSlot(tx, id);
      await this.cancelAppointmentReminders(tx, id);

      await this.createTransitionLog(tx, {
        appointmentId: id,
        action: "NO_SHOW",
        actor,
        note,
      });
      const notification = await this.createAppointmentNoShowNotification(
        tx,
        id,
      );
      const appointment = await this.getTransitionResult(tx, id);
      return { appointment, notificationId: notification.id };
    });

    await this.dispatchNotificationBestEffort(transition.notificationId);
    return transition.appointment;
  }

  // Lịch CONFIRMED chưa check-in sau giờ hẹn + noShowGraceMinutes thì tự chuyển NO_SHOW.
  // Mặc định 0 = tắt. Mỗi lịch dùng cùng đường chuyển trạng thái như thao tác tay nên
  // an toàn khi chạy song song với lễ tân.
  async reconcileNoShows(options: { now?: Date; batchSize?: number } = {}) {
    const { noShowGraceMinutes } = await PolicyService.get();
    if (noShowGraceMinutes <= 0) return { scanned: 0, marked: 0, noop: 0 };

    const now = options.now || new Date();
    const candidates = await prisma.appointment.findMany({
      where: {
        status: "CONFIRMED",
        appointmentDate: { lte: new Date(now.getTime() + 24 * 3_600_000) },
      },
      select: { id: true, appointmentDate: true, startTime: true },
      orderBy: { appointmentDate: "asc" },
      take: Math.max(options.batchSize || 200, 1),
    });
    const due = candidates.filter(
      (item) =>
        this.getAppointmentStartAt(item.appointmentDate, item.startTime).getTime() +
          noShowGraceMinutes * 60_000 <=
        now.getTime(),
    );

    const outcomes = await mapWithConcurrency(
      due,
      getReconciliationConcurrency(),
      async (item) => {
        try {
          await this.markNoShow(
            item.id,
            undefined,
            `Tự động đánh dấu vắng mặt: quá ${noShowGraceMinutes} phút chưa check-in`,
          );
          return "MARKED" as const;
        } catch (error) {
          if (error instanceof AppError && error.code === "APPOINTMENT_STATE_CONFLICT") {
            return "NOOP" as const;
          }
          throw error;
        }
      },
    );
    const marked = outcomes.filter((outcome) => outcome === "MARKED").length;
    const noop = outcomes.length - marked;
    return { scanned: due.length, marked, noop };
  }

  async expirePendingOtpAppointment(
    appointmentId: string,
    options: {
      actor?: Actor;
      now?: Date;
      fallbackExpireMinutes?: number;
    } = {},
  ) {
    const now = options.now || new Date();
    const fallbackExpireMinutes = Math.max(
      options.fallbackExpireMinutes ||
        (await PolicyService.get()).bookingHoldMinutes,
      1,
    );
    const expiredBefore = new Date(
      now.getTime() - fallbackExpireMinutes * 60 * 1000,
    );

    return prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        select: { timeSlotId: true },
      });

      if (!appointment) return { outcome: "NOT_FOUND" as const };

      const claimed = await tx.appointment.updateMany({
        where: {
          id: appointmentId,
          status: "PENDING_OTP",
          OR: [
            { holdExpiresAt: { lte: now } },
            { holdExpiresAt: null, createdAt: { lte: expiredBefore } },
          ],
        },
        data: {
          status: "CANCELLED_BY_ADMIN",
          cancelledAt: now,
          cancelledByRole: options.actor?.role,
          cancelledById: options.actor?.userId,
          cancelledReason: "Quá hạn xác thực OTP",
        },
      });

      if (claimed.count !== 1) return { outcome: "NOOP" as const };

      await this.releaseAppointmentSlot(
        tx,
        appointmentId,
        appointment.timeSlotId,
      );

      await this.createTransitionLog(tx, {
        appointmentId,
        action: "CANCELLED_BY_ADMIN",
        actor: options.actor,
        note: `Tự động hủy do quá hạn xác thực OTP (${fallbackExpireMinutes} phút)`,
      });

      return { outcome: "EXPIRED" as const };
    });
  }

  async reconcileExpiredPendingOtp(
    options: {
      actor?: Actor;
      now?: Date;
      fallbackExpireMinutes?: number;
      batchSize?: number;
    } = {},
  ) {
    const now = options.now || new Date();
    const fallbackExpireMinutes = Math.max(
      options.fallbackExpireMinutes ||
        (await PolicyService.get()).bookingHoldMinutes,
      1,
    );
    const expiredBefore = new Date(
      now.getTime() - fallbackExpireMinutes * 60 * 1000,
    );
    const candidates = await prisma.appointment.findMany({
      where: {
        status: "PENDING_OTP",
        OR: [
          { holdExpiresAt: { lte: now } },
          { holdExpiresAt: null, createdAt: { lte: expiredBefore } },
        ],
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: Math.max(
        options.batchSize || getAppointmentReconciliationBatchSize(),
        1,
      ),
    });

    const outcomes = await mapWithConcurrency(
      candidates,
      getReconciliationConcurrency(),
      async (candidate) =>
        this.expirePendingOtpAppointment(candidate.id, {
          actor: options.actor,
          now,
          fallbackExpireMinutes,
        }),
    );
    const expired = outcomes.filter(
      (result) => result.outcome === "EXPIRED",
    ).length;
    const noop = outcomes.length - expired;

    return {
      expiredBefore,
      scanned: candidates.length,
      expired,
      noop,
    };
  }

  async expirePastPendingConfirmation(
    appointmentId: string,
    options: { actor?: Actor; now?: Date } = {},
  ) {
    const now = options.now || new Date();
    const reason = "Lịch chờ bệnh viện xác nhận đã quá giờ khám";
    const transition = await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        select: {
          appointmentDate: true,
          endTime: true,
          timeSlotId: true,
        },
      });

      if (!appointment) return { outcome: "NOT_FOUND" as const };
      const appointmentEnd = this.getAppointmentEndAt(
        appointment.appointmentDate,
        appointment.endTime,
      );
      if (appointmentEnd > now) return { outcome: "NOOP" as const };

      const claimed = await tx.appointment.updateMany({
        where: {
          id: appointmentId,
          status: "PENDING_CONFIRM",
          appointmentDate: appointment.appointmentDate,
          endTime: appointment.endTime,
        },
        data: {
          status: "CANCELLED_BY_ADMIN",
          cancelledAt: now,
          cancelledByRole: options.actor?.role,
          cancelledById: options.actor?.userId,
          cancelledReason: reason,
        },
      });

      if (claimed.count !== 1) return { outcome: "NOOP" as const };

      await this.releaseAppointmentSlot(
        tx,
        appointmentId,
        appointment.timeSlotId,
      );
      await this.createTransitionLog(tx, {
        appointmentId,
        action: "CANCELLED_BY_ADMIN",
        actor: options.actor,
        note: `Tự động hủy: ${reason.toLocaleLowerCase("vi-VN")}`,
      });
      const notification = await this.createAppointmentCancellationNotification(
        tx,
        appointmentId,
        reason,
      );

      return {
        outcome: "EXPIRED" as const,
        notificationId: notification.id,
      };
    });

    if (transition.outcome === "EXPIRED") {
      await this.dispatchNotificationBestEffort(transition.notificationId);
    }
    return transition;
  }

  async reconcilePastPendingConfirmations(
    options: {
      actor?: Actor;
      now?: Date;
      batchSize?: number;
    } = {},
  ) {
    const now = options.now || new Date();
    const vietnamToday = parseDateOnly(getVietnamNowParts(now).date);
    const candidates = await prisma.appointment.findMany({
      where: {
        status: "PENDING_CONFIRM",
        appointmentDate: { lte: vietnamToday },
      },
      select: { id: true },
      orderBy: [{ appointmentDate: "asc" }, { endTime: "asc" }],
      take: Math.max(
        options.batchSize || getAppointmentReconciliationBatchSize(),
        1,
      ),
    });

    const outcomes = await mapWithConcurrency(
      candidates,
      getReconciliationConcurrency(),
      async (candidate) =>
        this.expirePastPendingConfirmation(candidate.id, {
          actor: options.actor,
          now,
        }),
    );
    const expired = outcomes.filter(
      (result) => result.outcome === "EXPIRED",
    ).length;
    const noop = outcomes.length - expired;

    return { scanned: candidates.length, expired, noop };
  }

  private async releasePendingAppointment(appointmentId: string) {
    await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        select: { timeSlotId: true },
      });

      if (!appointment) return;

      await tx.appointment.delete({ where: { id: appointmentId } });
      if (appointment.timeSlotId) {
        await tx.doctorTimeSlot.update({
          where: { id: appointment.timeSlotId },
          data: { status: "AVAILABLE", isActive: true, lockReason: null },
        });
      }
    });
  }

  private async releaseAppointmentSlot(
    tx: Prisma.TransactionClient,
    appointmentId: string,
    knownTimeSlotId?: string | null,
  ) {
    const timeSlotId =
      knownTimeSlotId === undefined
        ? (
            await tx.appointment.findUniqueOrThrow({
              where: { id: appointmentId },
              select: { timeSlotId: true },
            })
          ).timeSlotId
        : knownTimeSlotId;

    if (!timeSlotId) return;

    const detached = await tx.appointment.updateMany({
      where: { id: appointmentId, timeSlotId },
      data: { timeSlotId: null },
    });
    if (detached.count !== 1) {
      throw new AppError(
        "Liên kết khung giờ đã thay đổi",
        409,
        "APPOINTMENT_SLOT_CONFLICT",
      );
    }

    await tx.doctorTimeSlot.update({
      where: { id: timeSlotId },
      data: { status: "AVAILABLE", isActive: true, lockReason: null },
    });
  }

  private getActorScopedAppointmentWhere(id: string, actor?: Actor) {
    const where: Prisma.AppointmentWhereInput = { id };

    if (actor?.role === "DOCTOR") {
      where.doctor = {
        userId: actor.userId,
      };
    }

    return where;
  }

  private isPendingOtpHoldExpired(appointment: {
    holdExpiresAt: Date | null;
    createdAt: Date;
  }) {
    const deadline =
      appointment.holdExpiresAt ||
      new Date(
        appointment.createdAt.getTime() + getBookingHoldMinutes() * 60 * 1000,
      );
    return deadline.getTime() <= Date.now();
  }

  private async claimAppointmentTransition(
    tx: Prisma.TransactionClient,
    input: {
      id: string;
      actor?: Actor;
      expectedStatuses: AppointmentStatus[];
      nextStatus: AppointmentStatus;
      data?: Prisma.AppointmentUpdateManyMutationInput;
    },
  ) {
    const where = this.getActorScopedAppointmentWhere(input.id, input.actor);
    const claimed = await tx.appointment.updateMany({
      where: {
        ...where,
        status: { in: input.expectedStatuses },
      },
      data: {
        ...(input.data || {}),
        status: input.nextStatus,
      },
    });

    if (claimed.count === 1) {
      return;
    }

    const appointment = await tx.appointment.findFirst({
      where,
      select: {
        id: true,
        status: true,
      },
    });

    if (!appointment) {
      throw new AppError("Không tìm thấy lịch hẹn", 404);
    }

    throw new AppError(
      "Trạng thái lịch hẹn đã thay đổi, vui lòng tải lại dữ liệu",
      409,
      "APPOINTMENT_STATE_CONFLICT",
    );
  }

  private async createTransitionLog(
    tx: Prisma.TransactionClient,
    input: {
      appointmentId: string;
      action: AppointmentLogAction;
      actor?: Actor;
      note?: string;
    },
  ) {
    await tx.appointmentLog.create({
      data: {
        appointmentId: input.appointmentId,
        action: input.action,
        createdById: input.actor?.userId,
        note: input.note,
      },
    });
  }

  private async createAppointmentConfirmationNotification(
    tx: Prisma.TransactionClient,
    appointmentId: string,
  ) {
    const appointment = await this.getAppointmentNotificationContext(
      tx,
      appointmentId,
    );

    return NotificationService.create(
      {
        userId: appointment.patientId,
        type: "APPOINTMENT_CONFIRMED",
        title: "Lịch khám đã được xác nhận",
        body: `Lịch ${appointment.bookingCode} ngày ${this.formatNotificationDate(appointment.appointmentDate)} lúc ${appointment.startTime} đã được bệnh viện xác nhận.`,
        entityType: "APPOINTMENT",
        entityId: appointment.id,
        payload: {
          bookingCode: appointment.bookingCode,
          status: "CONFIRMED",
        },
        dedupeKey: `appointment:${appointment.id}:confirmed`,
      },
      tx,
    );
  }

  private async createAppointmentCancellationNotification(
    tx: Prisma.TransactionClient,
    appointmentId: string,
    reason?: string,
  ) {
    await this.cancelAppointmentReminders(tx, appointmentId);
    const appointment = await this.getAppointmentNotificationContext(
      tx,
      appointmentId,
    );
    const normalizedReason = reason?.trim();

    return NotificationService.create(
      {
        userId: appointment.patientId,
        type: "APPOINTMENT_CANCELLED",
        title: "Lịch khám đã được hủy",
        body: `Lịch ${appointment.bookingCode} ngày ${this.formatNotificationDate(appointment.appointmentDate)} lúc ${appointment.startTime} đã được hủy${normalizedReason ? `: ${normalizedReason}` : "."}`,
        entityType: "APPOINTMENT",
        entityId: appointment.id,
        payload: {
          bookingCode: appointment.bookingCode,
          status: appointment.status,
        },
        dedupeKey: `appointment:${appointment.id}:cancelled`,
      },
      tx,
    );
  }

  private async createAppointmentReminderNotification(
    tx: Prisma.TransactionClient,
    appointmentId: string,
  ) {
    const appointment = await this.getAppointmentNotificationContext(
      tx,
      appointmentId,
    );
    const appointmentStart = this.getAppointmentStartAt(
      appointment.appointmentDate,
      appointment.startTime,
    );
    const now = new Date();
    if (appointmentStart <= now) return null;

    const scheduledAt = new Date(
      Math.max(
        now.getTime(),
        appointmentStart.getTime() -
          (await PolicyService.get()).reminderLeadMinutes * 60_000,
      ),
    );
    const dateKey = appointment.appointmentDate.toISOString().slice(0, 10);

    return NotificationService.create(
      {
        userId: appointment.patientId,
        type: "APPOINTMENT_REMINDER",
        title: "Sắp đến giờ khám",
        body: `Lịch ${appointment.bookingCode} sẽ diễn ra ngày ${this.formatNotificationDate(appointment.appointmentDate)} lúc ${appointment.startTime}. Vui lòng đến sớm để làm thủ tục.`,
        entityType: "APPOINTMENT",
        entityId: appointment.id,
        payload: {
          bookingCode: appointment.bookingCode,
          status: appointment.status,
        },
        dedupeKey: `appointment:${appointment.id}:reminder:${dateKey}:${appointment.startTime}`,
        scheduledAt,
        expiresAt: appointmentStart,
      },
      tx,
    );
  }

  private async createAppointmentNoShowNotification(
    tx: Prisma.TransactionClient,
    appointmentId: string,
  ) {
    const appointment = await this.getAppointmentNotificationContext(
      tx,
      appointmentId,
    );

    return NotificationService.create(
      {
        userId: appointment.patientId,
        type: "APPOINTMENT_NO_SHOW",
        title: "Lịch khám được ghi nhận không đến",
        body: `Lịch ${appointment.bookingCode} ngày ${this.formatNotificationDate(appointment.appointmentDate)} lúc ${appointment.startTime} đã được ghi nhận là không đến. Bạn có thể đặt lịch mới trên ứng dụng.`,
        entityType: "APPOINTMENT",
        entityId: appointment.id,
        payload: {
          bookingCode: appointment.bookingCode,
          status: "NO_SHOW",
        },
        dedupeKey: `appointment:${appointment.id}:no-show`,
      },
      tx,
    );
  }

  private async createAppointmentProgressNotification(
    tx: Prisma.TransactionClient,
    appointmentId: string,
    status: "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED",
  ) {
    const appointment = await this.getAppointmentNotificationContext(
      tx,
      appointmentId,
    );
    const content = {
      CHECKED_IN: {
        type: "APPOINTMENT_CHECKED_IN" as const,
        title: "Bạn đã check-in",
        body: `Lịch ${appointment.bookingCode} đã được bệnh viện tiếp nhận. Vui lòng chờ đến lượt khám.`,
        dedupeSuffix: "checked-in",
      },
      IN_PROGRESS: {
        type: "APPOINTMENT_IN_PROGRESS" as const,
        title: "Bác sĩ đang tiếp nhận khám",
        body: `Lịch ${appointment.bookingCode} đã bắt đầu khám. Thông tin chuyên môn sẽ được cập nhật sau khi phát hành.`,
        dedupeSuffix: "in-progress",
      },
      COMPLETED: {
        type: "APPOINTMENT_COMPLETED" as const,
        title: "Buổi khám đã hoàn thành",
        body: `Lịch ${appointment.bookingCode} đã hoàn thành. Bạn có thể theo dõi kết quả, đơn thuốc và hóa đơn trên ứng dụng khi được phát hành.`,
        dedupeSuffix: "completed",
      },
    }[status];

    return NotificationService.create(
      {
        userId: appointment.patientId,
        type: content.type,
        title: content.title,
        body: content.body,
        entityType: "APPOINTMENT",
        entityId: appointment.id,
        payload: {
          bookingCode: appointment.bookingCode,
          status,
        },
        dedupeKey: `appointment:${appointment.id}:${content.dedupeSuffix}`,
      },
      tx,
    );
  }

  private cancelAppointmentReminders(
    tx: Prisma.TransactionClient,
    appointmentId: string,
  ) {
    return tx.notification.updateMany({
      where: {
        dedupeKey: { startsWith: `appointment:${appointmentId}:reminder:` },
        cancelledAt: null,
      },
      data: { cancelledAt: new Date() },
    });
  }

  private getAppointmentStartAt(date: Date, startTime: string) {
    const dateOnly = date.toISOString().slice(0, 10);
    return new Date(`${dateOnly}T${startTime}:00+07:00`);
  }

  private getAppointmentEndAt(date: Date, endTime: string) {
    const dateOnly = date.toISOString().slice(0, 10);
    return new Date(`${dateOnly}T${endTime}:00+07:00`);
  }

  private getAppointmentNotificationContext(
    tx: Prisma.TransactionClient,
    appointmentId: string,
  ) {
    return tx.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
      select: {
        id: true,
        patientId: true,
        bookingCode: true,
        appointmentDate: true,
        startTime: true,
        status: true,
      },
    });
  }

  private formatNotificationDate(date: Date) {
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  }

  private async dispatchNotificationBestEffort(notificationId: string) {
    try {
      await NotificationDeliveryService.dispatchNotification(notificationId);
    } catch (error) {
      console.error(
        `[NOTIFICATION_DELIVERY] notification=${notificationId} dispatch failed:`,
        error,
      );
    }
  }

  private getTransitionResult(tx: Prisma.TransactionClient, id: string) {
    return tx.appointment.findUniqueOrThrow({
      where: { id },
      select: appointmentSelect,
    });
  }

  private async generateUniqueBookingCode(tx: Prisma.TransactionClient) {
    for (let index = 0; index < 10; index += 1) {
      const bookingCode = generateBookingCode();
      const existing = await tx.appointment.findUnique({
        where: { bookingCode },
        select: { id: true },
      });

      if (!existing) {
        return bookingCode;
      }
    }

    throw new AppError("Không thể tạo mã đặt lịch", 500);
  }
}

export default new AppointmentService();
