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
} from "../config/environment.js";
import { enqueuePendingOtpExpiry } from "../queues/appointmentLifecycle.queue.js";
import AuthOtpService from "./authOtp.service.js";
import { signLookupGrant } from "../utils/lookupGrant.js";
import { AppError } from "../utils/appError.js";
import { generateBookingCode } from "../utils/bookingCode.js";
import {
  getVietnamNowParts,
  isSlotStartInPastVietnamTime,
  parseDateOnly,
} from "../utils/time.js";
import MedicalRecordService from "./medicalRecord.service.js";

type Actor = {
  userId: string;
  role: Role;
};

type CreateAppointmentInput = {
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

type PublicCancelAppointmentInput = {
  bookingCode?: string;
  phone?: string;
  reason?: string;
  otp?: string;
  ipAddress: string;
};

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

const resolveLookupOtpTarget = async (phone: string, bookingCode?: string) => {
  const appointment = await prisma.appointment.findFirst({
    where: {
      patientPhone: phone,
      ...(bookingCode ? { bookingCode } : {}),
    },
    select: {
      patientId: true,
      patientPhone: true,
      patientEmail: true,
      otpChannel: true,
      appointmentDate: true,
      startTime: true,
      createdAt: true,
    },
    orderBy: [
      { appointmentDate: "desc" },
      { startTime: "desc" },
      { createdAt: "desc" },
    ],
  });

  if (!appointment) {
    throw new AppError("Không tìm thấy lịch hẹn với số điện thoại này", 404);
  }

  return {
    ...resolveAppointmentOtpTarget(appointment),
    patientId: appointment.patientId,
  };
};
const PUBLIC_CANCEL_ALLOWED_STATUSES: AppointmentStatus[] = [
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
      paidAt: true,
      createdAt: true,
      updatedAt: true,
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

const publicAppointmentSummarySelect = {
  id: true,
  bookingCode: true,
  appointmentDate: true,
  startTime: true,
  endTime: true,
  status: true,
  reason: true,
  patientName: true,
  patientPhone: true,
  estimatedPrice: true,
  serviceFee: true,
  bhytDiscount: true,
  finalAmount: true,
  confirmedAt: true,
  cancelledAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  doctor: {
    select: {
      id: true,
      title: true,
      specialization: true,
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
      paidAt: true,
      createdAt: true,
      updatedAt: true,
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

const publicAppointmentResultSelect = {
  id: true,
  bookingCode: true,
  appointmentDate: true,
  startTime: true,
  endTime: true,
  status: true,
  patientName: true,
  patientPhone: true,
  completedAt: true,
  doctor: {
    select: {
      id: true,
      title: true,
      specialization: true,
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
} satisfies Prisma.AppointmentSelect;

const publicMedicalRecordResultSelect = {
  id: true,
  recordCode: true,
  symptoms: true,
  diagnosis: true,
  treatment: true,
  prescription: true,
  doctorNotes: true,
  status: true,
  resultPdfUrl: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  labResults: {
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      medicalRecordId: true,
      testName: true,
      resultValue: true,
      unit: true,
      referenceRange: true,
      conclusion: true,
      fileUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.MedicalRecordSelect;

const publicPrescriptionResultSelect = {
  id: true,
  prescriptionCode: true,
  status: true,
  note: true,
  issuedAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: [
      {
        sortOrder: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
    select: {
      id: true,
      prescriptionId: true,
      medicineName: true,
      dosage: true,
      frequency: true,
      duration: true,
      quantity: true,
      unit: true,
      instruction: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.PrescriptionSelect;

const normalizeOptionalString = (value?: string | null) =>
  value === undefined ? undefined : value || null;

const parseOptionalDate = (value?: string | null) =>
  value ? parseDateOnly(value) : null;

class AppointmentService {
  async create(input: CreateAppointmentInput, ipAddress: string) {
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
    const otpChannel = input.otpChannel || "SMS";
    const holdExpiresAt = new Date(
      Date.now() + getBookingHoldMinutes() * 60 * 1000,
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

    if (otpChannel === "EMAIL" && !normalizedPatientEmail) {
      throw new AppError(
        "Email là bắt buộc khi chọn xác thực OTP qua email",
        400,
      );
    }
    const existingUser = await prisma.user.findUnique({
      where: { phone: input.patientPhone },
      select: { id: true, role: true },
    });

    if (existingUser && existingUser.role !== "PATIENT") {
      throw new AppError("Số điện thoại đã thuộc tài khoản nội bộ", 409);
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

        const patient = await tx.user.upsert({
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
            allergies: normalizeOptionalString(input.allergies),
            medicalHistory: normalizeOptionalString(input.medicalHistory),
            familyHistory: normalizeOptionalString(input.familyHistory),
            estimatedPrice,
            serviceFee,
            bhytDiscount,
            finalAmount,
            patientId: patient.id,
            doctorId: input.doctorId,
            departmentId: input.departmentId,
            packageId: input.packageId || null,
            timeSlotId: input.timeSlotId,
            logs: {
              create: {
                action: "APPOINTMENT_CREATED",
                note: "Bệnh nhân tạo lịch hẹn và chờ xác thực OTP",
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

      const emailOwner = appointment.patientEmail
        ? await tx.user.findUnique({
            where: { email: appointment.patientEmail },
            select: { id: true },
          })
        : null;

      if (emailOwner && emailOwner.id !== appointment.patientId) {
        throw new AppError("Email đã được sử dụng cho tài khoản khác", 409);
      }

      const cccdOwner = appointment.patientCccd
        ? await tx.patientProfile.findUnique({
            where: { cccd: appointment.patientCccd },
            select: { userId: true },
          })
        : null;

      if (cccdOwner && cccdOwner.userId !== appointment.patientId) {
        throw new AppError(
          "CCCD đã được sử dụng cho hồ sơ bệnh nhân khác",
          409,
        );
      }

      await tx.user.update({
        where: { id: appointment.patientId },
        data: {
          fullName: appointment.patientName,
          email: appointment.patientEmail,
          isPhoneVerified: true,
        },
      });

      await tx.patientProfile.upsert({
        where: { userId: appointment.patientId },
        update: {
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

      await tx.appointmentLog.create({
        data: {
          appointmentId: appointment.id,
          action: "OTP_VERIFIED",
          note: "Bệnh nhân đã xác thực OTP đặt lịch",
        },
      });

      return tx.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
        select: appointmentSelect,
      });
    });

    return updatedAppointment;
  }

  async getPublicById(id: string, phone: string) {
    if (!phone) {
      throw new AppError("Thiếu số điện thoại", 400);
    }

    const appointment = await prisma.appointment.findFirst({
      where: {
        id,
        patientPhone: phone,
      },
      select: appointmentSelect,
    });

    if (!appointment) {
      throw new AppError("Không tìm thấy lịch hẹn", 404);
    }

    return appointment;
  }

  async lookupPublic(input: { bookingCode?: string; phone?: string }) {
    const bookingCode = input.bookingCode?.trim().toUpperCase();
    const phone = input.phone?.trim();

    if (!bookingCode) {
      throw new AppError("Thiếu mã lịch hẹn", 400);
    }

    if (!phone) {
      throw new AppError("Thiếu số điện thoại", 400);
    }

    const appointment = await prisma.appointment.findFirst({
      where: {
        bookingCode,
        patientPhone: phone,
      },
      select: appointmentSelect,
    });

    if (!appointment) {
      throw new AppError("Không tìm thấy lịch hẹn", 404);
    }

    return appointment;
  }

  async getPublicResult(input: { bookingCode?: string; patientId: string }) {
    const bookingCode = input.bookingCode?.trim().toUpperCase();

    if (!bookingCode) {
      throw new AppError("Thiếu mã lịch hẹn", 400);
    }

    const appointment = await prisma.appointment.findFirst({
      where: {
        bookingCode,
        patientId: input.patientId,
      },
      select: publicAppointmentResultSelect,
    });

    if (!appointment) {
      throw new AppError("Không tìm thấy lịch hẹn", 404);
    }

    const medicalRecord = await prisma.medicalRecord.findFirst({
      where: {
        appointmentId: appointment.id,
        status: "PUBLISHED",
      },
      select: publicMedicalRecordResultSelect,
    });

    const prescription = medicalRecord
      ? await prisma.prescription.findFirst({
          where: {
            medicalRecordId: medicalRecord.id,
            status: "ISSUED",
          },
          select: publicPrescriptionResultSelect,
        })
      : null;

    return {
      appointment,
      medicalRecord,
      prescription,
    };
  }

  async requestLookupOtp(input: {
    phone?: string;
    bookingCode?: string;
    ipAddress: string;
  }) {
    const phone = input.phone?.trim();
    const bookingCode = input.bookingCode?.trim().toUpperCase();

    if (!phone) {
      throw new AppError("Thiếu số điện thoại", 400);
    }

    const otpTarget = await resolveLookupOtpTarget(phone, bookingCode);

    return AuthOtpService.sendOtp(
      otpTarget.target,
      "LOOKUP_RESULT",
      input.ipAddress,
      { channel: otpTarget.channel },
    );
  }

  async verifyLookupOtp(input: {
    phone?: string;
    bookingCode?: string;
    otp?: string;
    ipAddress?: string;
  }) {
    const phone = input.phone?.trim();
    const bookingCode = input.bookingCode?.trim().toUpperCase();

    if (!phone) {
      throw new AppError("Thiếu số điện thoại", 400);
    }

    if (!input.otp) {
      throw new AppError("Thiếu mã OTP", 400);
    }

    const otpTarget = await resolveLookupOtpTarget(phone, bookingCode);

    await AuthOtpService.verifyOtp(
      otpTarget.target,
      input.otp,
      "LOOKUP_RESULT",
      {
        ipAddress: input.ipAddress,
        channel: otpTarget.channel,
      },
    );

    const appointments = await prisma.appointment.findMany({
      where: {
        patientId: otpTarget.patientId,
        ...(bookingCode ? { bookingCode } : {}),
      },
      select: publicAppointmentSummarySelect,
      orderBy: [{ appointmentDate: "desc" }, { startTime: "desc" }],
      take: bookingCode ? 1 : 10,
    });

    return {
      phone,
      items: appointments,
      grant: signLookupGrant({ patientId: otpTarget.patientId }),
    };
  }

  async requestPublicCancelOtp(input: PublicCancelAppointmentInput) {
    const appointment = await this.getPublicCancellableAppointment(input);

    const otpTarget = resolveAppointmentOtpTarget(appointment);
    const otp = await AuthOtpService.sendOtp(
      otpTarget.target,
      "CANCEL_APPOINTMENT",
      input.ipAddress,
      {
        channel: otpTarget.channel,
      },
    );

    await prisma.appointmentLog.create({
      data: {
        appointmentId: appointment.id,
        action: "OTP_SENT",
        note: getOtpLogNote("OTP xác thực hủy lịch", otp.deliveryStatus),
      },
    });

    return {
      bookingCode: appointment.bookingCode,
      patientPhone: appointment.patientPhone,
      otpDeliveryStatus: otp.deliveryStatus,
      debugOtp: otp.debugOtp,
      expiresIn: otp.expiresIn,
    };
  }

  async verifyPublicCancel(input: PublicCancelAppointmentInput) {
    if (!input.otp) {
      throw new AppError("Thiếu OTP", 400);
    }

    const appointment = await this.getPublicCancellableAppointment(input);

    const otpTarget = resolveAppointmentOtpTarget(appointment);

    await AuthOtpService.verifyOtp(
      otpTarget.target,
      input.otp,
      "CANCEL_APPOINTMENT",
      {
        ipAddress: input.ipAddress,
        channel: otpTarget.channel,
      },
    );

    return prisma.$transaction(async (tx) => {
      await this.claimAppointmentTransition(tx, {
        id: appointment.id,
        expectedStatuses: PUBLIC_CANCEL_ALLOWED_STATUSES,
        nextStatus: "CANCELLED_BY_PATIENT",
        data: {
          cancelledAt: new Date(),
          cancelledByRole: "PATIENT",
          cancelledById: appointment.patientId,
          cancelledReason: input.reason?.trim(),
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
          createdById: appointment.patientId,
          note: input.reason?.trim(),
        },
      });

      return tx.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
        select: appointmentSelect,
      });
    });
  }

  async cancelByPatient(id: string, patientId: string, reason: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id, patientId },
      select: { id: true, status: true, timeSlotId: true },
    });

    if (!appointment) {
      throw new AppError("Không tìm thấy lịch hẹn", 404);
    }

    return prisma.$transaction(async (tx) => {
      await this.claimAppointmentTransition(tx, {
        id: appointment.id,
        expectedStatuses: PUBLIC_CANCEL_ALLOWED_STATUSES,
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

      return tx.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
        select: appointmentSelect,
      });
    });
  }

  async dashboardList(
    query: {
      status?: AppointmentStatus;
      doctorId?: string;
      date?: string;
      phone?: string;
      bookingCode?: string;
      page?: number;
      limit?: number;
    },
    actor: Actor,
  ) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.AppointmentWhereInput = {
      status: query.status,
      doctorId: query.doctorId,
      appointmentDate: query.date ? parseDateOnly(query.date) : undefined,
      patientPhone: query.phone ? { contains: query.phone } : undefined,
      bookingCode: query.bookingCode,
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

    return {
      items,
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

    return appointment;
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

      return tx.appointment.update({
        where: { id },
        data: appointmentData,
        select: appointmentSelect,
      });
    });
  }

  async confirm(id: string, actor: Actor) {
    return prisma.$transaction(async (tx) => {
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
      return this.getTransitionResult(tx, id);
    });
  }

  async updateStatus(
    id: string,
    status: Extract<
      AppointmentStatus,
      "CONFIRMED" | "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "NO_SHOW"
    >,
    actor: Actor,
  ) {
    switch (status) {
      case "CONFIRMED":
        return this.confirm(id, actor);
      case "CHECKED_IN":
        return this.checkIn(id, actor);
      case "IN_PROGRESS":
        return this.start(id, actor);
      case "COMPLETED":
        return this.complete(id, actor);
      case "NO_SHOW":
        return this.markNoShow(id, actor);
      default:
        throw new AppError("Trạng thái lịch hẹn không hợp lệ", 400);
    }
  }

  async cancel(id: string, reason: string, actor: Actor) {
    const cancelStatus =
      actor.role === "DOCTOR" ? "CANCELLED_BY_DOCTOR" : "CANCELLED_BY_ADMIN";
    const cancelAction =
      actor.role === "DOCTOR" ? "CANCELLED_BY_DOCTOR" : "CANCELLED_BY_ADMIN";

    return prisma.$transaction(async (tx) => {
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

      return this.getTransitionResult(tx, id);
    });
  }

  async checkIn(id: string, actor: Actor) {
    return prisma.$transaction(async (tx) => {
      await this.claimAppointmentTransition(tx, {
        id,
        actor,
        expectedStatuses: ["CONFIRMED"],
        nextStatus: "CHECKED_IN",
      });
      await this.createTransitionLog(tx, {
        appointmentId: id,
        action: "CHECKED_IN",
        actor,
        note: "Benh nhan da check-in",
      });
      return this.getTransitionResult(tx, id);
    });
  }

  async start(id: string, actor: Actor) {
    return prisma.$transaction(async (tx) => {
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
      return this.getTransitionResult(tx, id);
    });
  }

  async complete(id: string, actor: Actor) {
    return prisma.$transaction(async (tx) => {
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
      return this.getTransitionResult(tx, id);
    });
  }

  async markNoShow(id: string, actor: Actor) {
    return prisma.$transaction(async (tx) => {
      await this.claimAppointmentTransition(tx, {
        id,
        actor,
        expectedStatuses: ["CONFIRMED", "CHECKED_IN"],
        nextStatus: "NO_SHOW",
      });

      await this.releaseAppointmentSlot(tx, id);

      await this.createTransitionLog(tx, {
        appointmentId: id,
        action: "NO_SHOW",
        actor,
        note: "Bệnh nhân không đến",
      });
      return this.getTransitionResult(tx, id);
    });
  }

  async cleanupExpiredPendingOtp(
    actor: Actor,
    expireMinutes = getBookingHoldMinutes(),
  ) {
    const result = await this.reconcileExpiredPendingOtp({
      actor,
      fallbackExpireMinutes: expireMinutes,
    });

    return { expiredBefore: result.expiredBefore, count: result.expired };
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
      options.fallbackExpireMinutes || getBookingHoldMinutes(),
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
      options.fallbackExpireMinutes || getBookingHoldMinutes(),
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

    let expired = 0;
    let noop = 0;
    for (const candidate of candidates) {
      const result = await this.expirePendingOtpAppointment(candidate.id, {
        actor: options.actor,
        now,
        fallbackExpireMinutes,
      });
      if (result.outcome === "EXPIRED") expired += 1;
      else noop += 1;
    }

    return {
      expiredBefore,
      scanned: candidates.length,
      expired,
      noop,
    };
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

  private async getPublicCancellableAppointment(
    input: PublicCancelAppointmentInput,
  ) {
    const bookingCode = input.bookingCode?.trim().toUpperCase();
    const phone = input.phone?.trim();
    const reason = input.reason?.trim();

    if (!bookingCode) {
      throw new AppError("Thiếu mã lịch hẹn", 400);
    }

    if (!phone) {
      throw new AppError("Thiếu số điện thoại", 400);
    }

    if (!reason || reason.length < 2) {
      throw new AppError("Lý do hủy tối thiểu 2 ký tự", 400);
    }

    const appointment = await prisma.appointment.findFirst({
      where: {
        bookingCode,
        patientPhone: phone,
      },
      select: {
        id: true,
        bookingCode: true,
        patientId: true,
        patientPhone: true,
        patientEmail: true,
        otpChannel: true,
        status: true,
        timeSlotId: true,
      },
    });

    if (!appointment) {
      throw new AppError("Không tìm thấy lịch hẹn", 404);
    }

    if (!PUBLIC_CANCEL_ALLOWED_STATUSES.includes(appointment.status)) {
      throw new AppError(
        "Chỉ có thể hủy lịch đang chờ xác nhận hoặc đã xác nhận",
        400,
      );
    }

    return appointment;
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
