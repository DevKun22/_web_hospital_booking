import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { desiredMedicineLine, diffMedicineLines, type BillableItem } from "../utils/medicineBilling.js";
import { generateInvoiceCode } from "../utils/invoiceCode.js";
import { normalizeOptionalString } from "../utils/text.js";
import { generateUniqueCode } from "../utils/uniqueCode.js";
import AuditLogService from "./auditLog.service.js";
import PatientEventNotificationService from "./patientEventNotification.service.js";
import StaffNotificationService from "./staffNotification.service.js";
import { billableItemSelect, invoiceSelect, type InvoiceActor, type PayInvoiceInput } from "./invoice.shared.js";

// Tiền thuốc trên hóa đơn: đồng bộ từ đơn thuốc, hóa đơn bổ sung thu tại quầy, điều kiện cấp thuốc và hoàn tiền thuốc không
// được cấp. Hóa đơn chính (lập, thu, hủy, hoàn tiền toàn phần) nằm ở invoice.service.ts.
class InvoiceMedicineService {
  /** Đồng bộ tiền thuốc của mọi đơn đã phát hành của một lịch (gọi sau khi hóa đơn được thanh toán). */
  async syncAppointmentMedicine(appointmentId: string, actor?: InvoiceActor) {
    const prescriptions = await prisma.prescription.findMany({
      where: { appointmentId, status: "ISSUED" },
      orderBy: { issuedAt: "asc" },
      select: { id: true },
    });
    for (const prescription of prescriptions) {
      await this.syncMedicineLines(prescription.id, actor);
    }
  }

