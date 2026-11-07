import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { logClinicalAction } from "./clinicalLog.service.js";
import PatientEventNotificationService from "./patientEventNotification.service.js";

type Actor = { userId: string; role: string };

const normalize = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const medicineSelect = {
  id: true,
  code: true,
  name: true,
  activeIngredient: true,
  strength: true,
  dosageForm: true,
  unit: true,
  stockQuantity: true,
  minStock: true,
  isActive: true,
  note: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MedicineSelect;

const queueSelect = {
  id: true,
  prescriptionCode: true,
  status: true,
  note: true,
  issuedAt: true,
  dispenseStatus: true,
  dispensedAt: true,
  dispenseNote: true,
  patient: { select: { id: true, fullName: true, phone: true } },
  doctor: { select: { title: true, user: { select: { fullName: true } } } },
  // Dược sĩ cần thấy dị ứng đã khai báo để kiểm tra trước khi cấp thuốc.
  appointment: { select: { bookingCode: true, allergies: true } },
  dispensedBy: { select: { id: true, fullName: true } },
  items: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      medicineName: true,
      dosage: true,
      frequency: true,
      duration: true,
      quantity: true,
      unit: true,
      instruction: true,
      medicineId: true,
      dispensedQuantity: true,
      medicine: {
        select: { id: true, code: true, name: true, unit: true, stockQuantity: true },
      },
    },
  },
} satisfies Prisma.PrescriptionSelect;

export type DispenseLine = { itemId: string; medicineId?: string | null };

const pageOf = (page?: number, limit?: number) => {
  const safeLimit = Math.min(Math.max(limit || 20, 1), 100);
  const safePage = Math.max(page || 1, 1);
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
};

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: string }).code === "P2002";

class PharmacyService {
  // ---------- Danh mục thuốc ----------

