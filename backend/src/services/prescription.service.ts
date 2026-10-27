import { Prisma } from "../../generated/prisma/client.js";
import type { PrescriptionStatus, Role } from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { generatePrescriptionCode } from "../utils/prescriptionCode.js";
import PatientEventNotificationService from "./patientEventNotification.service.js";

type Actor = {
  userId: string;
  role: Role;
};

type PrescriptionItemInput = {
  medicineName: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  quantity?: number | null;
  unit?: string | null;
  instruction?: string | null;
  sortOrder?: number;
};

type CreatePrescriptionInput = {
  note?: string | null;
  items?: PrescriptionItemInput[];
};

type UpdatePrescriptionInput = {
  note?: string | null;
};

export const prescriptionSelect = {
  id: true,
  prescriptionCode: true,
  status: true,
  note: true,
  issuedAt: true,
  cancelledAt: true,
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
    },
  },
  medicalRecord: {
    select: {
      id: true,
      recordCode: true,
      status: true,
      diagnosis: true,
      treatment: true,
    },
  },
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
} satisfies Prisma.PrescriptionSelect;

const normalizeOptionalString = (value?: string | null) =>
  value === undefined ? undefined : value || null;

class PrescriptionService {
  async list(
    query: {
      status?: PrescriptionStatus;
      doctorId?: string;
      patientId?: string;
      medicalRecordId?: string;
      appointmentId?: string;
      prescriptionCode?: string;
      page?: number;
      limit?: number;
    },
    actor: Actor,
  ) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.PrescriptionWhereInput = {
      status: query.status,
      doctorId: query.doctorId,
      patientId: query.patientId,
      medicalRecordId: query.medicalRecordId,
      appointmentId: query.appointmentId,
      prescriptionCode: query.prescriptionCode,
    };

    const scopedWhere = this.withActorScope(where, actor);

