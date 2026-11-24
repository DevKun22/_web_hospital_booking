import { Prisma } from "../../../generated/prisma/client.js";
import type { AppointmentStatus, Gender, OtpDeliveryStatus } from "../../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/appError.js";
import { parseDateOnly } from "../../utils/time.js";
export type { Actor } from "../../types/actor.js";

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
  // Email là định danh người đặt lịch và nơi nhận OTP; số điện thoại chỉ để cơ sở khám liên hệ.
  patientEmail: string;
  termsAccepted?: boolean;
  termsVersion?: string;
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
  if (!owner) {
    throw new AppError("Không tìm thấy tài khoản người khám hợp lệ", 401);
  }
  // Số điện thoại tài khoản có thể trống (chỉ là liên hệ): dùng số người đặt nhập trong yêu cầu.
  const contactPhone = owner.phone ?? input.patientPhone;

  if (!input.dependentProfileId) {
    return {
      input: { ...input, patientEmail: owner.email, patientPhone: contactPhone },
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
      patientPhone: contactPhone,
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
  patientEmail?: string;
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

// Thông tin người khám khai lúc đặt lịch (bảng AppointmentPatientInfo, dữ liệu nhạy cảm): chỉ tải khi chi tiết lịch cần.
export const patientInfoSelect = {
  gender: true,
  dateOfBirth: true,
  address: true,
  cccd: true,
  hasBHYT: true,
  healthInsuranceCode: true,
  registeredHospital: true,
  allergies: true,
  medicalHistory: true,
  familyHistory: true,
} satisfies Prisma.AppointmentPatientInfoSelect;

export type PatientInfoRow = Prisma.AppointmentPatientInfoGetPayload<{ select: typeof patientInfoSelect }>;

// Giữ nguyên hợp đồng API: web và mobile vẫn nhận các trường phẳng cũ (patientGender, allergies, ...) từ patientInfo.
export const flattenPatientInfo = <T extends { patientInfo: PatientInfoRow | null }>(appointment: T) => {
  const { patientInfo, ...rest } = appointment;
  return {
    ...rest,
    patientGender: patientInfo?.gender ?? null,
    patientDateOfBirth: patientInfo?.dateOfBirth ?? null,
    patientAddress: patientInfo?.address ?? null,
    patientCccd: patientInfo?.cccd ?? null,
    hasBHYT: patientInfo?.hasBHYT ?? false,
    healthInsuranceCode: patientInfo?.healthInsuranceCode ?? null,
    registeredHospital: patientInfo?.registeredHospital ?? null,
    allergies: patientInfo?.allergies ?? null,
    medicalHistory: patientInfo?.medicalHistory ?? null,
    familyHistory: patientInfo?.familyHistory ?? null,
  };
};

export const appointmentSelect = {
  id: true,
  facility: { select: { id: true, name: true, address: true, phone: true } },
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
  patientInfo: { select: patientInfoSelect },
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
      isEmailVerified: true,
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

export { normalizeOptionalString } from "../../utils/text.js";

export const parseOptionalDate = (value?: string | null) =>
  value ? parseDateOnly(value) : null;

// Tiền sử và dị ứng là dữ liệu y tế: người không có quyền record.view chỉ thấy phần tiếp đón.
export const maskClinicalFields = <T extends { allergies?: unknown; medicalHistory?: unknown; familyHistory?: unknown }>(
  appointment: T,
): T => ({ ...appointment, allergies: null, medicalHistory: null, familyHistory: null });
