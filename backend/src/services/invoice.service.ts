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
import {
  generateInvoiceBarcode,
  generateInvoiceCode,
} from "../utils/invoiceCode.js";
import { refundVnpayTransaction } from "./paymentProviders/index.js";
import AuditLogService from "./auditLog.service.js";
import PatientEventNotificationService from "./patientEventNotification.service.js";
import StaffNotificationService from "./staffNotification.service.js";

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
};

const normalizeOptionalString = (value?: string | null) =>
  value === undefined ? undefined : value?.trim() || null;

type DispensedMedicineRow = {
  medicineName: string;
  unit: string | null;
  dispensedQuantity: number;
  medicine: { unitPrice: number } | null;
};

// Tiền thuốc tính theo SỐ LƯỢNG THỰC CẤP (dược sĩ cấp mới gắn thuốc với kho) và giá bán hiện tại của thuốc,
// chụp lại vào dòng hóa đơn. Thuốc mua ngoài, chưa cấp hoặc giá 0 thì không tính tiền.
const buildMedicineLines = (rows: DispensedMedicineRow[], startOrder: number): InvoiceItemDraft[] => {
  const lines: InvoiceItemDraft[] = [];
  for (const row of rows) {
    const unitPrice = row.medicine?.unitPrice ?? 0;
    if (unitPrice <= 0 || row.dispensedQuantity <= 0) continue;
    lines.push({
      type: "MEDICINE",
      description: `Thuốc: ${row.medicineName}${row.unit ? ` (${row.unit})` : ""}`,
      quantity: row.dispensedQuantity,
      unitPrice,
      amount: unitPrice * row.dispensedQuantity,
      sortOrder: startOrder + lines.length,
    });
  }
  return lines;
};

const dispensedMedicineSelect = {
  medicineName: true,
  unit: true,
  dispensedQuantity: true,
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
    // Tiền thuốc đã cấp cho các đơn của lịch này (đơn chưa cấp sẽ được thêm vào hóa đơn lúc dược sĩ cấp thuốc).
    const dispensed = await prisma.prescriptionItem.findMany({
      where: {
        prescription: { appointmentId: appointment.id, status: "ISSUED" },
        medicineId: { not: null },
        dispensedQuantity: { gt: 0 },
      },
      orderBy: [{ prescription: { issuedAt: "asc" } }, { sortOrder: "asc" }],
      select: dispensedMedicineSelect,
    });
    invoiceItems.push(...buildMedicineLines(dispensed, invoiceItems.length));
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

    return transition.paidInvoice;
  }

  /**
   * Dược sĩ vừa cấp thuốc cho một đơn: nếu lịch đã có hóa đơn chưa thanh toán thì thêm dòng tiền thuốc vào đó
   * (tổng tiền và số phải thu tăng đúng bằng tiền thuốc, giảm giá bảo hiểm giữ nguyên). Hóa đơn đã thanh toán,
   * đã hủy hoặc đang có giao dịch trực tuyến chờ thì không sửa được: báo nhân viên tiếp nhận xử lý.
   * Nếu chưa có hóa đơn thì không làm gì, tiền thuốc sẽ được tính khi lập hóa đơn.
   */
  async addDispensedMedicines(prescriptionId: string, actorId?: string) {
    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      select: { id: true, appointmentId: true, prescriptionCode: true, items: { where: { medicineId: { not: null }, dispensedQuantity: { gt: 0 } }, orderBy: { sortOrder: "asc" }, select: dispensedMedicineSelect } },
    });
    if (!prescription) return { outcome: "NO_PRESCRIPTION" as const, amount: 0 };
    const lines = buildMedicineLines(prescription.items, 0);
    const amount = lines.reduce((sum, line) => sum + line.amount, 0);
    if (amount <= 0) return { outcome: "NO_CHARGE" as const, amount: 0 };

    const invoiceRef = await prisma.invoice.findUnique({
      where: { appointmentId: prescription.appointmentId },
      select: { id: true, invoiceCode: true },
    });
    if (!invoiceRef) return { outcome: "NO_INVOICE" as const, amount };

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceRef.id} FOR UPDATE`);
      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: invoiceRef.id },
        select: { status: true, totalAmount: true, finalAmount: true, items: { select: { sortOrder: true } } },
      });
      if (invoice.status !== "UNPAID") return "BLOCKED" as const;
      const pendingPayment = await tx.paymentTransaction.count({
        where: { invoiceId: invoiceRef.id, OR: [{ status: "PENDING" }, { status: "EXPIRED", provider: "VNPAY" }] },
      });
      if (pendingPayment > 0) return "BLOCKED" as const;

      const nextOrder = Math.max(-1, ...invoice.items.map((item) => item.sortOrder)) + 1;
      await tx.invoiceItem.createMany({
        data: buildMedicineLines(prescription.items, nextOrder).map((line) => ({ ...line, invoiceId: invoiceRef.id })),
      });
      await tx.invoice.update({
        where: { id: invoiceRef.id },
        data: { totalAmount: invoice.totalAmount + amount, finalAmount: invoice.finalAmount + amount },
      });
      await tx.appointment.update({
        where: { id: prescription.appointmentId },
        data: {
          finalAmount: invoice.finalAmount + amount,
          logs: { create: { action: "INVOICE_CREATED", note: "Đã thêm tiền thuốc vào hóa đơn", createdById: actorId } },
        },
      });
      await AuditLogService.record(
        {
          actor: actorId ? { userId: actorId, role: "PHARMACIST" } : null,
          action: "INVOICE_ADJUSTED",
          targetType: "INVOICE",
          targetId: invoiceRef.id,
          meta: {
            reason: "MEDICINE_DISPENSED",
            prescriptionId,
            before: { finalAmount: invoice.finalAmount },
            after: { finalAmount: invoice.finalAmount + amount },
          },
        },
        tx,
      );
      return "ADDED" as const;
    });

    if (result === "BLOCKED") {
      await StaffNotificationService.notifyRoles(["STAFF", "ADMIN"], {
        type: "INVOICE_CREATED",
        title: "Tiền thuốc chưa tính vào hóa đơn",
        body: `Đơn ${prescription.prescriptionCode} vừa được cấp thuốc (${amount.toLocaleString("vi-VN")} đ) nhưng hóa đơn ${invoiceRef.invoiceCode} không còn sửa được. Vui lòng xử lý tiền thuốc.`,
        entityType: "INVOICE",
        entityId: invoiceRef.id,
        eventKey: `invoice:${invoiceRef.id}:medicine-blocked:${prescriptionId}`,
      });
    }
    return { outcome: result, amount };
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
          const notification =
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
          console.error(`[INVOICE_REMINDER] invoice=${invoice.id} failed:`, error);
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
