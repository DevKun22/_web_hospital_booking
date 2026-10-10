import { Prisma } from "../../generated/prisma/client.js";
import type { AppointmentStatus, InvoiceStatus } from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { paginationMeta } from "../utils/pagination.js";
import { parseDateOnly } from "../utils/time.js";
import AppointmentService from "./appointment.service.js";

const appointmentSelect = {
  id: true,
  bookingCode: true,
  appointmentDate: true,
  startTime: true,
  endTime: true,
  status: true,
  reason: true,
  estimatedPrice: true,
  serviceFee: true,
  bhytDiscount: true,
  finalAmount: true,
  confirmedAt: true,
  cancelledAt: true,
  cancelledReason: true,
  completedAt: true,
  createdAt: true,
  doctor: {
    select: {
      id: true,
      title: true,
      specialization: true,
      user: { select: { fullName: true, avatar: true } },
    },
  },
  department: { select: { id: true, name: true, slug: true } },
  package: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.AppointmentSelect;

const medicalRecordSelect = {
  id: true,
  recordCode: true,
  symptoms: true,
  diagnosis: true,
  treatment: true,
  prescription: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  resultPdfUrl: true,
  appointment: {
    select: {
      id: true,
      bookingCode: true,
      appointmentDate: true,
      startTime: true,
      endTime: true,
    },
  },
  doctor: {
    select: {
      id: true,
      title: true,
      specialization: true,
      user: { select: { fullName: true, avatar: true } },
      department: { select: { id: true, name: true, slug: true } },
    },
  },
  labResults: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      testName: true,
      resultValue: true,
      unit: true,
      referenceRange: true,
      conclusion: true,
      fileUrl: true,
      createdAt: true,
    },
  },
} satisfies Prisma.MedicalRecordSelect;

const prescriptionSelect = {
  id: true,
  prescriptionCode: true,
  status: true,
  note: true,
  issuedAt: true,
  createdAt: true,
  appointment: {
    select: {
      id: true,
      bookingCode: true,
      appointmentDate: true,
      startTime: true,
      endTime: true,
    },
  },
  doctor: {
    select: {
      id: true,
      title: true,
      specialization: true,
      user: { select: { fullName: true, avatar: true } },
    },
  },
  items: {
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    select: {
      id: true,
      medicineName: true,
      dosage: true,
      frequency: true,
      duration: true,
      quantity: true,
      unit: true,
      instruction: true,
      sortOrder: true,
    },
  },
} satisfies Prisma.PrescriptionSelect;

const invoiceSelect = {
  id: true,
  invoiceCode: true,
  totalAmount: true,
  bhytDiscount: true,
  finalAmount: true,
  insuranceEligibleAmount: true,
  insuranceCoverageRate: true,
  insuranceDiscountAmount: true,
  insuranceRouteType: true,
  status: true,
  paymentMethod: true,
  paidAt: true,
  refundedAt: true,
  createdAt: true,
  appointment: {
    select: {
      id: true,
      bookingCode: true,
      appointmentDate: true,
      startTime: true,
      endTime: true,
      doctor: {
        select: {
          id: true,
          title: true,
          user: { select: { fullName: true } },
        },
      },
      department: { select: { id: true, name: true, slug: true } },
      package: { select: { id: true, name: true, slug: true } },
    },
  },
} satisfies Prisma.InvoiceSelect;

const mapMedicalRecord = <T extends { id: string; resultPdfUrl: string | null; labResults: Array<{ id: string; fileUrl: string | null }> }>(record: T) => ({
  ...record,
  resultPdfUrl: undefined,
  resultFile: record.resultPdfUrl
    ? { available: true, downloadUrl: `/api/v1/me/medical-records/${record.id}/file` }
    : { available: false, downloadUrl: null },
  labResults: record.labResults.map((lab) => ({
    ...lab,
    fileUrl: undefined,
    file: lab.fileUrl
      ? {
          available: true,
          downloadUrl: `/api/v1/me/medical-records/${record.id}/lab-results/${lab.id}/file`,
        }
      : { available: false, downloadUrl: null },
  })),
});

