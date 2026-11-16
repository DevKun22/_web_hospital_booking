import { logClinicalAction } from "./clinicalLog.service.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { PrescriptionStatus } from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { generatePrescriptionCode } from "../utils/prescriptionCode.js";
import InvoiceService from "./invoice.service.js";
import MedicineAvailabilityService from "./medicineAvailability.service.js";
import PatientEventNotificationService from "./patientEventNotification.service.js";
import StaffNotificationService from "./staffNotification.service.js";
import { normalizeOptionalString } from "../utils/text.js";
import { generateUniqueCode } from "../utils/uniqueCode.js";
import type { Actor } from "../types/actor.js";
import { logger } from "../observability/logger.js";


type PrescriptionItemInput = {
  // Gắn thuốc trong danh mục kho (null/bỏ trống = thuốc ngoài danh mục, người khám tự mua).
  medicineId?: string | null;
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
  dispenseStatus: true,
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

class PrescriptionService {
  async list(
    query: {
      status?: PrescriptionStatus;
      doctorId?: string;
      patientId?: string;
      medicalRecordId?: string;
      appointmentId?: string;
      prescriptionCode?: string;
      /** Tìm gần đúng theo mã đơn, mã hồ sơ hoặc tên người khám. */
      q?: string;
      page?: number;
      limit?: number;
    },
    actor: Actor,
  ) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;
    const searchTerm = query.q?.trim() || undefined;

    const where: Prisma.PrescriptionWhereInput = {
      AND: searchTerm
        ? [
            {
              OR: [
                { prescriptionCode: { contains: searchTerm, mode: "insensitive" as const } },
                { medicalRecord: { is: { recordCode: { contains: searchTerm, mode: "insensitive" as const } } } },
                { patient: { is: { fullName: { contains: searchTerm, mode: "insensitive" as const } } } },
              ],
            },
          ]
        : undefined,
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

    return this.withAvailability(prescription);
  }

  // Mỗi dòng đã gắn thuốc kho kèm mức khả dụng (còn/sắp hết/hết) và cờ vượt tồn, để bác sĩ biết sớm.
  // Chỉ là thông tin tham khảo tại thời điểm đọc; việc trừ kho chính thức vẫn ở bước dược sĩ cấp.
  private async withAvailability<T extends { items: { id: string; medicineId: string | null; quantity: number | null }[] }>(
    prescription: T,
  ) {
    const availability = await MedicineAvailabilityService.forItems(prescription.items);
    return {
      ...prescription,
      items: prescription.items.map((item) => ({ ...item, availability: availability.get(item.id) ?? null })),
    };
  }

  // Chỉ gắn thuốc còn trong danh mục và đang dùng; để trống thì dòng là thuốc ngoài danh mục.
  private async resolveMedicineId(medicineId: string | null | undefined) {
    if (!medicineId) return medicineId;
    if (!(await MedicineAvailabilityService.assertUsable(medicineId))) {
      throw new AppError("Thuốc không có trong danh mục hoặc đã ngừng sử dụng", 400, "MEDICINE_NOT_USABLE");
    }
    return medicineId;
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

  async issue(id: string, actor: Actor, options: { acknowledgeShortage?: boolean } = {}) {
    const prescription = await this.ensureDraft(id, actor);

    if (prescription.items.length === 0) {
      throw new AppError(
        "Đơn thuốc cần có ít nhất 1 thuốc trước khi phát hành",
        400,
      );
    }

    // Dòng gắn thuốc kho mà số lượng kê vượt khả năng cấp: không tính tiền và không chờ cấp, vì cơ sở không có thuốc
    // để cấp. Bác sĩ phải xác nhận rõ; sau đó các dòng này được đánh dấu "kho hết hàng, người khám tự mua".
    const availability = await MedicineAvailabilityService.forItems(prescription.items);
    const shortItems = prescription.items.filter((item) => availability.get(item.id)?.short);
    if (shortItems.length > 0 && !options.acknowledgeShortage) {
      throw new AppError(
        `Kho không đủ thuốc cho ${shortItems.length} dòng (${shortItems.map((item) => item.medicineName).join(", ")}). Giảm số lượng, đổi thuốc, hoặc xác nhận để người khám tự mua phần này.`,
        409,
        "STOCK_SHORT_ACK_REQUIRED",
      );
    }

    const transition = await prisma.$transaction(async (tx) => {
      if (shortItems.length > 0) {
        await tx.prescriptionItem.updateMany({
          where: { id: { in: shortItems.map((item) => item.id) } },
          data: { fulfillmentStatus: "OUT_OF_STOCK", fulfillmentNote: "Kho không đủ lúc kê đơn" },
        });
      }
      const updatedPrescription = await tx.prescription.update({
        where: { id },
        data: {
          status: "ISSUED",
          issuedAt: new Date(),
          cancelledAt: null,
        },
        select: prescriptionSelect,
      });
      await logClinicalAction(tx, {
        action: "PRESCRIPTION_ISSUED",
        actorId: actor.userId,
        prescriptionId: id,
        note: "Phát hành đơn thuốc",
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

    await StaffNotificationService.notifyRoles(["PHARMACIST"], {
      type: "PRESCRIPTION_ISSUED",
      title: "Có đơn thuốc mới chờ cấp",
      body: `Đơn ${transition.updatedPrescription.prescriptionCode} vừa được phát hành, đang chờ cấp thuốc.`,
      entityType: "PRESCRIPTION",
      entityId: transition.updatedPrescription.id,
      eventKey: `prescription:${transition.updatedPrescription.id}:issued`,
    });
    // Tiền thuốc vào hóa đơn ngay khi phát hành (nếu lịch đã có hóa đơn chưa thanh toán). Lỗi ở đây không được
    // làm hỏng việc phát hành đơn đã hoàn tất; hóa đơn lập sau sẽ tự tính tiền thuốc.
    await InvoiceService.syncMedicineLines(transition.updatedPrescription.id, actor).catch((error) => {
      logger.error("[INVOICE_MEDICINE] cannot add prescribed medicines to invoice:", error);
    });
    return transition.updatedPrescription;
  }

  async cancel(id: string, actor: Actor) {
    const prescription = await this.getById(id, actor);

    if (prescription.status === "CANCELLED") {
      throw new AppError("Đơn thuốc đã bị hủy", 400);
    }

    // Thuốc đã xuất kho thì không hủy đơn được nữa, tránh lệch giữa đơn và sổ kho.
    const dispensed = await prisma.prescription.findUnique({
      where: { id },
      select: { dispenseStatus: true },
    });
    if (dispensed?.dispenseStatus === "DISPENSED") {
      throw new AppError("Đơn thuốc đã được cấp phát, không thể hủy", 409, "PRESCRIPTION_DISPENSED");
    }

    const cancelled = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.prescription.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
        select: prescriptionSelect,
      });
      await logClinicalAction(tx, {
        action: "PRESCRIPTION_CANCELLED",
        actorId: actor.userId,
        prescriptionId: id,
        note: "Hủy đơn thuốc",
      });
      return cancelled;
    });
    // Đơn đã hủy thì gỡ dòng tiền thuốc khỏi hóa đơn chưa thu (hoặc hóa đơn bổ sung chưa thu).
    await InvoiceService.syncMedicineLines(id, actor).catch((error) => {
      logger.error("[INVOICE_MEDICINE] cannot remove cancelled medicines from invoice:", error);
    });
    return cancelled;
  }

  /**
   * Bác sĩ xử lý dòng thuốc của đơn ĐÃ phát hành mà kho không cấp được (hết hàng sau lúc kê, hoặc người khám tự mua):
   * đánh dấu dòng, rồi tiền thuốc được gỡ khỏi hóa đơn (hóa đơn đã thu thì chuyển sang luồng hoàn tiền thuốc). Dược sĩ
   * không có quyền này; chỉ dòng còn chờ cấp của đơn chưa cấp mới đánh dấu được.
   */
  async resolveItem(
    prescriptionId: string,
    itemId: string,
    input: { status: "OUTSIDE" | "OUT_OF_STOCK"; note?: string | null },
    actor: Actor,
  ) {
    const prescription = await this.getById(prescriptionId, actor);
    if (prescription.status !== "ISSUED") {
      throw new AppError("Chỉ xử lý dòng thuốc của đơn đã phát hành", 409, "PRESCRIPTION_NOT_ISSUED");
    }
    const state = await prisma.prescription.findUniqueOrThrow({ where: { id: prescriptionId }, select: { dispenseStatus: true } });
    if (state.dispenseStatus === "DISPENSED") {
      throw new AppError("Đơn thuốc đã được cấp phát, không thể đổi", 409, "PRESCRIPTION_DISPENSED");
    }
    const item = await this.getItem(prescriptionId, itemId);
    if (item.fulfillmentStatus !== "PENDING") {
      throw new AppError("Dòng thuốc này đã được xử lý", 409, "ITEM_ALREADY_RESOLVED");
    }
    const note =
      normalizeOptionalString(input.note) ??
      (input.status === "OUTSIDE" ? "Bác sĩ chuyển sang người khám tự mua" : "Kho hết thuốc sau khi kê đơn");
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.prescriptionItem.updateMany({
        where: { id: itemId, prescriptionId, fulfillmentStatus: "PENDING" },
        data: { fulfillmentStatus: input.status, fulfillmentNote: note },
      });
      if (claimed.count !== 1) throw new AppError("Dòng thuốc này đã được xử lý", 409, "ITEM_ALREADY_RESOLVED");
      await logClinicalAction(tx, {
        action: "PRESCRIPTION_ISSUED",
        actorId: actor.userId,
        prescriptionId,
        note: "Bác sĩ đánh dấu một dòng thuốc không cấp từ kho",
      });
    });
    await InvoiceService.syncMedicineLines(prescriptionId, actor).catch((error) => {
      logger.error("[INVOICE_MEDICINE] cannot sync after resolving item:", error);
    });
    return this.getById(prescriptionId, actor);
  }

  async createItem(
    prescriptionId: string,
    input: PrescriptionItemInput,
    actor: Actor,
  ) {
    await this.ensureDraft(prescriptionId, actor);
    const medicineId = await this.resolveMedicineId(input.medicineId);

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
        medicineId: medicineId ?? null,
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
    const medicineId = await this.resolveMedicineId(input.medicineId);

    await prisma.prescriptionItem.update({
      where: { id: itemId },
      data: {
        // undefined = giữ nguyên; null = bỏ gắn thuốc kho.
        medicineId,
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

  private generateUniquePrescriptionCode(tx: Prisma.TransactionClient) {
    return generateUniqueCode(
      generatePrescriptionCode,
      async (prescriptionCode) => Boolean(await tx.prescription.findUnique({ where: { prescriptionCode }, select: { id: true } })),
      "Không thể tạo mã đơn thuốc",
    );
  }
}

export default new PrescriptionService();
