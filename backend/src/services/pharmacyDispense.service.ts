import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { allocateFefo, sellableQuantity, unbatchedQuantity } from "../utils/stockBatch.js";
import { logger } from "../observability/logger.js";
import { getVietnamNowParts, toDateOnly } from "../utils/time.js";
import { logClinicalAction } from "./clinicalLog.service.js";
import PatientEventNotificationService from "./patientEventNotification.service.js";
import InvoiceMedicineService from "./invoiceMedicine.service.js";
import PharmacyService from "./pharmacy.service.js";
import { normalize, pageOf, type Actor } from "./pharmacy.shared.js";

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
  // Hóa đơn chỉ để dược sĩ biết tình trạng thanh toán; backend chưa chặn cấp thuốc theo trạng thái này.
  appointment: {
    select: {
      bookingCode: true,
      patientInfo: { select: { allergies: true } },
      invoice: { select: { invoiceCode: true, status: true, paymentMethod: true } },
    },
  },
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
      fulfillmentStatus: true,
      fulfillmentNote: true,
      medicine: {
        select: { id: true, code: true, name: true, unit: true, stockQuantity: true },
      },
    },
  },
} satisfies Prisma.PrescriptionSelect;

// Giữ nguyên hợp đồng API: dị ứng vẫn nằm ở appointment.allergies dù dữ liệu lấy từ thông tin người khám của lịch.
const withAllergies = <T extends { appointment: { patientInfo: { allergies: string | null } | null } }>(row: T) => ({
  ...row,
  appointment: {
    ...row.appointment,
    patientInfo: undefined,
    allergies: row.appointment.patientInfo?.allergies ?? null,
  },
});

// Hàng đợi cấp thuốc: danh sách đơn đã phát hành chờ cấp và việc cấp nguyên đơn trong một transaction.
class PharmacyDispenseService {
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
      items: items.map(withAllergies),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPrescription(id: string) {
    const prescription = await prisma.prescription.findFirst({
      where: { id, status: "ISSUED" },
      select: queueSelect,
    });
    if (!prescription) throw new AppError("Không tìm thấy đơn thuốc đã phát hành", 404);
    return withAllergies(prescription);
  }

  // Cấp nguyên đơn trong MỘT transaction: hoặc trừ kho đủ mọi dòng và đánh dấu đã
  // cấp, hoặc không đổi gì. `confirmed` là hộp xác nhận dược sĩ đã kiểm tra đơn.
  async dispense(
    prescriptionId: string,
    input: { confirmed: boolean; note?: string | null },
    actor: Actor,
  ) {
    if (input.confirmed !== true) {
      throw new AppError(
        "Cần xác nhận đã kiểm tra đơn (dị ứng, liều dùng) trước khi cấp thuốc",
        400,
        "DISPENSE_CONFIRMATION_REQUIRED",
      );
    }

    // Dược sĩ chỉ cấp đúng những dòng bác sĩ đã kê và đã thu tiền: hóa đơn đã thanh toán và mọi dòng sắp cấp đều có
    // dòng tiền (trên hóa đơn chính hoặc hóa đơn bổ sung đã thu). Không có đường cấp trước khi thu tiền. Thuốc miễn
    // phí hoặc ngoài danh mục thì không cần hóa đơn.
    const coverage = await InvoiceMedicineService.medicineCoverage(prescriptionId);
    if (!coverage.covered) {
      throw new AppError(
        coverage.invoiceStatus === null
          ? "Chưa có hóa đơn cho lịch khám này. Cần lập hóa đơn và thu tiền thuốc trước khi cấp."
          : coverage.invoiceStatus === "PAID"
            ? "Tiền thuốc phát sinh sau khi thanh toán chưa được thu (hóa đơn bổ sung). Cần thu tiền trước khi cấp."
            : "Hóa đơn chưa thanh toán. Cần thu tiền trước khi cấp thuốc.",
        409,
        "PAYMENT_REQUIRED",
      );
    }

    await prisma.$transaction(async (tx) => {
      await this.claimForDispense(tx, prescriptionId, input.note, actor);

      const prescription = await tx.prescription.findUniqueOrThrow({
        where: { id: prescriptionId },
        select: {
          id: true,
          prescriptionCode: true,
          patientId: true,
          appointment: { select: { bookingCode: true } },
          items: {
            select: { id: true, medicineName: true, quantity: true, medicineId: true, fulfillmentStatus: true },
          },
        },
      });

      const { plan, skipped } = this.planDispense(prescription.items);
      let dispensedLines = 0;

      const shortages: string[] = [];
      for (const medicineId of [...plan.keys()].sort()) {
        const entry = plan.get(medicineId)!;
        const outcome = await this.deductMedicineForDispense(tx, medicineId, entry, actor);
        if (outcome.shortage) {
          shortages.push(outcome.shortage);
          continue;
        }
        dispensedLines += outcome.dispensedLines;
      }

      if (shortages.length > 0) {
        // Ném lỗi để cả transaction (kể cả việc giành đơn) bị hủy: cấp nguyên đơn hoặc không.
        throw new AppError(
          `Không đủ tồn kho: ${shortages.join(", ")}. Báo bác sĩ đổi thuốc hoặc đánh dấu người khám tự mua.`,
          409,
          "INSUFFICIENT_STOCK",
        );
      }

      for (const line of skipped) {
        await tx.prescriptionItem.update({
          where: { id: line.itemId },
          data: { fulfillmentStatus: line.status, fulfillmentNote: line.note },
        });
      }

      await logClinicalAction(tx, {
        action: "PRESCRIPTION_DISPENSED",
        actorId: actor.userId,
        prescriptionId,
        note: "Cấp phát thuốc theo đơn",
      });
      // Chỉ báo "thuốc đã được cấp" khi có ít nhất một dòng thực sự được cấp.
      if (dispensedLines > 0) {
        await PatientEventNotificationService.createPrescriptionDispensed(
          {
            userId: prescription.patientId,
            prescriptionId,
            prescriptionCode: prescription.prescriptionCode,
            bookingCode: prescription.appointment.bookingCode,
          },
          tx,
        );
      }
    });

    // Tiền thuốc vào hóa đơn chưa thanh toán (nếu có). Lỗi ở đây không được làm hỏng việc cấp thuốc đã hoàn tất.
    await InvoiceMedicineService.syncMedicineLines(prescriptionId, actor).catch((error) => {
      logger.error("[INVOICE_MEDICINE] cannot add dispensed medicines to invoice:", error);
    });
    await PharmacyService.notifyStockAlerts();
    return this.getPrescription(prescriptionId);
  }

