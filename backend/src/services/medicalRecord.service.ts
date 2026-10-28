import { Prisma } from "../../generated/prisma/client.js";
import type {
  MedicalResultStatus,
  Role,
} from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { parseDateOnly } from "../utils/time.js";
import { generateRecordCode } from "../utils/recordCode.js";
import PatientEventNotificationService from "./patientEventNotification.service.js";

type Actor = {
  userId: string;
  role: Role;
};

type UpdateMedicalRecordInput = {
  symptoms?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  prescription?: string | null;
  doctorNotes?: string | null;
  resultPdfUrl?: string | null;
};

type LabResultInput = {
  testName: string;
  resultValue?: string | null;
  unit?: string | null;
  referenceRange?: string | null;
  conclusion?: string | null;
  fileUrl?: string | null;
};

export const medicalRecordSelect = {
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
  patient: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
    },
  },
  doctor: {
    select: {
      id: true,
      userId: true,
      title: true,
      specialization: true,
      user: {
        select: {
          fullName: true,
          avatar: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  },
  appointment: {
    select: {
      id: true,
      bookingCode: true,
      appointmentDate: true,
      startTime: true,
      endTime: true,
      status: true,
      patientName: true,
      patientPhone: true,
      reason: true,
    },
  },
  labResults: {
    orderBy: {
      createdAt: "asc",
    },
  },
  prescriptionRecord: {
    select: {
      id: true,
      prescriptionCode: true,
      status: true,
      note: true,
      issuedAt: true,
      cancelledAt: true,
      items: {
        orderBy: [
          {
            sortOrder: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      },
    },
  },
} satisfies Prisma.MedicalRecordSelect;

const normalizeOptionalString = (value?: string | null) =>
  value === undefined ? undefined : value || null;

class MedicalRecordService {
  async ensureForAppointment(
    appointmentId: string,
    tx: Prisma.TransactionClient = prisma,
  ) {
    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        patientId: true,
        doctorId: true,
        medicalRecord: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new AppError("Không tìm thấy lịch hẹn", 404);
    }

    if (appointment.medicalRecord) {
      return appointment.medicalRecord;
    }

    return tx.medicalRecord.create({
      data: {
        recordCode: await this.generateUniqueRecordCode(tx),
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        status: "DRAFT",
      },
      select: {
        id: true,
      },
    });
  }

  async list(
    query: {
      status?: MedicalResultStatus;
      doctorId?: string;
      patientId?: string;
      recordCode?: string;
      date?: string;
      page?: number;
      limit?: number;
    },
    actor: Actor,
  ) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.MedicalRecordWhereInput = {
      status: query.status,
      doctorId: query.doctorId,
      patientId: query.patientId,
      recordCode: query.recordCode,
      appointment: query.date
        ? {
            appointmentDate: parseDateOnly(query.date),
          }
        : undefined,
    };

    if (actor.role === "DOCTOR") {
      where.doctor = {
        userId: actor.userId,
      };
    }

    const [items, total] = await prisma.$transaction([
      prisma.medicalRecord.findMany({
        where,
        select: medicalRecordSelect,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.medicalRecord.count({ where }),
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

  async getById(id: string, actor: Actor) {
    const record = await prisma.medicalRecord.findFirst({
      where: this.withActorScope({ id }, actor),
      select: medicalRecordSelect,
    });

    if (!record) {
      throw new AppError("Không tìm thấy hồ sơ khám", 404);
    }

    return record;
  }

  async update(id: string, input: UpdateMedicalRecordInput, actor: Actor) {
    await this.getById(id, actor);

    return prisma.medicalRecord.update({
      where: { id },
      data: {
        symptoms: normalizeOptionalString(input.symptoms),
        diagnosis: normalizeOptionalString(input.diagnosis),
        treatment: normalizeOptionalString(input.treatment),
        prescription: normalizeOptionalString(input.prescription),
        doctorNotes: normalizeOptionalString(input.doctorNotes),
        resultPdfUrl: normalizeOptionalString(input.resultPdfUrl),
      },
      select: medicalRecordSelect,
    });
  }

  async publish(id: string, actor: Actor) {
    const record = await this.getById(id, actor);

    if (!["IN_PROGRESS", "COMPLETED"].includes(record.appointment.status)) {
      throw new AppError(
        "Chỉ có thể phát hành kết quả sau khi bắt đầu khám",
        400,
      );
    }

    const transition = await prisma.$transaction(async (tx) => {
      const updatedRecord = await tx.medicalRecord.update({
        where: { id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
        select: medicalRecordSelect,
      });
      const notification =
        await PatientEventNotificationService.createMedicalResultPublished(
          {
            userId: record.patient.id,
            recordId: record.id,
            recordCode: record.recordCode,
            bookingCode: record.appointment.bookingCode,
          },
          tx,
        );

      return { updatedRecord, notificationId: notification.id };
    });

    await PatientEventNotificationService.dispatchBestEffort(
      transition.notificationId,
    );
    return transition.updatedRecord;
  }

  async archive(id: string, actor: Actor) {
    await this.getById(id, actor);

    return prisma.medicalRecord.update({
      where: { id },
      data: {
        status: "ARCHIVED",
      },
      select: medicalRecordSelect,
    });
  }

  async createLabResult(recordId: string, input: LabResultInput, actor: Actor) {
    await this.getById(recordId, actor);

    return prisma.labResult.create({
      data: {
        medicalRecordId: recordId,
        testName: input.testName,
        resultValue: normalizeOptionalString(input.resultValue),
        unit: normalizeOptionalString(input.unit),
        referenceRange: normalizeOptionalString(input.referenceRange),
        conclusion: normalizeOptionalString(input.conclusion),
        fileUrl: normalizeOptionalString(input.fileUrl),
      },
    });
  }

  async updateLabResult(
    recordId: string,
    labResultId: string,
    input: Partial<LabResultInput>,
    actor: Actor,
  ) {
    await this.getById(recordId, actor);
    await this.getLabResult(recordId, labResultId);

    return prisma.labResult.update({
      where: { id: labResultId },
      data: {
        testName: input.testName,
        resultValue: normalizeOptionalString(input.resultValue),
        unit: normalizeOptionalString(input.unit),
        referenceRange: normalizeOptionalString(input.referenceRange),
        conclusion: normalizeOptionalString(input.conclusion),
        fileUrl: normalizeOptionalString(input.fileUrl),
      },
    });
  }

  async deleteLabResult(recordId: string, labResultId: string, actor: Actor) {
    await this.getById(recordId, actor);
    const labResult = await this.getLabResult(recordId, labResultId);

    await prisma.labResult.delete({
      where: { id: labResultId },
    });

    return labResult;
  }

  private withActorScope(where: Prisma.MedicalRecordWhereInput, actor: Actor) {
    if (actor.role === "DOCTOR") {
      return {
        ...where,
        doctor: {
          userId: actor.userId,
        },
      };
    }

    return where;
  }

  private async getLabResult(recordId: string, labResultId: string) {
    const labResult = await prisma.labResult.findFirst({
      where: {
        id: labResultId,
        medicalRecordId: recordId,
      },
    });

    if (!labResult) {
      throw new AppError("Không tìm thấy kết quả cận lâm sàng", 404);
    }

    return labResult;
  }

  private async generateUniqueRecordCode(tx: Prisma.TransactionClient) {
    for (let index = 0; index < 10; index += 1) {
      const recordCode = generateRecordCode();
      const existing = await tx.medicalRecord.findUnique({
        where: { recordCode },
        select: { id: true },
      });

      if (!existing) {
        return recordCode;
      }
    }

    throw new AppError("Không thể tạo mã hồ sơ khám", 500);
  }
}

export default new MedicalRecordService();
