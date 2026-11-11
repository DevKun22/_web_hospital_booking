import { roleHasAnyPermission } from "../rbac.service.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { AppointmentStatus } from "../../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/appError.js";
import { getVietnamNowParts, parseDateOnly } from "../../utils/time.js";
import {
  appointmentSelect,
  maskClinicalFields,
  normalizeOptionalString,
  parseOptionalDate,
  type Actor,
  type UpdateAppointmentPatientInfoInput,
} from "./appointment.shared.js";
import { AppointmentServiceSupport } from "./appointment.support.js";
export class AppointmentDashboardUseCases extends AppointmentServiceSupport {
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
}
