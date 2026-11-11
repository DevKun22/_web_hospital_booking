import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import NotificationService from "./notification.service.js";

type DatabaseClient = Prisma.TransactionClient | typeof prisma;

type MedicalResultPublishedInput = {
  userId: string;
  recordId: string;
  recordCode: string;
  bookingCode: string;
};

type PrescriptionIssuedInput = {
  userId: string;
  prescriptionId: string;
  prescriptionCode: string;
  bookingCode: string;
};

type InvoiceEventInput = {
  userId: string;
  invoiceId: string;
  invoiceCode: string;
  bookingCode: string;
  finalAmount: number;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);

class PatientEventNotificationService {
  createMedicalResultPublished(
    input: MedicalResultPublishedInput,
    client: DatabaseClient,
  ) {
    return NotificationService.create(
      {
        userId: input.userId,
        type: "MEDICAL_RESULT_PUBLISHED",
        title: "Kết quả khám đã sẵn sàng",
        body: `Hồ sơ ${input.recordCode} của lịch ${input.bookingCode} đã được bệnh viện công bố.`,
        entityType: "MEDICAL_RECORD",
        entityId: input.recordId,
        payload: {
          recordCode: input.recordCode,
          bookingCode: input.bookingCode,
        },
        dedupeKey: `medical-record:${input.recordId}:published`,
      },
      client,
    );
  }

  createPrescriptionIssued(
    input: PrescriptionIssuedInput,
    client: DatabaseClient,
  ) {
    return NotificationService.create(
      {
        userId: input.userId,
        type: "PRESCRIPTION_ISSUED",
        title: "Đơn thuốc mới đã được phát hành",
        body: `Đơn ${input.prescriptionCode} của lịch ${input.bookingCode} đã sẵn sàng để xem.`,
        entityType: "PRESCRIPTION",
        entityId: input.prescriptionId,
        payload: {
          prescriptionCode: input.prescriptionCode,
          bookingCode: input.bookingCode,
        },
        dedupeKey: `prescription:${input.prescriptionId}:issued`,
      },
      client,
    );
  }

  createPrescriptionDispensed(
    input: PrescriptionIssuedInput,
    client: DatabaseClient,
  ) {
    return NotificationService.create(
      {
        userId: input.userId,
        type: "PRESCRIPTION_DISPENSED",
        title: "Đơn thuốc đã được cấp phát",
        body: `Đơn ${input.prescriptionCode} của lịch ${input.bookingCode} đã được dược sĩ cấp thuốc.`,
        entityType: "PRESCRIPTION",
        entityId: input.prescriptionId,
        payload: {
          prescriptionCode: input.prescriptionCode,
          bookingCode: input.bookingCode,
        },
        dedupeKey: `prescription:${input.prescriptionId}:dispensed`,
      },
      client,
    );
  }

  createInvoiceCreated(input: InvoiceEventInput, client: DatabaseClient) {
    return NotificationService.create(
      {
        userId: input.userId,
        type: "INVOICE_CREATED",
        title: "Hóa đơn khám đã được tạo",
        body: `Hóa đơn ${input.invoiceCode} của lịch ${input.bookingCode} cần thanh toán ${formatCurrency(input.finalAmount)}.`,
        entityType: "INVOICE",
        entityId: input.invoiceId,
        payload: {
          invoiceCode: input.invoiceCode,
          bookingCode: input.bookingCode,
          finalAmount: input.finalAmount,
          status: "UNPAID",
        },
        dedupeKey: `invoice:${input.invoiceId}:created`,
      },
      client,
    );
  }

  createPaymentReminder(input: InvoiceEventInput, client: DatabaseClient) {
    return NotificationService.create(
      {
        userId: input.userId,
        type: "INVOICE_CREATED",
        title: "Hóa đơn đang chờ thanh toán",
        body: `Hóa đơn ${input.invoiceCode} của lịch ${input.bookingCode} (${formatCurrency(input.finalAmount)}) chưa được thanh toán.`,
        entityType: "INVOICE",
        entityId: input.invoiceId,
        payload: {
          invoiceCode: input.invoiceCode,
          bookingCode: input.bookingCode,
          finalAmount: input.finalAmount,
          status: "UNPAID",
          reminder: true,
        },
        dedupeKey: `invoice:${input.invoiceId}:reminder`,
      },
      client,
    );
  }

  createPaymentSucceeded(input: InvoiceEventInput, client: DatabaseClient) {
    return NotificationService.create(
      {
        userId: input.userId,
        type: "PAYMENT_SUCCEEDED",
        title: "Thanh toán đã được ghi nhận",
        body: `Hóa đơn ${input.invoiceCode} đã thanh toán thành công ${formatCurrency(input.finalAmount)}.`,
        entityType: "INVOICE",
        entityId: input.invoiceId,
        payload: {
          invoiceCode: input.invoiceCode,
          bookingCode: input.bookingCode,
          finalAmount: input.finalAmount,
          status: "PAID",
        },
        dedupeKey: `invoice:${input.invoiceId}:paid`,
      },
      client,
    );
  }

  createPaymentRefunded(input: InvoiceEventInput, client: DatabaseClient) {
    return NotificationService.create(
      {
        userId: input.userId,
        type: "PAYMENT_REFUNDED",
        title: "Hóa đơn đã được hoàn tiền",
        body: `Hóa đơn ${input.invoiceCode} đã được ghi nhận hoàn tiền ${formatCurrency(input.finalAmount)}.`,
        entityType: "INVOICE",
        entityId: input.invoiceId,
        payload: {
          invoiceCode: input.invoiceCode,
          bookingCode: input.bookingCode,
          finalAmount: input.finalAmount,
          status: "REFUNDED",
        },
        dedupeKey: `invoice:${input.invoiceId}:refunded`,
      },
      client,
    );
  }

}

export default new PatientEventNotificationService();
