import { randomBytes } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import type {
  InsuranceRouteType,
  InvoiceStatus,
  PaymentMethod,
} from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { getReminderDispatchConcurrency } from "../config/environment.js";
import { AppError } from "../utils/appError.js";
import { mapWithConcurrency } from "../utils/concurrency.js";
import { desiredMedicineLine, diffMedicineLines, type BillableItem } from "../utils/medicineBilling.js";
import {
  generateInvoiceBarcode,
  generateInvoiceCode,
} from "../utils/invoiceCode.js";
import { refundVnpayTransaction } from "./paymentProviders/index.js";
import AuditLogService from "./auditLog.service.js";
import MedicalRecordService from "./medicalRecord.service.js";
import PatientEventNotificationService from "./patientEventNotification.service.js";
import StaffNotificationService from "./staffNotification.service.js";
import { normalizeOptionalString } from "../utils/text.js";
import { generateUniqueCode } from "../utils/uniqueCode.js";
import { logger } from "../observability/logger.js";

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
  type: "CONSULTATION" | "PACKAGE" | "SERVICE_FEE" | "MEDICINE" | "OTHER";
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sortOrder: number;
  // Dòng tiền thuốc gắn với dòng đơn thuốc sinh ra nó.
  prescriptionItemId?: string;
};

