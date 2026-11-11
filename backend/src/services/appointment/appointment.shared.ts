import { Prisma } from "../../../generated/prisma/client.js";
import type { AppointmentStatus, Gender, OtpChannel, OtpDeliveryStatus, Role } from "../../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/appError.js";
import { parseDateOnly } from "../../utils/time.js";
export type Actor = {
  userId: string;
  role: Role;
};

export type RescheduleAppointmentInput = {
  timeSlotId: string;
  reason: string;
};

export type CreateAppointmentInput = {
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

export type PatientBookingActor = {
  userId: string;
};

export const resolveBookingIdentity = async (
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

export type UpdateAppointmentPatientInfoInput = {
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

export const getOtpLogNote = (label: string, status: OtpDeliveryStatus) => {
  if (status === "FAILED")
    return `${label} đã được tạo nhưng chưa đưa được vào hàng đợi gửi mã`;
  if (status === "PENDING")
    return `${label} đã được tạo và đang chờ hệ thống gửi mã`;
  return `${label} đã được gửi`;
};

export const resolveAppointmentOtpTarget = (appointment: {
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

export const PATIENT_CANCEL_ALLOWED_STATUSES: AppointmentStatus[] = [
  "PENDING_CONFIRM",
  "CONFIRMED",
];
export const DASHBOARD_CANCEL_ALLOWED_STATUSES: AppointmentStatus[] = [
  "PENDING_OTP",
  "PENDING_CONFIRM",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "RESCHEDULED",
  "NO_SHOW",
];

export const appointmentSelect = {
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

export const normalizeOptionalString = (value?: string | null) =>
  value === undefined ? undefined : value || null;

export const parseOptionalDate = (value?: string | null) =>
  value ? parseDateOnly(value) : null;

// Tiền sử và dị ứng là dữ liệu y tế: người không có quyền record.view chỉ thấy phần tiếp đón.
export const maskClinicalFields = <T extends { allergies?: unknown; medicalHistory?: unknown; familyHistory?: unknown }>(
  appointment: T,
): T => ({ ...appointment, allergies: null, medicalHistory: null, familyHistory: null });
