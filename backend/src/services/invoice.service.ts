import { Prisma } from "../../generated/prisma/client.js";
import type {
  InsuranceRouteType,
  InvoiceStatus,
  PaymentMethod,
} from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import {
  generateInvoiceBarcode,
  generateInvoiceCode,
} from "../utils/invoiceCode.js";
import PatientEventNotificationService from "./patientEventNotification.service.js";

type CreateInvoiceInput = {
  bhytDiscount?: number;
  insuranceEligibleAmount?: number;
  insuranceCoverageRate?: number;
  insuranceRouteType?: InsuranceRouteType | null;
  insuranceNote?: string | null;
};

type UpdateInvoiceInput = {
  bhytDiscount?: number;
  insuranceEligibleAmount?: number;
  insuranceCoverageRate?: number;
  insuranceRouteType?: InsuranceRouteType | null;
  insuranceNote?: string | null;
};

type PayInvoiceInput = {
  paymentMethod: PaymentMethod;
  paymentReference?: string | null;
};

type RefundInvoiceInput = {
  refundReason: string;
  refundReference?: string | null;
};

type InsuranceCalculationInput = {
  bhytDiscount?: number;
  insuranceEligibleAmount?: number;
  insuranceCoverageRate?: number;
  insuranceRouteType?: InsuranceRouteType | null;
  insuranceNote?: string | null;
};

type InsuranceAppointmentPolicy = {
  hasBHYT: boolean;
  package: {
    isBHYTSupport: boolean;
  } | null;
};

type InvoiceItemSource = {
  estimatedPrice: number;
  serviceFee: number;
  package: { name: string } | null;
  department: { name: string };
};

type InvoiceItemDraft = {
  type: "CONSULTATION" | "PACKAGE" | "SERVICE_FEE" | "OTHER";
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sortOrder: number;
};

const normalizeOptionalString = (value?: string | null) =>
  value === undefined ? undefined : value?.trim() || null;

const buildInvoiceItems = (appointment: InvoiceItemSource) => {
  const items: InvoiceItemDraft[] = [
    {
      type: appointment.package ? "PACKAGE" as const : "CONSULTATION" as const,
      description: appointment.package
        ? `Gói khám: ${appointment.package.name}`
        : `Phí khám: ${appointment.department.name}`,
      quantity: 1,
      unitPrice: appointment.estimatedPrice,
      amount: appointment.estimatedPrice,
      sortOrder: 0,
    },
  ];

  if (appointment.serviceFee > 0) {
    items.push({
      type: "SERVICE_FEE" as const,
      description: "Phí dịch vụ đặt lịch",
      quantity: 1,
      unitPrice: appointment.serviceFee,
      amount: appointment.serviceFee,
      sortOrder: 1,
    });
  }

  return items;
};

const calculateInsurance = (
  input: InsuranceCalculationInput,
  totalAmount: number,
  appointment: InsuranceAppointmentPolicy,
  fallbackDiscount = 0,
) => {
  const hasStructuredInsurance =
    input.insuranceEligibleAmount !== undefined ||
    input.insuranceCoverageRate !== undefined ||
    input.insuranceRouteType !== undefined ||
    input.insuranceNote !== undefined;

  const eligibleAmount = hasStructuredInsurance
    ? (input.insuranceEligibleAmount ?? 0)
    : (input.bhytDiscount ?? fallbackDiscount);
  const coverageRate = hasStructuredInsurance
    ? (input.insuranceCoverageRate ?? 0)
    : eligibleAmount > 0
      ? 100
      : 0;
  const routeType =
    input.insuranceRouteType ?? (eligibleAmount > 0 ? "SERVICE" : null);
  const note = normalizeOptionalString(input.insuranceNote);
  const discountAmount = hasStructuredInsurance
    ? Math.floor((eligibleAmount * coverageRate) / 100)
    : (input.bhytDiscount ?? fallbackDiscount);

  if (eligibleAmount > totalAmount) {
    throw new AppError(
      "Số tiền đủ điều kiện BHYT không được lớn hơn tổng tiền",
      400,
    );
  }

  if (discountAmount > totalAmount) {
    throw new AppError("Giảm trừ BHYT không được lớn hơn tổng tiền", 400);
  }

  if (!appointment.hasBHYT && discountAmount > 0) {
    throw new AppError(
      "Lịch hẹn không có BHYT nên không được giảm trừ BHYT",
      400,
    );
  }

  if (
    appointment.hasBHYT &&
    appointment.package &&
    !appointment.package.isBHYTSupport &&
    discountAmount > 0
  ) {
    throw new AppError("Gói khám này không hỗ trợ giảm trừ BHYT", 400);
  }

  return {
    insuranceEligibleAmount: eligibleAmount,
    insuranceCoverageRate: coverageRate,
    insuranceDiscountAmount: discountAmount,
    insuranceRouteType: routeType,
    insuranceNote: note,
    bhytDiscount: discountAmount,
    finalAmount: totalAmount - discountAmount,
  };
};

