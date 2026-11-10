import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import {
  EXPIRY_WARNING_DAYS,
  allocateFefo,
  batchStatus,
  daysUntil,
  isExpired,
  sellableQuantity,
  unbatchedQuantity,
} from "../utils/stockBatch.js";
import { getVietnamNowParts, parseDateOnly, toDateOnly } from "../utils/time.js";
import { logClinicalAction } from "./clinicalLog.service.js";
import PatientEventNotificationService from "./patientEventNotification.service.js";
import StaffNotificationService from "./staffNotification.service.js";

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

type MoveOptions = {
  batch?: { batchNumber: string; expiryDate: string };
  batchId?: string;
};

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

    // Gắn thông tin lô: tồn cấp được (không tính lô hết hạn), lượng đã hết hạn và hạn dùng gần nhất.
    const today = getVietnamNowParts().date;
    const batches = items.length
      ? await prisma.stockBatch.findMany({
          where: { medicineId: { in: items.map((item) => item.id) }, quantity: { gt: 0 } },
          select: { id: true, medicineId: true, expiryDate: true, quantity: true },
        })
      : [];
    const enriched = items.map((item) => {
      const own = batches
        .filter((batch) => batch.medicineId === item.id)
        .map((batch) => ({ id: batch.id, expiryDate: toDateOnly(batch.expiryDate), quantity: batch.quantity }));
      const live = own.filter((batch) => !isExpired(batch.expiryDate, today)).map((batch) => batch.expiryDate).sort();
      const sellable = sellableQuantity(item.stockQuantity, own, today);
      return {
        ...item,
        sellableQuantity: sellable,
        expiredQuantity: item.stockQuantity - sellable,
        nearestExpiry: live[0] ?? null,
      };
    });

    return {
      items: enriched,
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
          batch: { select: { id: true, batchNumber: true, expiryDate: true } },
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

  // Nhập kho; có số lô và hạn dùng thì ghi vào lô (cộng dồn nếu lô đã có với cùng hạn dùng).
  async receive(
    medicineId: string,
    quantity: number,
    reason: string | null | undefined,
    actor: Actor,
    batch?: { batchNumber?: string | null; expiryDate?: string | null },
  ) {
    const batchNumber = normalize(batch?.batchNumber);
    const expiry = normalize(batch?.expiryDate);
    if (Boolean(batchNumber) !== Boolean(expiry)) {
      throw new AppError("Số lô và hạn dùng phải khai cùng nhau", 400, "BATCH_FIELDS_INCOMPLETE");
    }
    const result = await this.moveStock(medicineId, quantity, "RECEIPT", normalize(reason), actor, {
      batch: batchNumber && expiry ? { batchNumber, expiryDate: expiry } : undefined,
    });
    await this.notifyStockAlerts();
    return result;
  }

  // Điều chỉnh tồn; có batchId thì điều chỉnh trong lô đó (ví dụ hủy lô hết hạn hoặc hỏng).
  async adjust(medicineId: string, delta: number, reason: string, actor: Actor, batchId?: string | null) {
    const trimmed = normalize(reason);
    if (!trimmed) {
      throw new AppError("Điều chỉnh tồn kho phải có lý do", 400, "ADJUSTMENT_REASON_REQUIRED");
    }
    const result = await this.moveStock(medicineId, delta, "ADJUSTMENT", trimmed, actor, { batchId: batchId ?? undefined });
    await this.notifyStockAlerts();
    return result;
  }

  // Cập nhật tồn có điều kiện (không bao giờ âm) rồi ghi một dòng sổ trong cùng
  // transaction; hai yêu cầu đồng thời không thể làm tồn lệch với sổ.
  private moveStock(
    medicineId: string,
    delta: number,
    type: "RECEIPT" | "ADJUSTMENT",
    reason: string | null,
    actor: Actor,
    options?: MoveOptions,
  ) {
    return prisma.$transaction((tx) => this.moveStockIn(tx, medicineId, delta, type, reason, actor, options));
  }

  // Dùng được trong transaction của nơi gọi (ví dụ nhập kho hàng loạt từ CSV: hoặc đủ hoặc không).
  async moveStockIn(
    tx: Prisma.TransactionClient,
    medicineId: string,
    delta: number,
    type: "RECEIPT" | "ADJUSTMENT",
    reason: string | null,
    actor: Actor,
    options?: MoveOptions,
  ) {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new AppError("Số lượng phải là số nguyên khác 0", 400, "INVALID_QUANTITY");
    }
    if (type === "RECEIPT" && delta < 0) {
      throw new AppError("Số lượng nhập kho phải lớn hơn 0", 400, "INVALID_QUANTITY");
    }

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

    const batchId = await this.applyToBatch(tx, medicineId, delta, type, options);

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
        batchId,
      },
    });

    return tx.medicine.findUniqueOrThrow({
      where: { id: medicineId },
      select: medicineSelect,
    });
  }

  // Ghi thay đổi vào lô (nếu có) và trả về id lô để gắn vào dòng sổ kho.
  private async applyToBatch(
    tx: Prisma.TransactionClient,
    medicineId: string,
    delta: number,
    type: "RECEIPT" | "ADJUSTMENT",
    options?: MoveOptions,
  ): Promise<string | null> {
    if (options?.batch && type === "RECEIPT") {
      const expiryDate = parseDateOnly(options.batch.expiryDate);
      if (isExpired(toDateOnly(expiryDate), getVietnamNowParts().date)) {
        throw new AppError("Không nhập kho lô đã hết hạn", 400, "BATCH_ALREADY_EXPIRED");
      }
      const existing = await tx.stockBatch.findUnique({
        where: { medicineId_batchNumber: { medicineId, batchNumber: options.batch.batchNumber } },
      });
      if (existing) {
        if (toDateOnly(existing.expiryDate) !== toDateOnly(expiryDate)) {
          throw new AppError(
            `Lô ${existing.batchNumber} đã có với hạn dùng khác (${toDateOnly(existing.expiryDate)})`,
            409,
            "BATCH_EXPIRY_MISMATCH",
          );
        }
        await tx.stockBatch.update({
          where: { id: existing.id },
          data: { quantity: { increment: delta }, receivedQuantity: { increment: delta } },
        });
        return existing.id;
      }
      const created = await tx.stockBatch.create({
        data: {
          medicineId,
          batchNumber: options.batch.batchNumber,
          expiryDate,
          receivedQuantity: delta,
          quantity: delta,
        },
      });
      return created.id;
    }

    if (options?.batchId) {
      const batch = await tx.stockBatch.findUnique({ where: { id: options.batchId } });
      if (!batch || batch.medicineId !== medicineId) {
        throw new AppError("Lô không thuộc thuốc này", 400, "BATCH_NOT_FOUND");
      }
      const moved = await tx.stockBatch.updateMany({
        where: { id: batch.id, ...(delta < 0 ? { quantity: { gte: -delta } } : {}) },
        data: { quantity: { increment: delta } },
      });
      if (moved.count !== 1) {
        throw new AppError(
          `Lô ${batch.batchNumber} chỉ còn ${batch.quantity}, không thể giảm ${-delta}`,
          409,
          "INSUFFICIENT_BATCH_STOCK",
        );
      }
      return batch.id;
    }

    return null;
  }

  // Các lô còn hàng của một thuốc, lô hết hạn sớm nhất ở trên cùng.
  async listBatches(medicineId: string) {
    const medicine = await this.getMedicine(medicineId);
    const today = getVietnamNowParts().date;
    const rows = await prisma.stockBatch.findMany({
      where: { medicineId, quantity: { gt: 0 } },
      orderBy: [{ expiryDate: "asc" }, { batchNumber: "asc" }],
      select: { id: true, batchNumber: true, expiryDate: true, receivedQuantity: true, quantity: true, createdAt: true },
    });
    const items = rows.map((row) => {
      const expiry = toDateOnly(row.expiryDate);
      return { ...row, expiryDate: expiry, status: batchStatus(expiry, today), daysLeft: daysUntil(expiry, today) };
    });
    const like = items.map((item) => ({ id: item.id, expiryDate: item.expiryDate, quantity: item.quantity }));
    return {
      items,
      summary: {
        stockQuantity: medicine.stockQuantity,
        sellableQuantity: sellableQuantity(medicine.stockQuantity, like, today),
        unbatchedQuantity: unbatchedQuantity(medicine.stockQuantity, like),
      },
    };
  }

  // Lô đã hết hạn hoặc sắp hết hạn trong `days` ngày tới (mặc định 60), còn hàng, hết hạn sớm nhất trước.
  async expiryAlerts(days?: number) {
    const horizon = Math.min(Math.max(days || EXPIRY_WARNING_DAYS, 1), 365);
    const today = getVietnamNowParts().date;
    const limitDate = new Date(Date.parse(`${today}T00:00:00Z`) + horizon * 86_400_000);
    const where = { quantity: { gt: 0 }, expiryDate: { lte: limitDate }, medicine: { isActive: true } };
    const [rows, total] = await prisma.$transaction([
      prisma.stockBatch.findMany({
        where,
        orderBy: [{ expiryDate: "asc" }, { batchNumber: "asc" }],
        take: 100,
        select: {
          id: true,
          batchNumber: true,
          expiryDate: true,
          quantity: true,
          medicine: { select: { id: true, code: true, name: true, strength: true, unit: true } },
        },
      }),
      prisma.stockBatch.count({ where }),
    ]);
    const items = rows.map((row) => {
      const expiry = toDateOnly(row.expiryDate);
      return { ...row, expiryDate: expiry, status: batchStatus(expiry, today, horizon), daysLeft: daysUntil(expiry, today) };
    });
    return { items, summary: { total, expired: items.filter((item) => item.status === "EXPIRED").length } };
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

        // Chỉ cấp từ tồn còn hạn: trừ phần nằm trong các lô đã hết hạn ra khỏi tồn cấp được.
        const today = getVietnamNowParts().date;
        const batchRows = await tx.stockBatch.findMany({
          where: { medicineId, quantity: { gt: 0 } },
          select: { id: true, expiryDate: true, quantity: true },
        });
        const batches = batchRows.map((row) => ({ id: row.id, expiryDate: toDateOnly(row.expiryDate), quantity: row.quantity }));
        const current = await tx.medicine.findUniqueOrThrow({ where: { id: medicineId }, select: { stockQuantity: true } });
        if (entry.quantity > sellableQuantity(current.stockQuantity, batches, today)) {
          shortages.push(medicine.name);
          continue;
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
        // Mỗi dòng đơn một hoặc vài dòng sổ (mỗi lô lấy hàng một dòng); balanceAfter giảm dần theo từng dòng.
        let balance = stockQuantity + entry.quantity;
        let unbatchedLeft = unbatchedQuantity(current.stockQuantity, batches);
        for (const item of entry.items) {
          const plan = allocateFefo(batches, unbatchedLeft, item.quantity, today);
          if (!plan) {
            throw new AppError(`Không đủ tồn còn hạn: ${medicine.name}`, 409, "INSUFFICIENT_STOCK");
          }
          const slices: { batchId: string | null; quantity: number }[] = plan.allocations.map((allocation) => ({
            batchId: allocation.batchId,
            quantity: allocation.quantity,
          }));
          if (plan.fromUnbatched > 0) slices.push({ batchId: null, quantity: plan.fromUnbatched });
          unbatchedLeft -= plan.fromUnbatched;

          for (const slice of slices) {
            if (slice.batchId) {
              const taken = await tx.stockBatch.updateMany({
                where: { id: slice.batchId, quantity: { gte: slice.quantity } },
                data: { quantity: { decrement: slice.quantity } },
              });
              if (taken.count !== 1) {
                throw new AppError("Tồn của lô vừa thay đổi, vui lòng thử lại", 409, "BATCH_CHANGED");
              }
              const local = batches.find((batch) => batch.id === slice.batchId);
              if (local) local.quantity -= slice.quantity;
            }
            balance -= slice.quantity;
            await tx.stockMovement.create({
              data: {
                medicineId,
                type: "DISPENSE",
                quantity: -slice.quantity,
                balanceAfter: balance,
                prescriptionItemId: item.id,
                batchId: slice.batchId,
                actorId: actor.userId,
              },
            });
          }
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
    await this.notifyStockAlerts();
    return this.getPrescription(prescriptionId);
  }

  // Báo dược sĩ thuốc sắp hết hoặc sắp hết hạn. Mỗi thuốc nhiều nhất một lần mỗi ngày
  // (khóa chống trùng theo ngày); chạy sau mỗi thay đổi tồn và không bao giờ làm hỏng thao tác gốc.
  async notifyStockAlerts() {
    try {
      const today = getVietnamNowParts().date;
      const medicines = await prisma.medicine.findMany({
        where: { isActive: true, minStock: { gt: 0 } },
        select: { id: true, name: true, unit: true, stockQuantity: true, minStock: true },
      });
      for (const medicine of medicines.filter((item) => item.stockQuantity <= item.minStock)) {
        await StaffNotificationService.notifyRoles(["PHARMACIST"], {
          type: "SYSTEM_ANNOUNCEMENT",
          title: "Thuốc sắp hết",
          body: `${medicine.name} còn ${medicine.stockQuantity} ${medicine.unit} (mức tối thiểu ${medicine.minStock}).`,
          entityType: "MEDICINE",
          entityId: medicine.id,
          eventKey: `pharmacy:${medicine.id}:low-stock:${today}`,
        });
      }
      const expiry = await this.expiryAlerts();
      if (expiry.summary.total > 0) {
        await StaffNotificationService.notifyRoles(["PHARMACIST"], {
          type: "SYSTEM_ANNOUNCEMENT",
          title: "Có lô thuốc sắp hoặc đã hết hạn",
          body: `${expiry.summary.total} lô cần xử lý, trong đó ${expiry.summary.expired} lô đã hết hạn. Mở Kho thuốc để xem chi tiết.`,
          entityType: "MEDICINE_EXPIRY",
          entityId: today,
          eventKey: `pharmacy:expiry:${today}`,
        });
      }
    } catch (error) {
      console.error("[STAFF_NOTIFICATION] stock alerts failed:", error);
    }
  }
}

export default new PharmacyService();