  /** Giành quyền cấp đơn: chỉ một yêu cầu thắng, yêu cầu thứ hai nhận 409. */
  private async claimForDispense(
    tx: Prisma.TransactionClient,
    prescriptionId: string,
    note: string | null | undefined,
    actor: Actor,
  ) {
    // Giành quyền cấp đơn: chỉ một yêu cầu thắng, yêu cầu thứ hai nhận 409.
    const claimed = await tx.prescription.updateMany({
      where: { id: prescriptionId, status: "ISSUED", dispenseStatus: "NOT_DISPENSED" },
      data: {
        dispenseStatus: "DISPENSED",
        dispensedAt: new Date(),
        dispensedById: actor.userId,
        dispenseNote: normalize(note),
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
  }

  /** Gom các dòng chờ cấp theo thuốc kho; dòng không gắn thuốc kho thì đánh dấu mua ngoài. */
  private planDispense(
    items: { id: string; medicineName: string; quantity: number | null; medicineId: string | null; fulfillmentStatus: string }[],
  ) {
    // Dược sĩ cấp đúng thuốc bác sĩ đã gắn. Dòng bác sĩ đã đánh dấu mua ngoài hoặc hết hàng không còn ở trạng thái chờ
    // cấp nên bị bỏ qua; dòng không gắn thuốc kho là thuốc người khám tự mua.
    const skipped: { itemId: string; status: "OUTSIDE"; note: string | null }[] = [];
    // Gom theo thuốc để trừ kho một lần mỗi thuốc, theo thứ tự id để tránh deadlock.
    const plan = new Map<string, { quantity: number; items: { id: string; quantity: number }[] }>();
    for (const item of items) {
      // Dòng đã được xử lý từ lúc phát hành (kho không đủ thuốc nên đã đánh dấu hết hàng): không cấp, không đổi.
      if (item.fulfillmentStatus !== "PENDING") continue;
      const medicineId = item.medicineId;
      // Không gắn thuốc kho = thuốc mua ngoài, không trừ kho.
      if (!medicineId) {
        skipped.push({ itemId: item.id, status: "OUTSIDE", note: null });
        continue;
      }
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
    return { plan, skipped };
  }

  /** Trừ kho (FEFO theo lô) cho mọi dòng của một thuốc. Trả về tên thuốc nếu không đủ tồn còn hạn. */
  private async deductMedicineForDispense(
    tx: Prisma.TransactionClient,
    medicineId: string,
    entry: { quantity: number; items: { id: string; quantity: number }[] },
    actor: Actor,
  ): Promise<{ shortage: string | null; dispensedLines: number }> {
    let dispensedLines = 0;
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
      return { shortage: medicine.name, dispensedLines: 0 };
    }

    const deducted = await tx.medicine.updateMany({
      where: { id: medicineId, stockQuantity: { gte: entry.quantity } },
      data: { stockQuantity: { decrement: entry.quantity } },
    });
    if (deducted.count !== 1) {
      return { shortage: medicine.name, dispensedLines: 0 };
    }

    const { stockQuantity } = await tx.medicine.findUniqueOrThrow({
      where: { id: medicineId },
      select: { stockQuantity: true },
    });
    // Mỗi dòng đơn một hoặc vài dòng sổ (mỗi lô lấy hàng một dòng); balanceAfter giảm dần theo từng dòng.
    let balance = stockQuantity + entry.quantity;
    let unbatchedLeft = unbatchedQuantity(current.stockQuantity, batches);
    for (const item of entry.items) {
      const slicePlan = allocateFefo(batches, unbatchedLeft, item.quantity, today);
      if (!slicePlan) {
        throw new AppError(`Không đủ tồn còn hạn: ${medicine.name}`, 409, "INSUFFICIENT_STOCK");
      }
      const slices: { batchId: string | null; quantity: number }[] = slicePlan.allocations.map((allocation) => ({
        batchId: allocation.batchId,
        quantity: allocation.quantity,
      }));
      if (slicePlan.fromUnbatched > 0) slices.push({ batchId: null, quantity: slicePlan.fromUnbatched });
      unbatchedLeft -= slicePlan.fromUnbatched;

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
        data: { medicineId, dispensedQuantity: item.quantity, fulfillmentStatus: "DISPENSED", fulfillmentNote: null },
      });
      dispensedLines += 1;
    }
    return { shortage: null, dispensedLines };
  }
}

export default new PharmacyDispenseService();