export const invoiceSelect = {
  id: true,
  invoiceCode: true,
  barcode: true,
  totalAmount: true,
  bhytDiscount: true,
  finalAmount: true,
  insuranceEligibleAmount: true,
  insuranceCoverageRate: true,
  insuranceDiscountAmount: true,
  insuranceRouteType: true,
  insuranceNote: true,
  status: true,
  paymentMethod: true,
  paymentReference: true,
  paidAt: true,
  refundReason: true,
  refundReference: true,
  refundedAt: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      type: true,
      description: true,
      quantity: true,
      unitPrice: true,
      amount: true,
      sortOrder: true,
    },
  },
  paymentTransactions: {
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      provider: true,
      status: true,
      amount: true,
      transactionCode: true,
      providerOrderId: true,
      paidAt: true,
      expiredAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  patient: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
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
      patientEmail: true,
      estimatedPrice: true,
      serviceFee: true,
      bhytDiscount: true,
      finalAmount: true,
      package: {
        select: {
          id: true,
          name: true,
          slug: true,
          isBHYTSupport: true,
        },
      },
      doctor: {
        select: {
          id: true,
          title: true,
          specialization: true,
          user: {
            select: {
              fullName: true,
              avatar: true,
            },
          },
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
} satisfies Prisma.InvoiceSelect;

class InvoiceService {
  async list(query: {
    status?: InvoiceStatus;
    paymentMethod?: PaymentMethod;
    patientId?: string;
    appointmentId?: string;
    invoiceCode?: string;
    barcode?: string;
    phone?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {
      status: query.status,
      paymentMethod: query.paymentMethod,
      patientId: query.patientId,
      appointmentId: query.appointmentId,
      invoiceCode: query.invoiceCode,
      barcode: query.barcode,
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
    input: CreateInvoiceInput,
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
        hasBHYT: true,
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
    const totalAmount = invoiceItems.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    const insurance = calculateInsurance(
      input,
      totalAmount,
      appointment,
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
            insuranceDiscountAmount: insurance.insuranceDiscountAmount,
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
            logs: {
              create: {
                action: "INVOICE_CREATED",
                note: "Hóa đơn đã được tạo",
              },
            },
          },
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

    await PatientEventNotificationService.dispatchBestEffort(
      transition.notificationId,
    );
    return transition.createdInvoice;
  }

  async updateFinancials(id: string, input: UpdateInvoiceInput) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        bhytDiscount: true,
        appointment: {
          select: {
            id: true,
            hasBHYT: true,
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
      invoice.appointment,
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
              { status: "EXPIRED", provider: { in: ["MOMO", "VNPAY", "ZALOPAY"] } },
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
          logs: {
            create: {
              action: "INVOICE_CREATED",
              note:
                currentInvoice.status === "CANCELLED"
                  ? "Hóa đơn đã được điều chỉnh và mở lại"
                  : "Hóa đơn đã được điều chỉnh",
            },
          },
        },
      });

      const updated = await tx.invoice.updateMany({
        where: { id, status: currentInvoice.status },
        data: {
          status: "UNPAID",
          bhytDiscount: insurance.bhytDiscount,
          finalAmount: insurance.finalAmount,
          insuranceEligibleAmount: insurance.insuranceEligibleAmount,
          insuranceCoverageRate: insurance.insuranceCoverageRate,
          insuranceDiscountAmount: insurance.insuranceDiscountAmount,
          insuranceRouteType: insurance.insuranceRouteType,
          insuranceNote: insurance.insuranceNote,
        },
      });
      if (updated.count !== 1) {
        throw new AppError("Trạng thái hóa đơn đã thay đổi", 409, "INVOICE_STATE_CONFLICT");
      }
      return tx.invoice.findUniqueOrThrow({ where: { id }, select: invoiceSelect });
    });
  }

  async pay(id: string, input: PayInvoiceInput, actorId?: string) {
    if (["MOMO", "VNPAY"].includes(input.paymentMethod)) {
      throw new AppError(
        "MOMO/VNPAY phải thanh toán qua API online payment",
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
            { status: "EXPIRED", provider: { in: ["MOMO", "VNPAY", "ZALOPAY"] } },
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
      await tx.appointmentLog.create({
        data: {
          appointmentId: invoice.appointmentId,
          action: "PAYMENT_RECORDED",
          note: `Đã ghi nhận thanh toán ${input.paymentMethod}${paymentReference ? ` · ${paymentReference}` : ""}`,
          createdById: actorId,
        },
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

    await PatientEventNotificationService.dispatchBestEffort(
      transition.notificationId,
    );
    return transition.paidInvoice;
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
            { status: "EXPIRED", provider: { in: ["MOMO", "VNPAY", "ZALOPAY"] } },
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
      await tx.appointmentLog.create({
        data: {
          appointmentId: invoice.appointmentId,
          action: "INVOICE_CANCELLED",
          note: "Hóa đơn chưa thanh toán đã được hủy",
          createdById: actorId,
        },
      });
      return tx.invoice.findUniqueOrThrow({ where: { id }, select: invoiceSelect });
    });
  }

  async refund(id: string, input: RefundInvoiceInput, actorId?: string) {
    const transition = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${id} FOR UPDATE`);
      const invoice = await tx.invoice.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          finalAmount: true,
          paymentMethod: true,
          invoiceCode: true,
          patientId: true,
          appointmentId: true,
          appointment: { select: { bookingCode: true } },
        },
      });
      if (!invoice) throw new AppError("Không tìm thấy hóa đơn", 404);
      if (invoice.status !== "PAID") {
        throw new AppError("Chỉ có thể hoàn tiền hóa đơn đã thanh toán", 409, "INVOICE_STATE_CONFLICT");
      }
      if (invoice.finalAmount <= 0) throw new AppError("Hóa đơn không có số tiền để hoàn", 400);
      const refundReference = normalizeOptionalString(input.refundReference);
      if (["MOMO", "VNPAY"].includes(invoice.paymentMethod || "") && !refundReference) {
        throw new AppError(
          "Cần mã tham chiếu từ cổng thanh toán trước khi ghi nhận hoàn tiền",
          400,
          "REFUND_REFERENCE_REQUIRED",
        );
      }
      const refundedAt = new Date();
      const claimed = await tx.invoice.updateMany({
        where: { id, status: "PAID" },
        data: {
          status: "REFUNDED",
          refundReason: input.refundReason.trim(),
          refundReference,
          refundedAt,
        },
      });
      if (claimed.count !== 1) throw new AppError("Trạng thái hóa đơn đã thay đổi", 409, "INVOICE_STATE_CONFLICT");
      await tx.appointmentLog.create({
        data: {
          appointmentId: invoice.appointmentId,
          action: "PAYMENT_REFUNDED",
          note: `Hoàn tiền: ${input.refundReason.trim()}${refundReference ? ` · ${refundReference}` : ""}`,
          createdById: actorId,
        },
      });
      const refundedInvoice = await tx.invoice.findUniqueOrThrow({
        where: { id },
        select: invoiceSelect,
      });
      const notification =
        await PatientEventNotificationService.createPaymentRefunded(
          {
            userId: invoice.patientId,
            invoiceId: invoice.id,
            invoiceCode: invoice.invoiceCode,
            bookingCode: invoice.appointment.bookingCode,
            finalAmount: invoice.finalAmount,
          },
          tx,
        );

      return { refundedInvoice, notificationId: notification.id };
    });

    await PatientEventNotificationService.dispatchBestEffort(
      transition.notificationId,
    );
    return transition.refundedInvoice;
  }

  private async generateUniqueInvoiceCode(tx: Prisma.TransactionClient) {
    for (let index = 0; index < 10; index += 1) {
      const invoiceCode = generateInvoiceCode();
      const existing = await tx.invoice.findUnique({
        where: { invoiceCode },
        select: { id: true },
      });

      if (!existing) {
        return invoiceCode;
      }
    }

    throw new AppError("Không thể tạo mã hóa đơn", 500);
  }

  private async generateUniqueBarcode(tx: Prisma.TransactionClient) {
    for (let index = 0; index < 10; index += 1) {
      const barcode = generateInvoiceBarcode();
      const existing = await tx.invoice.findUnique({
        where: { barcode },
        select: { id: true },
      });

      if (!existing) {
        return barcode;
      }
    }

    throw new AppError("Không thể tạo mã vạch hóa đơn", 500);
  }
}

export default new InvoiceService();