  /**
   * Đồng bộ dòng tiền thuốc của một đơn vào hóa đơn của lịch: thêm dòng còn thiếu, chỉnh số lượng, gỡ dòng đã hết
   * hàng hoặc người khám tự mua. Mỗi dòng hóa đơn gắn với một dòng đơn nên gọi lại nhiều lần không tính tiền hai
   * lần. Gọi lúc phát hành đơn và lúc dược sĩ cấp thuốc.
   * Hóa đơn đã thanh toán, đã hủy hoặc đang có giao dịch trực tuyến chờ thì không sửa được: nếu có chênh lệch thì
   * báo nhân viên tiếp nhận xử lý. Chưa có hóa đơn thì không làm gì, tiền thuốc sẽ được tính khi lập hóa đơn.
   */
  async syncMedicineLines(prescriptionId: string, actor?: InvoiceActor) {
    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      select: { id: true, status: true, appointmentId: true, prescriptionCode: true, items: { orderBy: { sortOrder: "asc" }, select: billableItemSelect } },
    });
    if (!prescription) return { outcome: "NO_PRESCRIPTION" as const, amount: 0 };
    const invoiceRef = await prisma.invoice.findUnique({
      where: { appointmentId: prescription.appointmentId },
      select: { id: true, invoiceCode: true, patientId: true },
    });
    if (!invoiceRef) return { outcome: "NO_INVOICE" as const, amount: 0 };
    // Đơn đã hủy thì không còn dòng nào cần tính tiền.
    const items: BillableItem[] = prescription.status === "ISSUED" ? prescription.items : [];

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceRef.id} FOR UPDATE`);
      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: invoiceRef.id },
        select: {
          status: true,
          totalAmount: true,
          finalAmount: true,
          items: { select: { id: true, sortOrder: true, quantity: true, unitPrice: true, prescriptionItemId: true } },
        },
      });
      const itemIds = new Set(prescription.items.map((item) => item.id));
      const existing = invoice.items
        .filter((line) => line.prescriptionItemId && itemIds.has(line.prescriptionItemId))
        .map((line) => ({ id: line.id, prescriptionItemId: line.prescriptionItemId as string, quantity: line.quantity, unitPrice: line.unitPrice }));
      const diff = diffMedicineLines(items, existing);
      if (invoice.status === "PAID") {
        // Hóa đơn đã thu thì không sửa: tiền thuốc mới thành hóa đơn bổ sung thu tại quầy; dòng đã thu mà nay không cấp thì
        // báo hoàn tiền (đã có luồng ghi nhận hoàn tiền thuốc).
        const supplement = await this.syncSupplement(tx, invoiceRef.id, prescription.items, items);
        const blockedDelta = diff.remove.reduce((sum, line) => sum - line.amount, 0) + diff.update.reduce((sum, line) => sum + line.amount, 0);
        if (diff.remove.length > 0 || diff.update.length > 0) return { outcome: "BLOCKED" as const, delta: blockedDelta, supplementCode: supplement.createdCode };
        return supplement.changed
          ? { outcome: "SUPPLEMENT" as const, delta: supplement.delta, supplementCode: supplement.createdCode }
          : { outcome: "NO_CHANGE" as const, delta: 0 };
      }
      if (diff.add.length === 0 && diff.update.length === 0 && diff.remove.length === 0) {
        return { outcome: "NO_CHANGE" as const, delta: 0 };
      }
      if (invoice.status !== "UNPAID") return { outcome: "BLOCKED" as const, delta: diff.delta };
      const pendingPayment = await tx.paymentTransaction.count({
        where: { invoiceId: invoiceRef.id, OR: [{ status: "PENDING" }, { status: "EXPIRED", provider: "VNPAY" }] },
      });
      if (pendingPayment > 0) return { outcome: "BLOCKED" as const, delta: diff.delta };

      await this.applyMedicineDiff(tx, {
        invoiceId: invoiceRef.id,
        appointmentId: prescription.appointmentId,
        prescriptionId,
        invoice,
        diff,
        actor,
      });
      return { outcome: "SYNCED" as const, delta: diff.delta };
    });

    await this.notifyMedicineSync(result, prescription, invoiceRef);
    return { outcome: result.outcome, amount: result.delta };
  }


  /** Ghi chênh lệch dòng thuốc vào hóa đơn chưa thanh toán (gọi trong giao dịch đã khóa hóa đơn). */
  private async applyMedicineDiff(
    tx: Prisma.TransactionClient,
    params: {
      invoiceId: string;
      appointmentId: string;
      prescriptionId: string;
      invoice: { totalAmount: number; finalAmount: number; items: { sortOrder: number }[] };
      diff: ReturnType<typeof diffMedicineLines>;
      actor?: InvoiceActor;
    },
  ) {
    const { invoiceId, appointmentId, prescriptionId, invoice, diff, actor } = params;
    let nextOrder = Math.max(-1, ...invoice.items.map((line) => line.sortOrder)) + 1;
    if (diff.add.length > 0) {
      await tx.invoiceItem.createMany({
        data: diff.add.map((line) => ({
          invoiceId: invoiceId,
          type: "MEDICINE" as const,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          amount: line.amount,
          sortOrder: nextOrder++,
          prescriptionItemId: line.prescriptionItemId,
        })),
      });
    }
    for (const line of diff.update) {
      await tx.invoiceItem.update({ where: { id: line.id }, data: { quantity: line.quantity, amount: line.amount } });
    }
    if (diff.remove.length > 0) {
      await tx.invoiceItem.deleteMany({ where: { id: { in: diff.remove.map((line) => line.id) } } });
    }
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { totalAmount: invoice.totalAmount + diff.delta, finalAmount: invoice.finalAmount + diff.delta },
    });
    await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        finalAmount: invoice.finalAmount + diff.delta,
        logs: { create: { action: "INVOICE_CREATED", note: "Đã cập nhật tiền thuốc trong hóa đơn", createdById: actor?.userId } },
      },
    });
    await AuditLogService.record(
      {
        actor: actor ? { userId: actor.userId, role: actor.role } : null,
        action: "INVOICE_ADJUSTED",
        targetType: "INVOICE",
        targetId: invoiceId,
        meta: {
          reason: "MEDICINE_SYNC",
          prescriptionId,
          before: { finalAmount: invoice.finalAmount },
          after: { finalAmount: invoice.finalAmount + diff.delta },
        },
      },
      tx,
    );
  }

  /** Báo nhân viên khi tiền thuốc phát sinh hóa đơn bổ sung hoặc không sửa được hóa đơn. */
  private async notifyMedicineSync(
    result: { outcome: string; delta?: number; supplementCode?: string | null },
    prescription: { id: string; prescriptionCode: string },
    invoiceRef: { id: string; invoiceCode: string },
  ) {
    const prescriptionId = prescription.id;
    const delta = result.delta ?? 0;
    if (result.outcome === "SUPPLEMENT" && "supplementCode" in result && result.supplementCode) {
      await StaffNotificationService.notifyRoles(["STAFF", "ADMIN"], {
        type: "INVOICE_CREATED",
        title: "Có hóa đơn bổ sung tiền thuốc cần thu",
        body: `Đơn ${prescription.prescriptionCode} phát hành sau khi hóa đơn ${invoiceRef.invoiceCode} đã thanh toán. Hóa đơn bổ sung ${result.supplementCode} (${Math.abs(delta).toLocaleString("vi-VN")} đ) cần thu trước khi dược sĩ cấp thuốc.`,
        entityType: "INVOICE",
        entityId: invoiceRef.id,
        eventKey: `invoice:${invoiceRef.id}:supplement:${result.supplementCode}`,
      });
    }
    if (result.outcome === "BLOCKED") {
      await StaffNotificationService.notifyRoles(["STAFF", "ADMIN"], {
        type: "INVOICE_CREATED",
        title: "Tiền thuốc chưa tính vào hóa đơn",
        body: `Đơn ${prescription.prescriptionCode} có thay đổi tiền thuốc (${Math.abs(delta).toLocaleString("vi-VN")} đ) nhưng hóa đơn ${invoiceRef.invoiceCode} không còn sửa được. ${delta < 0 ? "Thuốc không được cấp: quản trị viên ghi nhận hoàn tiền thuốc ở chi tiết hóa đơn sau khi hoàn tiền cho người khám." : "Tiền thuốc sẽ được tính thành hóa đơn bổ sung khi hóa đơn này được thanh toán."}`,
        entityType: "INVOICE",
        entityId: invoiceRef.id,
        eventKey: `invoice:${invoiceRef.id}:medicine-blocked:${prescriptionId}:${delta}`,
      });
    }
  }

  // ---- Hóa đơn bổ sung tiền thuốc ----------------------------------------------------------------------------

  /**
   * Đồng bộ hóa đơn bổ sung của một hóa đơn đã thanh toán (gọi trong giao dịch đã khóa hóa đơn). Dòng thuốc cần tính
   * tiền mà chưa có trên hóa đơn chính hay hóa đơn bổ sung nào thì vào hóa đơn bổ sung chưa thu (tạo mới nếu chưa có);
   * dòng trên hóa đơn bổ sung chưa thu mà nay không cấp nữa thì gỡ ra. Hóa đơn bổ sung đã thu không sửa.
   */
  private async syncSupplement(
    tx: Prisma.TransactionClient,
    invoiceId: string,
    allItems: BillableItem[],
    wantedItems: BillableItem[],
  ) {
    const itemIds = new Set(allItems.map((item) => item.id));
    const mainLines = await tx.invoiceItem.findMany({
      where: { invoiceId, prescriptionItemId: { in: [...itemIds] } },
      select: { prescriptionItemId: true },
    });
    const onMain = new Set(mainLines.map((line) => line.prescriptionItemId as string));
    const supplementLines = await tx.invoiceSupplementItem.findMany({
      where: { prescriptionItemId: { in: [...itemIds] }, supplement: { invoiceId, status: { not: "CANCELLED" } } },
      select: { id: true, supplementId: true, prescriptionItemId: true, amount: true, supplement: { select: { status: true } } },
    });
    const onSupplement = new Map(supplementLines.map((line) => [line.prescriptionItemId, line]));

    const toAdd: NonNullable<ReturnType<typeof desiredMedicineLine>>[] = [];
    const wantedIds = new Set<string>();
    for (const item of wantedItems) {
      const line = desiredMedicineLine(item);
      if (!line) continue;
      wantedIds.add(item.id);
      if (!onMain.has(item.id) && !onSupplement.has(item.id)) toAdd.push(line);
    }
    // Dòng trên hóa đơn bổ sung chưa thu mà không còn cần tính tiền.
    const toRemove = supplementLines.filter((line) => line.supplement.status === "UNPAID" && !wantedIds.has(line.prescriptionItemId));
    if (toAdd.length === 0 && toRemove.length === 0) return { changed: false, delta: 0, createdCode: null as string | null };

    let target = await tx.invoiceSupplement.findFirst({
      where: { invoiceId, status: "UNPAID" },
      orderBy: { createdAt: "asc" },
      select: { id: true, supplementCode: true, amount: true },
    });
    let createdCode: string | null = null;
    if (!target && toAdd.length > 0) {
      const supplementCode = await this.generateUniqueSupplementCode(tx);
      target = await tx.invoiceSupplement.create({ data: { supplementCode, invoiceId, amount: 0 }, select: { id: true, supplementCode: true, amount: true } });
      createdCode = supplementCode;
    }
    let delta = 0;
    if (target) {
      if (toRemove.length > 0) {
        await tx.invoiceSupplementItem.deleteMany({ where: { id: { in: toRemove.map((line) => line.id) } } });
        delta -= toRemove.reduce((sum, line) => sum + line.amount, 0);
      }
      if (toAdd.length > 0) {
        await tx.invoiceSupplementItem.createMany({
          data: toAdd.map((line) => ({
            supplementId: target!.id,
            prescriptionItemId: line.prescriptionItemId,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            amount: line.amount,
          })),
        });
        delta += toAdd.reduce((sum, line) => sum + line.amount, 0);
      }
      const amount = target.amount + delta;
      await tx.invoiceSupplement.update({
        where: { id: target.id },
        data: { amount, status: amount <= 0 ? "CANCELLED" : "UNPAID" },
      });
    }
    return { changed: true, delta, createdCode: createdCode ?? (target && toAdd.length > 0 ? target.supplementCode : null) };
  }

  /** Thu tại quầy một hóa đơn bổ sung tiền thuốc. Không thu qua cổng online. */
  async paySupplement(invoiceId: string, supplementId: string, input: PayInvoiceInput, actorId?: string) {
    if (input.paymentMethod === "VNPAY") {
      throw new AppError("Hóa đơn bổ sung chỉ thu tại quầy", 400, "SUPPLEMENT_ONLINE_NOT_SUPPORTED");
    }
    const paymentReference = normalizeOptionalString(input.paymentReference);
    if (["CARD", "BANK_TRANSFER"].includes(input.paymentMethod) && !paymentReference) {
      throw new AppError("Vui lòng nhập mã tham chiếu cho thanh toán thẻ hoặc chuyển khoản", 400, "PAYMENT_REFERENCE_REQUIRED");
    }
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`);
      const supplement = await tx.invoiceSupplement.findFirst({
        where: { id: supplementId, invoiceId },
        select: { id: true, status: true, supplementCode: true, amount: true, invoice: { select: { appointmentId: true, status: true } } },
      });
      if (!supplement) throw new AppError("Không tìm thấy hóa đơn bổ sung", 404);
      if (supplement.status !== "UNPAID" || supplement.invoice.status !== "PAID") {
        throw new AppError("Hóa đơn bổ sung đã được xử lý ở thao tác khác. Vui lòng tải lại dữ liệu.", 409, "INVOICE_STATE_CONFLICT");
      }
      const claimed = await tx.invoiceSupplement.updateMany({
        where: { id: supplementId, status: "UNPAID" },
        data: { status: "PAID", paymentMethod: input.paymentMethod, paymentReference, paidAt: new Date(), collectedById: actorId },
      });
      if (claimed.count !== 1) {
        throw new AppError("Hóa đơn bổ sung đã được xử lý ở thao tác khác. Vui lòng tải lại dữ liệu.", 409, "INVOICE_STATE_CONFLICT");
      }
      await tx.appointmentLog.create({
        data: {
          appointmentId: supplement.invoice.appointmentId,
          action: "PAYMENT_RECORDED",
          note: `Đã thu hóa đơn bổ sung tiền thuốc ${supplement.supplementCode} (${input.paymentMethod}${paymentReference ? ` · ${paymentReference}` : ""})`,
          createdById: actorId,
        },
      });
      await AuditLogService.record(
        {
          actor: actorId ? { userId: actorId, role: "STAFF" } : null,
          action: "INVOICE_ADJUSTED",
          targetType: "INVOICE",
          targetId: invoiceId,
          meta: { reason: "SUPPLEMENT_PAID", supplementCode: supplement.supplementCode, amount: supplement.amount, paymentMethod: input.paymentMethod, paymentReference },
        },
        tx,
      );
      return tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: invoiceSelect });
    });
  }

  private generateUniqueSupplementCode(tx: Prisma.TransactionClient) {
    return generateUniqueCode(
      () => `BS${generateInvoiceCode().replace(/^INV/, "")}`,
      async (supplementCode) => Boolean(await tx.invoiceSupplement.findUnique({ where: { supplementCode }, select: { id: true } })),
      "Không thể tạo mã hóa đơn bổ sung",
    );
  }

  // ---- Hoàn tiền thuốc một phần ------------------------------------------------------------------------------

  // Dòng tiền thuốc của hóa đơn đã thanh toán mà thuốc không được cấp (kho hết hàng hoặc người khám tự mua) và
  // chưa hoàn. Chỉ dòng gắn dòng đơn thuốc mới có thể thuộc nhóm này.
  private async refundableMedicineLines(
    client: Prisma.TransactionClient | typeof prisma,
    invoiceId: string,
  ) {
    const lines = await client.invoiceItem.findMany({
      where: { invoiceId, type: "MEDICINE", prescriptionItemId: { not: null }, refundedAt: null },
      orderBy: { sortOrder: "asc" },
      select: { id: true, description: true, amount: true, prescriptionItemId: true },
    });
    if (lines.length === 0) return [];
    const items = await client.prescriptionItem.findMany({
      where: { id: { in: lines.map((line) => line.prescriptionItemId as string) } },
      select: { id: true, fulfillmentStatus: true, fulfillmentNote: true },
    });
    const notDelivered = new Map(
      items.filter((item) => item.fulfillmentStatus === "OUTSIDE" || item.fulfillmentStatus === "OUT_OF_STOCK").map((item) => [item.id, item]),
    );
    return lines
      .filter((line) => notDelivered.has(line.prescriptionItemId as string))
      .map((line) => ({
        id: line.id,
        description: line.description,
        amount: line.amount,
        reason: notDelivered.get(line.prescriptionItemId as string)?.fulfillmentStatus as "OUTSIDE" | "OUT_OF_STOCK",
      }));
  }

  /** Các dòng tiền thuốc đang chờ hoàn của một hóa đơn đã thanh toán, kèm tổng tiền. */
  async listRefundableMedicine(invoiceId: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, status: true, paymentMethod: true, refundedAmount: true },
    });
    if (!invoice) throw new AppError("Không tìm thấy hóa đơn", 404);
    const lines = invoice.status === "PAID" ? await this.refundableMedicineLines(prisma, invoiceId) : [];
    return {
      status: invoice.status,
      paymentMethod: invoice.paymentMethod,
      refundedAmount: invoice.refundedAmount,
      lines,
      total: lines.reduce((sum, line) => sum + line.amount, 0),
    };
  }

  /**
   * Ghi nhận đã hoàn tiền các dòng thuốc không được cấp của hóa đơn đã thanh toán. Tiền được hoàn ở cổng thanh
   * toán hoặc bằng tiền mặt (hệ thống không tự gọi VNPAY cho hoàn một phần); đây chỉ là sổ đối soát. Hóa đơn
   * vẫn PAID, refundedAmount tăng đúng bằng tiền các dòng được hoàn. Thanh toán VNPAY cần mã tham chiếu hoàn tiền.
   */
  async recordMedicineRefund(
    id: string,
    input: { refundReference?: string | null; note?: string | null },
    actor: { userId: string; role: string },
    ipAddress?: string,
  ) {
    const reference = normalizeOptionalString(input.refundReference);
    const note = normalizeOptionalString(input.note);
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${id} FOR UPDATE`);
      const invoice = await tx.invoice.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          paymentMethod: true,
          invoiceCode: true,
          patientId: true,
          refundedAmount: true,
          appointment: { select: { bookingCode: true } },
        },
      });
      if (!invoice) throw new AppError("Không tìm thấy hóa đơn", 404);
      if (invoice.status !== "PAID") {
        throw new AppError("Chỉ ghi nhận hoàn tiền thuốc cho hóa đơn đã thanh toán", 409, "INVOICE_STATE_CONFLICT");
      }
      const lines = await this.refundableMedicineLines(tx, id);
      if (lines.length === 0) {
        throw new AppError("Không có dòng tiền thuốc nào cần hoàn", 409, "NO_REFUNDABLE_MEDICINE");
      }
      if (invoice.paymentMethod === "VNPAY" && !reference) {
        throw new AppError(
          "Cần mã tham chiếu hoàn tiền từ cổng thanh toán trước khi ghi nhận",
          400,
          "REFUND_REFERENCE_REQUIRED",
        );
      }
      const total = lines.reduce((sum, line) => sum + line.amount, 0);
      const refundedAt = new Date();
      await tx.invoiceItem.updateMany({
        where: { id: { in: lines.map((line) => line.id) } },
        data: { refundedAt, refundReference: reference },
      });
      const refundedAmount = invoice.refundedAmount + total;
      await tx.invoice.update({ where: { id }, data: { refundedAmount } });
      await tx.appointment.update({
        where: { id: (await tx.invoice.findUniqueOrThrow({ where: { id }, select: { appointmentId: true } })).appointmentId },
        data: { logs: { create: { action: "INVOICE_CREATED", note: "Đã hoàn tiền thuốc một phần", createdById: actor.userId } } },
      });
      await AuditLogService.record(
        {
          actor: { userId: actor.userId, role: actor.role },
          action: "INVOICE_ADJUSTED",
          targetType: "INVOICE",
          targetId: id,
          ipAddress,
          meta: {
            reason: "MEDICINE_REFUND",
            amount: total,
            lines: lines.map((line) => ({ id: line.id, amount: line.amount, reason: line.reason })),
            refundReference: reference,
            note,
            paymentMethod: invoice.paymentMethod,
          },
        },
        tx,
      );
      await PatientEventNotificationService.createMedicineRefunded(
        {
          userId: invoice.patientId,
          invoiceId: invoice.id,
          invoiceCode: invoice.invoiceCode,
          bookingCode: invoice.appointment.bookingCode,
          finalAmount: total,
          refundedTotal: refundedAmount,
        },
        tx,
      );
      return { total, refundedAmount, lines };
    });
    return result;
  }

  /**
   * Hóa đơn đã "phủ" tiền thuốc của đơn chưa: có hóa đơn đã thanh toán và mọi dòng thuốc sắp cấp đều đã có dòng
   * tiền trên hóa đơn đó hoặc trên hóa đơn bổ sung đã thu. Dùng để chặn cấp thuốc khi chưa thu tiền. billableAmount = 0 (thuốc miễn phí hoặc
   * ngoài danh mục) thì không cần hóa đơn. `excludeItemIds` là các dòng sẽ không cấp (hết hàng, tự mua).
   */
  async medicineCoverage(prescriptionId: string, excludeItemIds: string[] = []) {
    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      select: { appointmentId: true, items: { orderBy: { sortOrder: "asc" }, select: billableItemSelect } },
    });
    if (!prescription) return { billableAmount: 0, invoiceStatus: null, covered: true };
    const excluded = new Set(excludeItemIds);
    const wanted = prescription.items
      .filter((item) => !excluded.has(item.id) && item.fulfillmentStatus === "PENDING")
      .map((item) => desiredMedicineLine(item))
      .filter((line): line is NonNullable<typeof line> => line !== null);
    const billableAmount = wanted.reduce((sum, line) => sum + line.amount, 0);
    if (billableAmount <= 0) return { billableAmount: 0, invoiceStatus: null, covered: true };

    const invoice = await prisma.invoice.findUnique({
      where: { appointmentId: prescription.appointmentId },
      select: {
        status: true,
        items: { select: { prescriptionItemId: true } },
        supplements: { where: { status: "PAID" }, select: { items: { select: { prescriptionItemId: true } } } },
      },
    });
    if (!invoice) return { billableAmount, invoiceStatus: null, covered: false };
    const linked = new Set([
      ...invoice.items.map((line) => line.prescriptionItemId),
      ...invoice.supplements.flatMap((supplement) => supplement.items.map((line) => line.prescriptionItemId)),
    ].filter(Boolean));
    const allLinked = wanted.every((line) => linked.has(line.prescriptionItemId));
    return { billableAmount, invoiceStatus: invoice.status, covered: invoice.status === "PAID" && allLinked };
  }
}

export default new InvoiceMedicineService();