// Tiền thuốc tính từ lúc phát hành đơn (theo số lượng kê, giá bán chụp lại vào dòng hóa đơn) và theo số lượng
// thực cấp khi đã cấp. Thuốc ngoài danh mục, người khám tự mua, hết hàng hoặc giá 0 thì không tính tiền.
// Quy tắc nằm ở utils/medicineBilling.ts.
const billableItemSelect = {
  id: true,
  medicineName: true,
  unit: true,
  quantity: true,
  dispensedQuantity: true,
  fulfillmentStatus: true,
  medicineId: true,
  medicine: { select: { unitPrice: true } },
} as const;

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
  refundedAmount: true,
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
      refundedAt: true,
    },
  },
  supplements: {
    where: { status: { not: "CANCELLED" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      supplementCode: true,
      amount: true,
      status: true,
      paymentMethod: true,
      paymentReference: true,
      paidAt: true,
      createdAt: true,
      items: { orderBy: { createdAt: "asc" }, select: { id: true, description: true, quantity: true, unitPrice: true, amount: true } },
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

    return transition.createdInvoice;
  }

  async updateFinancials(
    id: string,
    input: UpdateInvoiceInput,
    actor?: { userId: string; role: string },
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

    await this.afterPaid(transition.paidInvoice.appointment.id, actorId ? { userId: actorId, role: "STAFF" } : undefined);
    return transition.paidInvoice;
  }

  /**
   * Việc tự động sau khi hóa đơn được thu (tiền mặt hoặc VNPay), mỗi việc độc lập và không làm hỏng việc thu tiền:
   * đơn phát hành lúc hóa đơn còn chờ thì nay tính thành hóa đơn bổ sung; hồ sơ đủ điều kiện thì tự công bố.
   */
  async afterPaid(appointmentId: string, actor?: { userId: string; role: string }) {
    await this.syncAppointmentMedicine(appointmentId, actor).catch((error) => {
      logger.error("[INVOICE_MEDICINE] cannot sync medicines after payment:", error);
    });
    await MedicalRecordService.publishWhenReady(appointmentId).catch((error) => {
      logger.error("[AUTO_PUBLISH] cannot publish after payment:", error);
    });
  }

  /** Đồng bộ tiền thuốc của mọi đơn đã phát hành của một lịch (gọi sau khi hóa đơn được thanh toán). */
  async syncAppointmentMedicine(appointmentId: string, actor?: { userId: string; role: string }) {
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
  async syncMedicineLines(prescriptionId: string, actor?: { userId: string; role: string }) {
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
      actor?: { userId: string; role: string };
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

  /** Giữ tên cũ cho chỗ gọi lúc cấp thuốc; hành vi là đồng bộ dòng tiền thuốc. */
  addDispensedMedicines(prescriptionId: string, actor?: { userId: string; role: string }) {
    return this.syncMedicineLines(prescriptionId, actor);
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

  // Hoàn tiền toàn phần qua API VNPAY rồi ghi nhận vào hóa đơn. Hoàn tiền không đảo ngược
  // được nên: (1) mã yêu cầu được lưu và commit TRƯỚC khi gọi VNPAY để một hóa đơn không
  // bao giờ gửi hai yêu cầu; (2) chỉ xóa mã đó khi VNPAY từ chối rõ ràng bằng phản hồi đã
  // xác thực chữ ký; (3) kết quả chưa xác nhận được giữ nguyên mã để người vận hành kiểm
  // tra trên cổng VNPAY rồi ghi nhận thủ công bằng PATCH /:id/refund.
  async refundViaVnpay(
    id: string,
    input: { refundReason: string },
    actorId?: string,
    ipAddress?: string,
    role?: string,
  ) {
    const reason = input.refundReason.trim();
    const attempt = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${id} FOR UPDATE`);
      const invoice = await tx.invoice.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          finalAmount: true,
          paymentMethod: true,
          refundedAmount: true,
          refundRequestId: true,
          paymentTransactions: {
            where: { provider: "VNPAY", status: "SUCCESS" },
            orderBy: { paidAt: "desc" },
            take: 1,
            select: {
              transactionCode: true,
              amount: true,
              providerOrderId: true,
              rawRequest: true,
            },
          },
        },
      });
      if (!invoice) throw new AppError("Không tìm thấy hóa đơn", 404);
      if (invoice.status !== "PAID" || invoice.paymentMethod !== "VNPAY") {
        throw new AppError(
          "Chỉ hoàn tiền qua VNPAY cho hóa đơn đã thanh toán bằng VNPAY",
          409,
          "INVOICE_STATE_CONFLICT",
        );
      }
      if (invoice.refundedAmount > 0) {
        throw new AppError(
          "Hóa đơn đã hoàn một phần tiền thuốc nên không hoàn tự động toàn phần qua VNPAY được. Hãy hoàn phần còn lại ở cổng VNPAY rồi ghi nhận thủ công.",
          409,
          "REFUND_PARTIAL_EXISTS",
        );
      }
      if (invoice.refundRequestId) {
        throw new AppError(
          "Hóa đơn đã có yêu cầu hoàn tiền chưa xác nhận kết quả. Hãy kiểm tra trên cổng VNPAY rồi ghi nhận thủ công.",
          409,
          "REFUND_PENDING_VERIFICATION",
        );
      }
      const payment = invoice.paymentTransactions[0];
      const request = payment?.rawRequest as Record<string, unknown> | null | undefined;
      const transactionDate =
        typeof request?.vnp_CreateDate === "string" ? request.vnp_CreateDate : null;
      if (
        !payment?.providerOrderId ||
        !transactionDate ||
        payment.amount !== invoice.finalAmount ||
        invoice.finalAmount <= 0
      ) {
        throw new AppError(
          "Không đủ thông tin giao dịch VNPAY để hoàn tiền tự động",
          409,
          "REFUND_NOT_AUTOMATABLE",
        );
      }
      const requestId = randomBytes(16).toString("hex");
      await tx.invoice.update({
        where: { id },
        data: { refundRequestId: requestId, refundAttemptedAt: new Date() },
      });
      return {
        requestId,
        txnRef: payment.transactionCode,
        amount: invoice.finalAmount,
        transactionNo: payment.providerOrderId,
        transactionDate,
      };
    });

    // Kết quả không xác minh được thì refundVnpayTransaction ném lỗi: mã yêu cầu được giữ
    // nguyên và không tự thử lại.
    let result;
    try {
      result = await refundVnpayTransaction({
        requestId: attempt.requestId,
        txnRef: attempt.txnRef,
        amount: attempt.amount,
        transactionNo: attempt.transactionNo,
        transactionDate: attempt.transactionDate,
        createBy: actorId ?? "system",
        reason,
        ipAddress,
      });
    } catch (error) {
      await AuditLogService.record({
        actor: actorId ? { userId: actorId, role: role ?? "ADMIN" } : null,
        action: "INVOICE_REFUND_UNVERIFIED",
        targetType: "INVOICE",
        targetId: id,
        ipAddress,
        meta: { requestId: attempt.requestId },
      });
      await StaffNotificationService.notifyRoles(["ADMIN"], {
        type: "SYSTEM_ANNOUNCEMENT",
        title: "Hoàn tiền chưa xác nhận được kết quả",
        body: "Một yêu cầu hoàn tiền VNPay chưa xác nhận được kết quả. Vui lòng đối soát hóa đơn trước khi thử lại.",
        entityType: "INVOICE",
        entityId: id,
        eventKey: `invoice:${id}:refund-unverified:${attempt.requestId}`,
        excludeUserId: actorId,
      });
      throw error;
    }

    if (result.outcome === "REJECTED") {
      await prisma.invoice.updateMany({
        where: { id, refundRequestId: attempt.requestId },
        data: { refundRequestId: null, refundAttemptedAt: null },
      });
      throw new AppError(
        `${result.message} (mã ${result.responseCode})`,
        422,
        "VNPAY_REFUND_REJECTED",
      );
    }

    return this.refund(
      id,
      {
        refundReason: reason,
        refundReference: result.refundTransactionNo ?? attempt.requestId,
      },
      actorId,
      { via: "VNPAY_API", role, ipAddress },
    );
  }

  async refund(
    id: string,
    input: RefundInvoiceInput,
    actorId?: string,
    context: { via?: "MANUAL" | "VNPAY_API"; role?: string; ipAddress?: string } = {},
  ) {
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
      if (invoice.paymentMethod === "VNPAY" && !refundReference) {
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
      await AuditLogService.record(
        {
          actor: actorId ? { userId: actorId, role: context.role ?? "ADMIN" } : null,
          action: "INVOICE_REFUNDED",
          targetType: "INVOICE",
          targetId: id,
          ipAddress: context.ipAddress,
          meta: { via: context.via ?? "MANUAL", amount: invoice.finalAmount },
        },
        tx,
      );
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

    return transition.refundedInvoice;
  }

  private generateUniqueInvoiceCode(tx: Prisma.TransactionClient) {
    return generateUniqueCode(
      generateInvoiceCode,
      async (invoiceCode) => Boolean(await tx.invoice.findUnique({ where: { invoiceCode }, select: { id: true } })),
      "Không thể tạo mã hóa đơn",
    );
  }

  private generateUniqueBarcode(tx: Prisma.TransactionClient) {
    return generateUniqueCode(
      generateInvoiceBarcode,
      async (barcode) => Boolean(await tx.invoice.findUnique({ where: { barcode }, select: { id: true } })),
      "Không thể tạo mã vạch hóa đơn",
    );
  }
}

export default new InvoiceService();
