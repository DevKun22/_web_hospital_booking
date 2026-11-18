import { logClinicalAction } from "./clinicalLog.service.js";
import { Prisma } from "../../generated/prisma/client.js";
import type {
  MedicalResultStatus,
} from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { parseDateOnly } from "../utils/time.js";
import { generateRecordCode } from "../utils/recordCode.js";
import MediaAssetService from "./mediaAsset.service.js";
import PatientEventNotificationService from "./patientEventNotification.service.js";
import { normalizeOptionalString } from "../utils/text.js";
import { generateUniqueCode } from "../utils/uniqueCode.js";
import type { Actor } from "../types/actor.js";
import { logger } from "../observability/logger.js";


type UpdateMedicalRecordInput = {
  symptoms?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
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
  // Một hồ sơ khám có thể có nhiều đơn (đơn chính và các đơn bổ sung), theo thứ tự tạo.
  prescriptions: {
    orderBy: { createdAt: "asc" },
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
      /** Tìm gần đúng theo mã hồ sơ, mã lịch hoặc tên người khám. */
      q?: string;
      date?: string;
      page?: number;
      limit?: number;
    },
    actor: Actor,
  ) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;
    const searchTerm = query.q?.trim() || undefined;

    const where: Prisma.MedicalRecordWhereInput = {
      AND: searchTerm
        ? [
            {
              OR: [
                { recordCode: { contains: searchTerm, mode: "insensitive" as const } },
                { appointment: { is: { bookingCode: { contains: searchTerm, mode: "insensitive" as const } } } },
                { patient: { is: { fullName: { contains: searchTerm, mode: "insensitive" as const } } } },
              ],
            },
          ]
        : undefined,
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

  // Nguồn tệp kết quả để bác sĩ mở trong dashboard: cùng phạm vi truy cập với getById, nên bác sĩ
  // chỉ mở được tệp của hồ sơ mình được xem. Máy chủ ký lại đường dẫn riêng tư khi tải.
  async getFileSource(id: string, actor: Actor, labResultId?: string) {
    const record = await prisma.medicalRecord.findFirst({
      where: this.withActorScope({ id }, actor),
      select: {
        id: true,
        recordCode: true,
        resultPdfUrl: true,
        labResults: labResultId
          ? { where: { id: labResultId }, select: { fileUrl: true }, take: 1 }
          : false,
      },
    });
    if (!record) throw new AppError("Không tìm thấy hồ sơ khám", 404);

    if (labResultId) {
      const url = record.labResults?.[0]?.fileUrl;
      if (!url) throw new AppError("Không tìm thấy file kết quả", 404);
      return { recordId: record.id, url, fileName: `${record.recordCode}-lab-${labResultId}` };
    }
    if (!record.resultPdfUrl) throw new AppError("Không tìm thấy file kết quả", 404);
    return { recordId: record.id, url: record.resultPdfUrl, fileName: `${record.recordCode}-result` };
  }

  async update(id: string, input: UpdateMedicalRecordInput, actor: Actor) {
    const current = await this.getById(id, actor);

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.medicalRecord.update({
        where: { id },
        data: {
          symptoms: normalizeOptionalString(input.symptoms),
          diagnosis: normalizeOptionalString(input.diagnosis),
          treatment: normalizeOptionalString(input.treatment),
          doctorNotes: normalizeOptionalString(input.doctorNotes),
          resultPdfUrl: normalizeOptionalString(input.resultPdfUrl),
        },
        select: medicalRecordSelect,
      });
      await logClinicalAction(tx, {
        action: "MEDICAL_RESULT_UPDATED",
        actorId: actor.userId,
        medicalRecordId: id,
        note: "Cập nhật hồ sơ khám",
      });
      return updated;
    });

    if (input.resultPdfUrl !== undefined) {
      await MediaAssetService.syncMedicalFile({
        ownerId: id,
        url: result.resultPdfUrl,
        previousUrl: current.resultPdfUrl,
      });
    }
    // Bác sĩ ghi kết luận sau khi hóa đơn đã thu: hồ sơ đủ điều kiện nên mở cho người khám ngay.
    if (input.diagnosis !== undefined || input.treatment !== undefined) {
      await this.publishWhenReady(current.appointment.id).catch((error) => {
        logger.error("[AUTO_PUBLISH] cannot publish after record update:", error);
      });
    }
    return result;
  }

  /**
   * Tự công bố hồ sơ khi đủ ba điều kiện: lịch đã hoàn thành, hóa đơn đã thanh toán, hồ sơ có chẩn đoán hoặc hướng
   * điều trị. Gọi sau khi hóa đơn được thu và sau khi bác sĩ cập nhật hồ sơ; chưa đủ điều kiện thì không làm gì.
   * Bác sĩ vẫn có thể công bố sớm bằng tay (`publish`).
   */
  async publishWhenReady(appointmentId: string) {
    const record = await prisma.medicalRecord.findFirst({
      where: {
        appointmentId,
        status: "DRAFT",
        appointment: { status: "COMPLETED", invoice: { status: "PAID" } },
        OR: [{ diagnosis: { not: null } }, { treatment: { not: null } }],
      },
      select: { id: true, recordCode: true, patientId: true, appointment: { select: { bookingCode: true } } },
    });
    if (!record) return false;
    return this.markPublished(
      { id: record.id, recordCode: record.recordCode, patientId: record.patientId, bookingCode: record.appointment.bookingCode },
      { onlyIfDraft: true },
    );
  }

  async publish(id: string, actor: Actor) {
    const record = await this.getById(id, actor);

    if (!["IN_PROGRESS", "COMPLETED"].includes(record.appointment.status)) {
      throw new AppError(
        "Chỉ có thể phát hành kết quả sau khi bắt đầu khám",
        400,
      );
    }

    await this.markPublished(
      { id, recordCode: record.recordCode, patientId: record.patient.id, bookingCode: record.appointment.bookingCode },
      { actorId: actor.userId },
    );
    return prisma.medicalRecord.findUniqueOrThrow({ where: { id }, select: medicalRecordSelect });
  }

  /** Đánh dấu đã công bố, ghi nhật ký và báo người khám trong cùng một giao dịch. `onlyIfDraft` chống công bố hai lần. */
  private async markPublished(
    record: { id: string; recordCode: string; patientId: string; bookingCode: string },
    options: { actorId?: string; onlyIfDraft?: boolean } = {},
  ) {
    return prisma.$transaction(async (tx) => {
      const claimed = await tx.medicalRecord.updateMany({
        where: { id: record.id, ...(options.onlyIfDraft ? { status: "DRAFT" as const } : {}) },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
      if (claimed.count !== 1) return false;
      await logClinicalAction(tx, {
        action: "MEDICAL_RESULT_PUBLISHED",
        actorId: options.actorId,
        medicalRecordId: record.id,
        note: options.actorId ? "Công bố kết quả khám cho người khám" : "Tự công bố kết quả khám sau khi thanh toán",
      });
      await PatientEventNotificationService.createMedicalResultPublished(
        { userId: record.patientId, recordId: record.id, recordCode: record.recordCode, bookingCode: record.bookingCode },
        tx,
      );
      return true;
    });
  }

  async archive(id: string, actor: Actor) {
    await this.getById(id, actor);

    return prisma.$transaction(async (tx) => {
      const archived = await tx.medicalRecord.update({
        where: { id },
        data: {
          status: "ARCHIVED",
        },
        select: medicalRecordSelect,
      });
      await logClinicalAction(tx, {
        action: "MEDICAL_RESULT_UPDATED",
        actorId: actor.userId,
        medicalRecordId: id,
        note: "Lưu trữ hồ sơ khám",
      });
      return archived;
    });
  }

  async createLabResult(recordId: string, input: LabResultInput, actor: Actor) {
    await this.getById(recordId, actor);

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.labResult.create({
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
      await logClinicalAction(tx, {
        action: "LAB_RESULT_CHANGED",
        actorId: actor.userId,
        medicalRecordId: recordId,
        note: "Thêm kết quả cận lâm sàng",
      });
      return created;
    });

    await MediaAssetService.syncMedicalFile({ ownerId: result.id, url: result.fileUrl });
    return result;
  }

  async updateLabResult(
    recordId: string,
    labResultId: string,
    input: Partial<LabResultInput>,
    actor: Actor,
  ) {
    await this.getById(recordId, actor);
    const previous = await this.getLabResult(recordId, labResultId);

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.labResult.update({
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
      await logClinicalAction(tx, {
        action: "LAB_RESULT_CHANGED",
        actorId: actor.userId,
        medicalRecordId: recordId,
        note: "Sửa kết quả cận lâm sàng",
      });
      return updated;
    });

    if (input.fileUrl !== undefined) {
      await MediaAssetService.syncMedicalFile({
        ownerId: labResultId,
        url: result.fileUrl,
        previousUrl: previous.fileUrl,
      });
    }
    return result;
  }

  async deleteLabResult(recordId: string, labResultId: string, actor: Actor) {
    await this.getById(recordId, actor);
    const labResult = await this.getLabResult(recordId, labResultId);

    await prisma.$transaction(async (tx) => {
      await tx.labResult.delete({
        where: { id: labResultId },
      });
      await logClinicalAction(tx, {
        action: "LAB_RESULT_CHANGED",
        actorId: actor.userId,
        medicalRecordId: recordId,
        note: "Xóa kết quả cận lâm sàng",
      });
    });

    await MediaAssetService.syncMedicalFile({
      ownerId: labResultId,
      url: null,
      previousUrl: labResult.fileUrl,
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

  private generateUniqueRecordCode(tx: Prisma.TransactionClient) {
    return generateUniqueCode(
      generateRecordCode,
      async (recordCode) => Boolean(await tx.medicalRecord.findUnique({ where: { recordCode }, select: { id: true } })),
      "Không thể tạo mã hồ sơ khám",
    );
  }
}

export default new MedicalRecordService();
