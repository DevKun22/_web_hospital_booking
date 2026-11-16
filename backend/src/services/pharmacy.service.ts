import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import {
  EXPIRY_WARNING_DAYS,
  batchStatus,
  daysUntil,
  isExpired,
  sellableQuantity,
  unbatchedQuantity,
} from "../utils/stockBatch.js";
import { getVietnamNowParts, parseDateOnly, toDateOnly } from "../utils/time.js";
import StaffNotificationService from "./staffNotification.service.js";
import { logger } from "../observability/logger.js";

import { normalize, pageOf, type Actor } from "./pharmacy.shared.js";

const medicineSelect = {
  id: true,
  code: true,
  name: true,
  activeIngredient: true,
  strength: true,
  dosageForm: true,
  unit: true,
  unitPrice: true,
  stockQuantity: true,
  minStock: true,
  isActive: true,
  note: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MedicineSelect;



type MoveOptions = {
  batch?: { batchNumber: string; expiryDate: string };
  batchId?: string;
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
    unitPrice?: number;
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
          unitPrice: input.unitPrice ?? 0,
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
      unitPrice?: number;
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
        unitPrice: input.unitPrice,
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
      logger.error("[STAFF_NOTIFICATION] stock alerts failed:", error);
    }
  }
}

export default new PharmacyService();
