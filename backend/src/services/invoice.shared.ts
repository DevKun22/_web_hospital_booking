import type { Prisma } from "../../generated/prisma/client.js";
import type { PaymentMethod } from "../../generated/prisma/enums.js";

// Phần dùng chung của hóa đơn: nhập thu tiền, các khối `select` và kiểu người thao tác, để InvoiceService (hóa đơn chính)
// và InvoiceMedicineService (tiền thuốc, hóa đơn bổ sung, hoàn tiền thuốc) cùng dùng mà không import vòng.

export type InvoiceActor = { userId: string; role: string };

export type PayInvoiceInput = {
  paymentMethod: PaymentMethod;
  paymentReference?: string | null;
};

// Tiền thuốc tính từ lúc phát hành đơn (theo số lượng kê, giá bán chụp lại vào dòng hóa đơn) và theo số lượng
// thực cấp khi đã cấp. Thuốc ngoài danh mục, người khám tự mua, hết hàng hoặc giá 0 thì không tính tiền.
// Quy tắc nằm ở utils/medicineBilling.ts.
export const billableItemSelect = {
  id: true,
  medicineName: true,
  unit: true,
  quantity: true,
  dispensedQuantity: true,
  fulfillmentStatus: true,
  medicineId: true,
  medicine: { select: { unitPrice: true } },
} as const;

export const invoiceSelect = {
  id: true,
  invoiceCode: true,
  barcode: true,
  totalAmount: true,
  bhytDiscount: true,
  finalAmount: true,
  insuranceEligibleAmount: true,
  insuranceCoverageRate: true,
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