  async listMedicines(query: {
    q?: string;
    lowStock?: boolean;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, skip } = pageOf(query.page, query.limit);
    const search = normalize(query.q);
    const where: Prisma.MedicineWhereInput = {
      isActive: query.isActive,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
              { activeIngredient: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    // "Sắp hết" so sánh hai cột của cùng dòng, Prisma chưa lọc được trực tiếp. Danh mục
    // thuốc của một bệnh viện nhỏ nên lọc theo id trước khi phân trang là đủ và tránh
    // SQL thô phụ thuộc tên schema.
    if (query.lowStock) {
      const levels = await prisma.medicine.findMany({
        where: { isActive: true },
        select: { id: true, stockQuantity: true, minStock: true },
        take: 5000,
      });
      where.id = {
        in: levels.filter((item) => item.stockQuantity <= item.minStock).map((item) => item.id),
      };
    }

    const [items, total] = await prisma.$transaction([
      prisma.medicine.findMany({
        where,
        select: medicineSelect,
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.medicine.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createMedicine(input: {
    code: string;
    name: string;
    activeIngredient?: string | null;
    strength?: string | null;
    dosageForm?: string | null;
    unit: string;
    minStock?: number;
    note?: string | null;
  }) {
    try {
      return await prisma.medicine.create({
        data: {
          code: input.code.trim().toUpperCase(),
          name: input.name.trim(),
          activeIngredient: normalize(input.activeIngredient),
          strength: normalize(input.strength),
          dosageForm: normalize(input.dosageForm),
          unit: input.unit.trim(),
          minStock: input.minStock ?? 0,
          note: normalize(input.note),
        },
        select: medicineSelect,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError("Mã thuốc đã tồn tại", 409, "MEDICINE_CODE_EXISTS");
      }
      throw error;
    }
  }

  // Không cho sửa tồn ở đây: tồn chỉ đổi qua sổ kho (nhập, cấp, điều chỉnh).
  async updateMedicine(
    id: string,
    input: {
      name?: string;
      activeIngredient?: string | null;
      strength?: string | null;
      dosageForm?: string | null;
      unit?: string;
      minStock?: number;
      isActive?: boolean;
      note?: string | null;
    },
  ) {
    await this.getMedicine(id);
    return prisma.medicine.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        activeIngredient:
          input.activeIngredient === undefined ? undefined : normalize(input.activeIngredient),
        strength: input.strength === undefined ? undefined : normalize(input.strength),
        dosageForm: input.dosageForm === undefined ? undefined : normalize(input.dosageForm),
        unit: input.unit?.trim(),
        minStock: input.minStock,
        isActive: input.isActive,
        note: input.note === undefined ? undefined : normalize(input.note),
      },
      select: medicineSelect,
    });
  }

  async getMedicine(id: string) {
    const medicine = await prisma.medicine.findUnique({
      where: { id },
      select: medicineSelect,
    });
    if (!medicine) throw new AppError("Không tìm thấy thuốc", 404);
    return medicine;
  }

  // ---------- Sổ kho ----------

  async listMovements(medicineId: string, query: { page?: number; limit?: number }) {
    await this.getMedicine(medicineId);
    const { page, limit, skip } = pageOf(query.page, query.limit);
    const where = { medicineId };
    const [items, total] = await prisma.$transaction([
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          quantity: true,
          balanceAfter: true,
          reason: true,
          createdAt: true,
          actor: { select: { id: true, fullName: true } },
          prescriptionItem: {
            select: { prescription: { select: { prescriptionCode: true } } },
          },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);
    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async receive(medicineId: string, quantity: number, reason: string | null | undefined, actor: Actor) {
    return this.moveStock(medicineId, quantity, "RECEIPT", normalize(reason), actor);
  }

  async adjust(medicineId: string, delta: number, reason: string, actor: Actor) {
    const trimmed = normalize(reason);
    if (!trimmed) {
      throw new AppError("Điều chỉnh tồn kho phải có lý do", 400, "ADJUSTMENT_REASON_REQUIRED");
    }
    return this.moveStock(medicineId, delta, "ADJUSTMENT", trimmed, actor);
  }

  // Cập nhật tồn có điều kiện (không bao giờ âm) rồi ghi một dòng sổ trong cùng
  // transaction; hai yêu cầu đồng thời không thể làm tồn lệch với sổ.
  private async moveStock(
    medicineId: string,
    delta: number,
    type: "RECEIPT" | "ADJUSTMENT",
    reason: string | null,
    actor: Actor,
  ) {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new AppError("Số lượng phải là số nguyên khác 0", 400, "INVALID_QUANTITY");
    }
    if (type === "RECEIPT" && delta < 0) {
      throw new AppError("Số lượng nhập kho phải lớn hơn 0", 400, "INVALID_QUANTITY");
    }

    return prisma.$transaction(async (tx) => {
      const claimed = await tx.medicine.updateMany({
        where: {
          id: medicineId,
          ...(delta < 0 ? { stockQuantity: { gte: -delta } } : {}),
        },
        data: { stockQuantity: { increment: delta } },
      });

      if (claimed.count !== 1) {
        const exists = await tx.medicine.findUnique({
          where: { id: medicineId },
          select: { stockQuantity: true },
        });
        if (!exists) throw new AppError("Không tìm thấy thuốc", 404);
        throw new AppError(
          `Tồn kho hiện là ${exists.stockQuantity}, không thể giảm ${-delta}`,
          409,
          "INSUFFICIENT_STOCK",
        );
      }

      const { stockQuantity } = await tx.medicine.findUniqueOrThrow({
        where: { id: medicineId },
        select: { stockQuantity: true },
      });
      await tx.stockMovement.create({
        data: {
          medicineId,
          type,
          quantity: delta,
          balanceAfter: stockQuantity,
          reason,
          actorId: actor.userId,
        },
      });

      return tx.medicine.findUniqueOrThrow({
        where: { id: medicineId },
        select: medicineSelect,
      });
    });
  }

  // ---------- Đơn chờ cấp ----------

  async listPrescriptions(query: {
    dispenseStatus?: "NOT_DISPENSED" | "DISPENSED";
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, skip } = pageOf(query.page, query.limit);
    const search = normalize(query.q);
    // Chỉ đơn đã phát hành mới vào hàng đợi; đơn nháp/đã hủy dược sĩ không thấy.
    const where: Prisma.PrescriptionWhereInput = {
      status: "ISSUED",
      dispenseStatus: query.dispenseStatus ?? "NOT_DISPENSED",
      ...(search
        ? {
            OR: [
              { prescriptionCode: { contains: search, mode: "insensitive" } },
              { patient: { fullName: { contains: search, mode: "insensitive" } } },
              { patient: { phone: { contains: search } } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.prescription.findMany({
        where,
        select: queueSelect,
        orderBy: { issuedAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.prescription.count({ where }),
    ]);
    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPrescription(id: string) {
    const prescription = await prisma.prescription.findFirst({
      where: { id, status: "ISSUED" },
      select: queueSelect,
    });
    if (!prescription) throw new AppError("Không tìm thấy đơn thuốc đã phát hành", 404);
    return prescription;
  }

  // Cấp nguyên đơn trong MỘT transaction: hoặc trừ kho đủ mọi dòng và đánh dấu đã
  // cấp, hoặc không đổi gì. `confirmed` là hộp xác nhận dược sĩ đã kiểm tra đơn.
  async dispense(
    prescriptionId: string,
    input: { lines?: DispenseLine[]; confirmed: boolean; note?: string | null },
    actor: Actor,
  ) {
    if (input.confirmed !== true) {
      throw new AppError(
        "Cần xác nhận đã kiểm tra đơn (dị ứng, liều dùng) trước khi cấp thuốc",
        400,
        "DISPENSE_CONFIRMATION_REQUIRED",
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Giành quyền cấp đơn: chỉ một yêu cầu thắng, yêu cầu thứ hai nhận 409.
      const claimed = await tx.prescription.updateMany({
        where: { id: prescriptionId, status: "ISSUED", dispenseStatus: "NOT_DISPENSED" },
        data: {
          dispenseStatus: "DISPENSED",
          dispensedAt: new Date(),
          dispensedById: actor.userId,
          dispenseNote: normalize(input.note),
        },
      });
      if (claimed.count !== 1) {
        const existing = await tx.prescription.findUnique({
          where: { id: prescriptionId },
          select: { status: true, dispenseStatus: true },
        });
        if (!existing) throw new AppError("Không tìm thấy đơn thuốc", 404);
        if (existing.status !== "ISSUED") {
          throw new AppError("Chỉ cấp thuốc cho đơn đã phát hành", 409, "PRESCRIPTION_NOT_ISSUED");
        }
        throw new AppError("Đơn thuốc đã được cấp", 409, "ALREADY_DISPENSED");
      }

      const prescription = await tx.prescription.findUniqueOrThrow({
        where: { id: prescriptionId },
        select: {
          id: true,
          prescriptionCode: true,
          patientId: true,
          appointment: { select: { bookingCode: true } },
          items: {
            select: { id: true, medicineName: true, quantity: true, medicineId: true },
          },
        },
      });

      const overrides = new Map((input.lines || []).map((line) => [line.itemId, line.medicineId]));
      for (const itemId of overrides.keys()) {
        if (!prescription.items.some((item) => item.id === itemId)) {
          throw new AppError("Dòng thuốc không thuộc đơn này", 400, "ITEM_NOT_IN_PRESCRIPTION");
        }
      }

      // Gom theo thuốc để trừ kho một lần mỗi thuốc, theo thứ tự id để tránh deadlock.
      const plan = new Map<string, { quantity: number; items: { id: string; quantity: number }[] }>();
      for (const item of prescription.items) {
        const medicineId = overrides.has(item.id) ? overrides.get(item.id) : item.medicineId;
        // Không gắn thuốc kho = thuốc mua ngoài, không trừ kho.
        if (!medicineId) continue;
        if (!item.quantity || item.quantity <= 0) {
          throw new AppError(
            `Dòng "${item.medicineName}" chưa có số lượng nên không thể trừ kho`,
            400,
            "ITEM_QUANTITY_REQUIRED",
          );
        }
        const entry = plan.get(medicineId) || { quantity: 0, items: [] };
        entry.quantity += item.quantity;
        entry.items.push({ id: item.id, quantity: item.quantity });
        plan.set(medicineId, entry);
      }

      const shortages: string[] = [];
      for (const medicineId of [...plan.keys()].sort()) {
        const entry = plan.get(medicineId)!;
        const medicine = await tx.medicine.findUnique({
          where: { id: medicineId },
          select: { name: true, isActive: true },
        });
        if (!medicine) throw new AppError("Không tìm thấy thuốc trong kho", 404, "MEDICINE_NOT_FOUND");
        if (!medicine.isActive) {
          throw new AppError(`Thuốc ${medicine.name} đã ngừng sử dụng`, 409, "MEDICINE_INACTIVE");
        }

        const deducted = await tx.medicine.updateMany({
          where: { id: medicineId, stockQuantity: { gte: entry.quantity } },
          data: { stockQuantity: { decrement: entry.quantity } },
        });
        if (deducted.count !== 1) {
          shortages.push(medicine.name);
          continue;
        }

        const { stockQuantity } = await tx.medicine.findUniqueOrThrow({
          where: { id: medicineId },
          select: { stockQuantity: true },
        });
        // Mỗi dòng đơn một dòng sổ; balanceAfter của dòng đầu = tồn sau khi trừ dòng đó.
        let balance = stockQuantity + entry.quantity;
        for (const item of entry.items) {
          balance -= item.quantity;
          await tx.stockMovement.create({
            data: {
              medicineId,
              type: "DISPENSE",
              quantity: -item.quantity,
              balanceAfter: balance,
              prescriptionItemId: item.id,
              actorId: actor.userId,
            },
          });
          await tx.prescriptionItem.update({
            where: { id: item.id },
            data: { medicineId, dispensedQuantity: item.quantity },
          });
        }
      }

      if (shortages.length > 0) {
        // Ném lỗi để cả transaction (kể cả việc giành đơn) bị hủy: cấp nguyên đơn hoặc không.
        throw new AppError(
          `Không đủ tồn kho: ${shortages.join(", ")}`,
          409,
          "INSUFFICIENT_STOCK",
        );
      }

      await logClinicalAction(tx, {
        action: "PRESCRIPTION_DISPENSED",
        actorId: actor.userId,
        prescriptionId,
        note: "Cấp phát thuốc theo đơn",
      });
      const notification =
        await PatientEventNotificationService.createPrescriptionDispensed(
          {
            userId: prescription.patientId,
            prescriptionId,
            prescriptionCode: prescription.prescriptionCode,
            bookingCode: prescription.appointment.bookingCode,
          },
          tx,
        );

      return { notificationId: notification.id };
    });

    await PatientEventNotificationService.dispatchBestEffort(result.notificationId);
    return this.getPrescription(prescriptionId);
  }
}

export default new PharmacyService();