    const [items, total] = await prisma.$transaction([
      prisma.prescription.findMany({
        where: scopedWhere,
        select: prescriptionSelect,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.prescription.count({ where: scopedWhere }),
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
    const prescription = await prisma.prescription.findFirst({
      where: this.withActorScope({ id }, actor),
      select: prescriptionSelect,
    });

    if (!prescription) {
      throw new AppError("Không tìm thấy đơn thuốc", 404);
    }

    return prescription;
  }

  async createForMedicalRecord(
    recordIdOrCode: string,
    input: CreatePrescriptionInput,
    actor: Actor,
  ) {
    const record = await this.getRecordForWrite(recordIdOrCode, actor);

    if (record.prescriptionRecord) {
      throw new AppError("Hồ sơ khám này đã có đơn thuốc", 409);
    }

    return prisma.$transaction(async (tx) => {
      const prescription = await tx.prescription.create({
        data: {
          prescriptionCode: await this.generateUniquePrescriptionCode(tx),
          medicalRecordId: record.id,
          appointmentId: record.appointmentId,
          patientId: record.patientId,
          doctorId: record.doctorId,
          note: normalizeOptionalString(input.note),
          items: {
            create: (input.items || []).map((item, index) => ({
              medicineName: item.medicineName,
              dosage: normalizeOptionalString(item.dosage),
              frequency: normalizeOptionalString(item.frequency),
              duration: normalizeOptionalString(item.duration),
              quantity: item.quantity,
              unit: normalizeOptionalString(item.unit),
              instruction: normalizeOptionalString(item.instruction),
              sortOrder: item.sortOrder ?? index,
            })),
          },
        },
        select: {
          id: true,
        },
      });

      return tx.prescription.findUniqueOrThrow({
        where: {
          id: prescription.id,
        },
        select: prescriptionSelect,
      });
    });
  }

  async update(id: string, input: UpdatePrescriptionInput, actor: Actor) {
    await this.ensureDraft(id, actor);

    return prisma.prescription.update({
      where: { id },
      data: {
        note: normalizeOptionalString(input.note),
      },
      select: prescriptionSelect,
    });
  }

  async issue(id: string, actor: Actor) {
    const prescription = await this.ensureDraft(id, actor);

    if (prescription.items.length === 0) {
      throw new AppError(
        "Đơn thuốc cần có ít nhất 1 thuốc trước khi phát hành",
        400,
      );
    }

    const transition = await prisma.$transaction(async (tx) => {
      const updatedPrescription = await tx.prescription.update({
        where: { id },
        data: {
          status: "ISSUED",
          issuedAt: new Date(),
          cancelledAt: null,
        },
        select: prescriptionSelect,
      });
      const notification =
        await PatientEventNotificationService.createPrescriptionIssued(
          {
            userId: prescription.patient.id,
            prescriptionId: prescription.id,
            prescriptionCode: prescription.prescriptionCode,
            bookingCode: prescription.appointment.bookingCode,
          },
          tx,
        );

      return { updatedPrescription, notificationId: notification.id };
    });

    await PatientEventNotificationService.dispatchBestEffort(
      transition.notificationId,
    );
    return transition.updatedPrescription;
  }

  async cancel(id: string, actor: Actor) {
    const prescription = await this.getById(id, actor);

    if (prescription.status === "CANCELLED") {
      throw new AppError("Đơn thuốc đã bị hủy", 400);
    }

    return prisma.prescription.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
      select: prescriptionSelect,
    });
  }

  async createItem(
    prescriptionId: string,
    input: PrescriptionItemInput,
    actor: Actor,
  ) {
    await this.ensureDraft(prescriptionId, actor);

    const sortOrder =
      input.sortOrder ??
      (await prisma.prescriptionItem.count({
        where: {
          prescriptionId,
        },
      }));

    await prisma.prescriptionItem.create({
      data: {
        prescriptionId,
        medicineName: input.medicineName,
        dosage: normalizeOptionalString(input.dosage),
        frequency: normalizeOptionalString(input.frequency),
        duration: normalizeOptionalString(input.duration),
        quantity: input.quantity,
        unit: normalizeOptionalString(input.unit),
        instruction: normalizeOptionalString(input.instruction),
        sortOrder,
      },
    });

    return this.getById(prescriptionId, actor);
  }

  async updateItem(
    prescriptionId: string,
    itemId: string,
    input: Partial<PrescriptionItemInput>,
    actor: Actor,
  ) {
    await this.ensureDraft(prescriptionId, actor);
    await this.getItem(prescriptionId, itemId);

    await prisma.prescriptionItem.update({
      where: { id: itemId },
      data: {
        medicineName: input.medicineName,
        dosage: normalizeOptionalString(input.dosage),
        frequency: normalizeOptionalString(input.frequency),
        duration: normalizeOptionalString(input.duration),
        quantity: input.quantity,
        unit: normalizeOptionalString(input.unit),
        instruction: normalizeOptionalString(input.instruction),
        sortOrder: input.sortOrder,
      },
    });

    return this.getById(prescriptionId, actor);
  }

  async deleteItem(prescriptionId: string, itemId: string, actor: Actor) {
    await this.ensureDraft(prescriptionId, actor);
    const item = await this.getItem(prescriptionId, itemId);

    await prisma.prescriptionItem.delete({
      where: { id: itemId },
    });

    return item;
  }

  private withActorScope(where: Prisma.PrescriptionWhereInput, actor: Actor) {
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

  private async getRecordForWrite(recordIdOrCode: string, actor: Actor) {
    const normalizedRecordKey = recordIdOrCode.trim();
    const where: Prisma.MedicalRecordWhereInput = {
      OR: [
        { id: normalizedRecordKey },
        { recordCode: normalizedRecordKey.toUpperCase() },
      ],
    };

    if (actor.role === "DOCTOR") {
      where.doctor = {
        userId: actor.userId,
      };
    }

    const record = await prisma.medicalRecord.findFirst({
      where,
      select: {
        id: true,
        appointmentId: true,
        patientId: true,
        doctorId: true,
        status: true,
        appointment: {
          select: {
            status: true,
          },
        },
        prescriptionRecord: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!record) {
      throw new AppError("Không tìm thấy hồ sơ khám", 404);
    }

    if (record.status === "ARCHIVED") {
      throw new AppError("Hồ sơ khám đã lưu trữ, không thể kê đơn", 400);
    }

    if (!["IN_PROGRESS", "COMPLETED"].includes(record.appointment.status)) {
      throw new AppError("Chỉ có thể kê đơn sau khi bắt đầu khám", 400);
    }

    return record;
  }

  private async ensureDraft(id: string, actor: Actor) {
    const prescription = await this.getById(id, actor);

    if (prescription.status !== "DRAFT") {
      throw new AppError("Chỉ có thể chỉnh sửa đơn thuốc đang DRAFT", 400);
    }

    if (prescription.medicalRecord.status === "ARCHIVED") {
      throw new AppError(
        "Hồ sơ khám đã lưu trữ, không thể chỉnh sửa đơn thuốc",
        400,
      );
    }

    return prescription;
  }

  private async getItem(prescriptionId: string, itemId: string) {
    const item = await prisma.prescriptionItem.findFirst({
      where: {
        id: itemId,
        prescriptionId,
      },
    });

    if (!item) {
      throw new AppError("Không tìm thấy thuốc trong đơn", 404);
    }

    return item;
  }

  private async generateUniquePrescriptionCode(tx: Prisma.TransactionClient) {
    for (let index = 0; index < 10; index += 1) {
      const prescriptionCode = generatePrescriptionCode();
      const existing = await tx.prescription.findUnique({
        where: { prescriptionCode },
        select: { id: true },
      });

      if (!existing) {
        return prescriptionCode;
      }
    }

    throw new AppError("Không thể tạo mã đơn thuốc", 500);
  }
}

export default new PrescriptionService();