class PatientPortalService {
  async getProfile(patientId: string) {
    const user = await prisma.user.findFirst({
      where: { id: patientId, role: "PATIENT", isActive: true },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        avatar: true,
        isPhoneVerified: true,
        patientProfile: {
          select: {
            dateOfBirth: true,
            gender: true,
            cccd: true,
            address: true,
            hasBHYT: true,
            healthInsuranceCode: true,
            registeredHospital: true,
            bloodType: true,
            height: true,
            weight: true,
            allergies: true,
            medicalHistory: true,
            familyHistory: true,
            bloodPressure: true,
          },
        },
      },
    });
    if (!user) throw new AppError("Không tìm thấy hồ sơ bệnh nhân", 404);
    return user;
  }

  async updateProfile(patientId: string, input: Record<string, unknown>) {
    const dateOfBirth =
      typeof input.dateOfBirth === "string"
        ? parseDateOnly(input.dateOfBirth)
        : input.dateOfBirth === null
          ? null
          : undefined;
    const today = parseDateOnly(
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(new Date()),
    );
    if (dateOfBirth && dateOfBirth >= today) {
      throw new AppError("Ngày sinh phải nhỏ hơn ngày hiện tại", 400);
    }

    const userData = {
      fullName: input.fullName as string | undefined,
      email: input.email as string | null | undefined,
    };
    const profileData = {
      dateOfBirth,
      gender: input.gender as "MALE" | "FEMALE" | "OTHER" | null | undefined,
      cccd: input.cccd as string | null | undefined,
      address: input.address as string | null | undefined,
      hasBHYT: input.hasBHYT as boolean | undefined,
      healthInsuranceCode:
        input.hasBHYT === false
          ? null
          : input.healthInsuranceCode as string | null | undefined,
      registeredHospital:
        input.hasBHYT === false
          ? null
          : input.registeredHospital as string | null | undefined,
      bloodType: input.bloodType as string | null | undefined,
      height: input.height as number | null | undefined,
      weight: input.weight as number | null | undefined,
      allergies: input.allergies as string | null | undefined,
      medicalHistory: input.medicalHistory as string | null | undefined,
      familyHistory: input.familyHistory as string | null | undefined,
      bloodPressure: input.bloodPressure as string | null | undefined,
    };

    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findFirst({
          where: { id: patientId, role: "PATIENT", isActive: true },
          select: { id: true },
        });
        if (!user) throw new AppError("Không tìm thấy hồ sơ bệnh nhân", 404);

        await tx.user.update({ where: { id: patientId }, data: userData });
        await tx.patientProfile.upsert({
          where: { userId: patientId },
          update: profileData,
          create: { userId: patientId, ...profileData },
        });
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        throw new AppError("Email hoặc CCCD đã thuộc hồ sơ khác", 409, "PATIENT_IDENTITY_CONFLICT");
      }
      throw error;
    }

    return this.getProfile(patientId);
  }

  async listAppointments(patientId: string, input: { page: number; limit: number; status?: AppointmentStatus }) {
    const where: Prisma.AppointmentWhereInput = { patientId, status: input.status };
    const [items, total] = await prisma.$transaction([
      prisma.appointment.findMany({
        where,
        select: appointmentSelect,
        orderBy: [{ appointmentDate: "desc" }, { startTime: "desc" }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      prisma.appointment.count({ where }),
    ]);
    return { items, meta: paginationMeta(input.page, input.limit, total) };
  }

  async getAppointment(patientId: string, id: string) {
    const item = await prisma.appointment.findFirst({
      where: { id, patientId },
      select: appointmentSelect,
    });
    if (!item) throw new AppError("Không tìm thấy lịch hẹn", 404);
    return item;
  }

  async cancelAppointment(patientId: string, id: string, reason: string) {
    await AppointmentService.cancelByPatient(id, patientId, reason);
    return this.getAppointment(patientId, id);
  }

  async listMedicalRecords(patientId: string, input: { page: number; limit: number }) {
    const where: Prisma.MedicalRecordWhereInput = { patientId, status: "PUBLISHED" };
    const [records, total] = await prisma.$transaction([
      prisma.medicalRecord.findMany({
        where,
        select: medicalRecordSelect,
        orderBy: { publishedAt: "desc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      prisma.medicalRecord.count({ where }),
    ]);
    return {
      items: records.map(mapMedicalRecord),
      meta: paginationMeta(input.page, input.limit, total),
    };
  }

  async getMedicalRecord(patientId: string, id: string) {
    const record = await prisma.medicalRecord.findFirst({
      where: { id, patientId, status: "PUBLISHED" },
      select: medicalRecordSelect,
    });
    if (!record) throw new AppError("Không tìm thấy kết quả khám", 404);
    return mapMedicalRecord(record);
  }

  async listPrescriptions(patientId: string, input: { page: number; limit: number }) {
    const where: Prisma.PrescriptionWhereInput = { patientId, status: "ISSUED" };
    const [items, total] = await prisma.$transaction([
      prisma.prescription.findMany({
        where,
        select: prescriptionSelect,
        orderBy: { issuedAt: "desc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      prisma.prescription.count({ where }),
    ]);
    return { items, meta: paginationMeta(input.page, input.limit, total) };
  }

  async getPrescription(patientId: string, id: string) {
    const item = await prisma.prescription.findFirst({
      where: { id, patientId, status: "ISSUED" },
      select: prescriptionSelect,
    });
    if (!item) throw new AppError("Không tìm thấy đơn thuốc", 404);
    return item;
  }

  async listInvoices(patientId: string, input: { page: number; limit: number; status?: InvoiceStatus }) {
    const where: Prisma.InvoiceWhereInput = { patientId, status: input.status };
    const [items, total] = await prisma.$transaction([
      prisma.invoice.findMany({
        where,
        select: invoiceSelect,
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      prisma.invoice.count({ where }),
    ]);
    return { items, meta: paginationMeta(input.page, input.limit, total) };
  }

  async getInvoice(patientId: string, id: string) {
    const item = await prisma.invoice.findFirst({
      where: { id, patientId },
      select: invoiceSelect,
    });
    if (!item) throw new AppError("Không tìm thấy hóa đơn", 404);
    return item;
  }

  async getMedicalFileSource(patientId: string, recordId: string, labResultId?: string) {
    const record = await prisma.medicalRecord.findFirst({
      where: { id: recordId, patientId, status: "PUBLISHED" },
      select: labResultId
        ? {
            labResults: {
              where: { id: labResultId },
              select: { fileUrl: true, testName: true },
              take: 1,
            },
          }
        : { resultPdfUrl: true, recordCode: true },
    });
    if (!record) throw new AppError("Không tìm thấy file kết quả", 404);

    if (labResultId && "labResults" in record) {
      const lab = record.labResults[0];
      if (!lab?.fileUrl) throw new AppError("Không tìm thấy file kết quả", 404);
      return { url: lab.fileUrl, fileName: `lab-result-${labResultId}` };
    }
    if ("resultPdfUrl" in record && record.resultPdfUrl) {
      return { url: record.resultPdfUrl, fileName: `${record.recordCode}-result` };
    }
    throw new AppError("Không tìm thấy file kết quả", 404);
  }
}

export default new PatientPortalService();
