import { Prisma } from "../../generated/prisma/client.js";
import { writeAppointmentLog } from "./appointmentLog.service.js";
import type { InvoiceStatus, PaymentMethod } from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { getReminderDispatchConcurrency } from "../config/environment.js";
import { AppError } from "../utils/appError.js";
import { mapWithConcurrency } from "../utils/concurrency.js";
import { desiredMedicineLine } from "../utils/medicineBilling.js";
import { CODE_PREFIX, generateDatedCode } from "../utils/datedCode.js";
import AuditLogService from "./auditLog.service.js";
import MedicalRecordService from "./medicalRecord.service.js";
import PatientEventNotificationService from "./patientEventNotification.service.js";
import { normalizeOptionalString } from "../utils/text.js";
import { generateUniqueCode } from "../utils/uniqueCode.js";
import { logger } from "../observability/logger.js";
import InvoiceMedicineService from "./invoiceMedicine.service.js";
import { buildInvoiceItems, calculateInsurance, type InsuranceInput } from "../utils/invoiceBilling.js";
import { billableItemSelect, invoiceSelect, type InvoiceActor, type PayInvoiceInput } from "./invoice.shared.js";

class InvoiceService {
  async list(query: {
    status?: InvoiceStatus;
    paymentMethod?: PaymentMethod;
    patientId?: string;
    appointmentId?: string;
    invoiceCode?: string;
    barcode?: string;
    phone?: string;
    /** Tìm gần đúng theo mã hóa đơn, mã vạch, mã lịch, số điện thoại hoặc tên người khám. */
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;
    const searchTerm = query.q?.trim() || undefined;

    const where: Prisma.InvoiceWhereInput = {
      status: query.status,
      paymentMethod: query.paymentMethod,
      patientId: query.patientId,
      appointmentId: query.appointmentId,
      invoiceCode: query.invoiceCode,
      barcode: query.barcode,
      AND: searchTerm
        ? [
            {
              OR: [
                { invoiceCode: { contains: searchTerm, mode: "insensitive" as const } },
                { barcode: { contains: searchTerm, mode: "insensitive" as const } },
                { appointment: { is: { OR: [{ bookingCode: { contains: searchTerm, mode: "insensitive" as const } }, { patientPhone: { contains: searchTerm, mode: "insensitive" as const } }, { patientName: { contains: searchTerm, mode: "insensitive" as const } }] } } },
              ],
            },
          ]
        : undefined,
      appointment: query.phone
        ? {
            patientPhone: {
              contains: query.phone,
            },
          }
        : undefined,
    };

    const [items, total] = await prisma.$transaction([
      prisma.invoice.findMany({
        where,
        select: invoiceSelect,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where }),
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

  async getById(id: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: invoiceSelect,
    });

    if (!invoice) {
      throw new AppError("Không tìm thấy hóa đơn", 404);
    }

    return invoice;
  }

  async createForAppointment(
    appointmentIdOrCode: string,
    input: InsuranceInput,
  ) {
    const normalizedAppointmentKey = appointmentIdOrCode.trim();
    const appointment = await prisma.appointment.findFirst({
      where: {
        OR: [
          { id: normalizedAppointmentKey },
          { bookingCode: normalizedAppointmentKey.toUpperCase() },
        ],
      },
      select: {
        id: true,
        bookingCode: true,
        status: true,
        patientId: true,
        patientInfo: { select: { hasBHYT: true } },
        estimatedPrice: true,
        serviceFee: true,
        bhytDiscount: true,
        package: {
          select: {
            name: true,
            isBHYTSupport: true,
          },
        },
        department: {
          select: {
            name: true,
          },
        },
        invoice: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new AppError("Không tìm thấy lịch hẹn", 404);
    }

    if (appointment.status !== "COMPLETED") {
      throw new AppError(
        "Chỉ có thể tạo hóa đơn cho lịch đã hoàn thành khám",
        400,
      );
    }

    if (appointment.invoice) {
      throw new AppError(
        "Lịch hẹn này đã có hóa đơn",
        409,
        "INVOICE_ALREADY_EXISTS",
      );
    }

    const invoiceItems = buildInvoiceItems(appointment);
    // Tiền thuốc của các đơn đã phát hành của lịch này (đã cấp thì theo số lượng thực cấp, chưa cấp thì theo số kê).
    const prescribed = await prisma.prescriptionItem.findMany({
      where: { prescription: { appointmentId: appointment.id, status: "ISSUED" }, medicineId: { not: null } },
      orderBy: [{ prescription: { issuedAt: "asc" } }, { sortOrder: "asc" }],
      select: billableItemSelect,
    });
    for (const item of prescribed) {
      const line = desiredMedicineLine(item);
      if (line) invoiceItems.push({ type: "MEDICINE", sortOrder: invoiceItems.length, ...line });
    }
    const totalAmount = invoiceItems.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    const insurance = calculateInsurance(
      input,
      totalAmount,
      { hasBHYT: appointment.patientInfo?.hasBHYT ?? false, package: appointment.package },
      appointment.bhytDiscount,
    );

    let transition: {
      createdInvoice: Prisma.InvoiceGetPayload<{ select: typeof invoiceSelect }>;
      notificationId: string;
    };

    try {
      transition = await prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.create({
          data: {
            invoiceCode: await this.generateUniqueInvoiceCode(tx),
            barcode: await this.generateUniqueBarcode(tx),
            appointmentId: appointment.id,
            patientId: appointment.patientId,
            totalAmount,
            bhytDiscount: insurance.bhytDiscount,
            finalAmount: insurance.finalAmount,
            insuranceEligibleAmount: insurance.insuranceEligibleAmount,
            insuranceCoverageRate: insurance.insuranceCoverageRate,
            insuranceRouteType: insurance.insuranceRouteType,
            insuranceNote: insurance.insuranceNote,
            status: "UNPAID",
            items: {
              create: invoiceItems,
            },
          },
          select: {
            id: true,
          },
        });

        await tx.appointment.update({
          where: {
            id: appointment.id,
          },
          data: {
            bhytDiscount: insurance.bhytDiscount,
            finalAmount: insurance.finalAmount,
          },
        });
        await writeAppointmentLog(tx, {
          appointmentId: appointment.id,
          action: "INVOICE_CREATED",
          note: "Hóa đơn đã được tạo",
        });

        const createdInvoice = await tx.invoice.findUniqueOrThrow({
          where: {
            id: invoice.id,
          },
          select: invoiceSelect,
        });
        const notification =
          await PatientEventNotificationService.createInvoiceCreated(
            {
              userId: appointment.patientId,
              invoiceId: createdInvoice.id,
              invoiceCode: createdInvoice.invoiceCode,
              bookingCode: appointment.bookingCode,
              finalAmount: createdInvoice.finalAmount,
            },
            tx,
          );

        return { createdInvoice, notificationId: notification.id };
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        const existingInvoice = await prisma.invoice.findUnique({
          where: { appointmentId: appointment.id },
          select: { id: true },
        });

        if (existingInvoice) {
          throw new AppError(
            "Lịch hẹn này vừa được phát hành hóa đơn bởi một thao tác khác",
            409,
            "INVOICE_ALREADY_EXISTS",
          );
        }
      }
      throw error;
    }

    return transition.createdInvoice;
  }

  async updateFinancials(
    id: string,
    input: InsuranceInput,
    actor?: InvoiceActor,
    ipAddress?: string,
  ) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        bhytDiscount: true,
        finalAmount: true,
        appointment: {
          select: {
            id: true,
            patientInfo: { select: { hasBHYT: true } },
            package: {
              select: {
                isBHYTSupport: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new AppError("Không tìm thấy hóa đơn", 404);
    }

    if (!["UNPAID", "CANCELLED"].includes(invoice.status)) {
      throw new AppError(
        "Chỉ có thể chỉnh sửa hóa đơn chưa thanh toán hoặc đã hủy",
        400,
      );
    }

    const insurance = calculateInsurance(
      input,
      invoice.totalAmount,
      { hasBHYT: invoice.appointment.patientInfo?.hasBHYT ?? false, package: invoice.appointment.package },
      invoice.bhytDiscount,
    );

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${id} FOR UPDATE`);
      const currentInvoice = await tx.invoice.findUniqueOrThrow({
        where: { id },
        select: { status: true },
      });
      if (!["UNPAID", "CANCELLED"].includes(currentInvoice.status)) {
        throw new AppError(
          "Hóa đơn đã được xử lý ở thao tác khác. Vui lòng tải lại dữ liệu.",
          409,
          "INVOICE_STATE_CONFLICT",
        );
      }
      if (currentInvoice.status === "UNPAID") {
        const pendingPayment = await tx.paymentTransaction.count({
          where: {
            invoiceId: id,
            OR: [
              { status: "PENDING" },
              { status: "EXPIRED", provider: "VNPAY" },
            ],
          },
        });
        if (pendingPayment > 0) {
          throw new AppError(
            "Không thể điều chỉnh hóa đơn khi còn giao dịch trực tuyến đang chờ",
            409,
            "ONLINE_PAYMENT_PENDING",
          );
        }
      }
      await tx.appointment.update({
        where: {
          id: invoice.appointment.id,
        },
        data: {
          bhytDiscount: insurance.bhytDiscount,
          finalAmount: insurance.finalAmount,
        },
      });
      await writeAppointmentLog(tx, {
        appointmentId: invoice.appointment.id,
        action: "INVOICE_CREATED",
        note:
          currentInvoice.status === "CANCELLED"
            ? "Hóa đơn đã được điều chỉnh và mở lại"
            : "Hóa đơn đã được điều chỉnh",
      });

      const updated = await tx.invoice.updateMany({
        where: { id, status: currentInvoice.status },
        data: {
          status: "UNPAID",
          bhytDiscount: insurance.bhytDiscount,
          finalAmount: insurance.finalAmount,
          insuranceEligibleAmount: insurance.insuranceEligibleAmount,
          insuranceCoverageRate: insurance.insuranceCoverageRate,
          insuranceRouteType: insurance.insuranceRouteType,
          insuranceNote: insurance.insuranceNote,
        },
      });
      if (updated.count !== 1) {
        throw new AppError("Trạng thái hóa đơn đã thay đổi", 409, "INVOICE_STATE_CONFLICT");
      }
      // Người chỉnh giảm cũng có thể là người thu tiền, nên mọi lần đổi số tiền phải lưu giá
      // trị trước và sau để đối chiếu.
      await AuditLogService.record(
        {
          actor,
          action: "INVOICE_ADJUSTED",
          targetType: "INVOICE",
          targetId: id,
          ipAddress,
          meta: {
            reopened: currentInvoice.status === "CANCELLED",
            before: { discount: invoice.bhytDiscount, finalAmount: invoice.finalAmount },
            after: { discount: insurance.bhytDiscount, finalAmount: insurance.finalAmount },
          },
        },
        tx,
      );
      return tx.invoice.findUniqueOrThrow({ where: { id }, select: invoiceSelect });
    });
  }

  async pay(id: string, input: PayInvoiceInput, actorId?: string) {
    if (input.paymentMethod === "VNPAY") {
      throw new AppError(
        "VNPAY phải thanh toán qua API online payment",
        400,
      );
    }

    const transition = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${id} FOR UPDATE`);
      const invoice = await tx.invoice.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          invoiceCode: true,
          finalAmount: true,
          patientId: true,
          appointmentId: true,
          appointment: { select: { bookingCode: true } },
        },
      });
      if (!invoice) throw new AppError("Không tìm thấy hóa đơn", 404);
      if (invoice.status !== "UNPAID") {
        throw new AppError(
          "Hóa đơn đã được xử lý ở thao tác khác. Vui lòng tải lại dữ liệu.",
          409,
          "INVOICE_STATE_CONFLICT",
        );
      }

      const now = new Date();
      await tx.paymentTransaction.updateMany({
        where: { invoiceId: id, status: "PENDING", expiredAt: { lte: now } },
        data: { status: "EXPIRED", activeKey: null },
      });
      const pendingOnlinePayment = await tx.paymentTransaction.findFirst({
        where: {
          invoiceId: id,
          OR: [
            { status: "PENDING" },
            { status: "EXPIRED", provider: "VNPAY" },
          ],
        },
        select: { provider: true, transactionCode: true, expiredAt: true },
      });
      if (pendingOnlinePayment) {
        throw new AppError(
          `Hóa đơn đang chờ đối soát giao dịch ${pendingOnlinePayment.provider} ${pendingOnlinePayment.transactionCode}. Chỉ thu tại quầy sau khi giao dịch đã có kết quả cuối cùng.`,
          409,
          "ONLINE_PAYMENT_PENDING",
        );
      }

      const paymentReference = normalizeOptionalString(input.paymentReference);
      if (
        ["CARD", "BANK_TRANSFER"].includes(input.paymentMethod) &&
        !paymentReference
      ) {
        throw new AppError(
          "Vui lòng nhập mã tham chiếu cho thanh toán thẻ hoặc chuyển khoản",
          400,
          "PAYMENT_REFERENCE_REQUIRED",
        );
      }

      const claimed = await tx.invoice.updateMany({
        where: { id, status: "UNPAID" },
        data: {
          status: "PAID",
          paymentMethod: input.paymentMethod,
          paymentReference,
          paidAt: now,
        },
      });
      if (claimed.count !== 1) {
        throw new AppError(
          "Hóa đơn đã được xử lý ở thao tác khác. Vui lòng tải lại dữ liệu.",
          409,
          "INVOICE_STATE_CONFLICT",
        );
      }
      await writeAppointmentLog(tx, {
        appointmentId: invoice.appointmentId,
        action: "PAYMENT_RECORDED",
        note: `Đã ghi nhận thanh toán ${input.paymentMethod}${paymentReference ? ` · ${paymentReference}` : ""}`,
        actorId,
      });
      const paidInvoice = await tx.invoice.findUniqueOrThrow({
        where: { id },
        select: invoiceSelect,
      });
      const notification =
        await PatientEventNotificationService.createPaymentSucceeded(
          {
            userId: invoice.patientId,
            invoiceId: invoice.id,
            invoiceCode: invoice.invoiceCode,
            bookingCode: invoice.appointment.bookingCode,
            finalAmount: invoice.finalAmount,
          },
          tx,
        );

      return { paidInvoice, notificationId: notification.id };
    });

    await this.afterPaid(transition.paidInvoice.appointment.id, actorId ? { userId: actorId, role: "STAFF" } : undefined);
    return transition.paidInvoice;
  }

  /**
   * Việc tự động sau khi hóa đơn được thu (tiền mặt hoặc VNPay), mỗi việc độc lập và không làm hỏng việc thu tiền:
   * đơn phát hành lúc hóa đơn còn chờ thì nay tính thành hóa đơn bổ sung; hồ sơ đủ điều kiện thì tự công bố.
   */
  async afterPaid(appointmentId: string, actor?: InvoiceActor) {
    await InvoiceMedicineService.syncAppointmentMedicine(appointmentId, actor).catch((error) => {
      logger.error("[INVOICE_MEDICINE] cannot sync medicines after payment:", error);
    });
    await MedicalRecordService.publishWhenReady(appointmentId).catch((error) => {
      logger.error("[AUTO_PUBLISH] cannot publish after payment:", error);
    });
  }

  /**
   * Nhắc người khám các hóa đơn chưa thanh toán sau 24 giờ (mỗi hóa đơn đúng một lần, khóa chống trùng theo hóa đơn).
   * Chỉ xét hóa đơn tạo trong 14 ngày gần đây để quét nhẹ; chạy định kỳ trong worker.
   */
  async sendPaymentReminders(options: { now?: Date; limit?: number } = {}) {
    const now = options.now ?? new Date();
    const olderThan = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const newerThan = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const candidates = await prisma.invoice.findMany({
      where: { status: "UNPAID", createdAt: { lte: olderThan, gte: newerThan } },
      orderBy: { createdAt: "asc" },
      take: Math.min(Math.max(options.limit ?? 50, 1), 200),
      select: {
        id: true,
        invoiceCode: true,
        finalAmount: true,
        patientId: true,
        appointment: { select: { bookingCode: true } },
      },
    });
    if (candidates.length === 0) return { scanned: 0, reminded: 0 };

    const already = new Set(
      (
        await prisma.notification.findMany({
          where: { dedupeKey: { in: candidates.map((item) => `invoice:${item.id}:reminder`) } },
          select: { dedupeKey: true },
        })
      ).map((item) => item.dedupeKey),
    );
    const results = await mapWithConcurrency(
      candidates,
      getReminderDispatchConcurrency(),
      async (invoice) => {
        if (already.has(`invoice:${invoice.id}:reminder`)) return false;
        try {
          await PatientEventNotificationService.createPaymentReminder(
              {
                userId: invoice.patientId,
                invoiceId: invoice.id,
                invoiceCode: invoice.invoiceCode,
                bookingCode: invoice.appointment.bookingCode,
                finalAmount: invoice.finalAmount,
              },
              prisma,
            );
          return true;
        } catch (error) {
          logger.error(`[INVOICE_REMINDER] invoice=${invoice.id} failed:`, error);
          return false;
        }
      },
    );
    const reminded = results.filter(Boolean).length;
    return { scanned: candidates.length, reminded };
  }

  async cancel(id: string, actorId?: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${id} FOR UPDATE`);
      const invoice = await tx.invoice.findUnique({
        where: { id },
        select: { status: true, appointmentId: true },
      });
      if (!invoice) throw new AppError("Không tìm thấy hóa đơn", 404);
      if (invoice.status !== "UNPAID") {
        throw new AppError("Chỉ có thể hủy hóa đơn chưa thanh toán", 409, "INVOICE_STATE_CONFLICT");
      }
      const pending = await tx.paymentTransaction.count({
        where: {
          invoiceId: id,
          OR: [
            { status: "PENDING" },
            { status: "EXPIRED", provider: "VNPAY" },
          ],
        },
      });
      if (pending > 0) {
        throw new AppError(
          "Không thể hủy hóa đơn khi còn giao dịch trực tuyến đang chờ",
          409,
          "ONLINE_PAYMENT_PENDING",
        );
      }
      const claimed = await tx.invoice.updateMany({
        where: { id, status: "UNPAID" },
        data: { status: "CANCELLED" },
      });
      if (claimed.count !== 1) throw new AppError("Trạng thái hóa đơn đã thay đổi", 409, "INVOICE_STATE_CONFLICT");
      await writeAppointmentLog(tx, {
        appointmentId: invoice.appointmentId,
        action: "INVOICE_CANCELLED",
        note: "Hóa đơn chưa thanh toán đã được hủy",
        actorId,
      });
      return tx.invoice.findUniqueOrThrow({ where: { id }, select: invoiceSelect });
    });
  }

  private generateUniqueInvoiceCode(tx: Prisma.TransactionClient) {
    return generateUniqueCode(
      () => generateDatedCode(CODE_PREFIX.invoice),
      async (invoiceCode) => Boolean(await tx.invoice.findUnique({ where: { invoiceCode }, select: { id: true } })),
      "Không thể tạo mã hóa đơn",
    );
  }

  private generateUniqueBarcode(tx: Prisma.TransactionClient) {
    return generateUniqueCode(
      () => generateDatedCode(CODE_PREFIX.invoiceBarcode, 9),
      async (barcode) => Boolean(await tx.invoice.findUnique({ where: { barcode }, select: { id: true } })),
      "Không thể tạo mã vạch hóa đơn",
    );
  }
}

export default new InvoiceService();
