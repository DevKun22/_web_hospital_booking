import { Prisma } from "../../generated/prisma/client.js";
import type {
  PaymentMethod,
  PaymentProvider,
} from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { generatePaymentTransactionCode } from "../utils/paymentCode.js";
import {
  assertMockPaymentEnabled,
  assertPaymentProviderAvailable,
  getPaymentProviderAdapter,
  getPaymentProviderCapabilities,
  parseVerifiedMomoCallback,
} from "./paymentProviders/index.js";
import type { VerifiedMomoCallback } from "./paymentProviders/index.js";
import PatientEventNotificationService from "./patientEventNotification.service.js";

const PAYMENT_EXPIRES_MINUTES = 15;
const MOMO_PENDING_RESULT_CODES = new Set([1000, 7000, 7002]);
const MOMO_SUCCESS_RESULT_CODES = new Set([0, 9000]);

type CreatePaymentTransactionInput = {
  provider: PaymentProvider;
};

export const paymentTransactionSelect = {
  id: true,
  provider: true,
  status: true,
  amount: true,
  transactionCode: true,
  activeKey: true,
  idempotencyKey: true,
  providerOrderId: true,
  paymentUrl: true,
  rawResponse: true,
  paidAt: true,
  expiredAt: true,
  createdAt: true,
  updatedAt: true,
  invoice: {
    select: {
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
      paidAt: true,
      appointment: {
        select: {
          id: true,
          bookingCode: true,
          patientName: true,
          patientPhone: true,
        },
      },
    },
  },
} satisfies Prisma.PaymentTransactionSelect;

const mapProviderToPaymentMethod = (
  provider: PaymentProvider,
): PaymentMethod => {
  if (provider === "MOMO") return "MOMO";
  if (provider === "VNPAY") return "VNPAY";
  return "OTHER";
};

class PaymentService {
  async createForInvoice(
    invoiceId: string,
    input: CreatePaymentTransactionInput,
    patientId: string,
    idempotencyKey?: string,
  ) {
    assertPaymentProviderAvailable(input.provider);
    // Only one externally payable transaction may remain active for an
    // invoice, even when more providers are added later.
    const activeKey = `invoice:${invoiceId}`;
    const now = new Date();
    let reservation;
    try {
      reservation = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`,
        );
        const invoice = await tx.invoice.findFirst({
          where: { id: invoiceId, patientId },
          select: {
            id: true,
            invoiceCode: true,
            finalAmount: true,
            status: true,
          },
        });

        if (!invoice) {
          throw new AppError("Không tìm thấy hóa đơn", 404);
        }

        if (invoice.status !== "UNPAID") {
          throw new AppError(
            "Chỉ có thể tạo thanh toán online cho hóa đơn chưa thanh toán",
            400,
          );
        }

        if (invoice.finalAmount <= 0) {
          throw new AppError("Số tiền thanh toán không hợp lệ", 400);
        }

        await tx.paymentTransaction.updateMany({
          where: {
            activeKey,
            status: "PENDING",
            expiredAt: { lte: now },
          },
          data: { status: "EXPIRED", activeKey: null },
        });

        if (idempotencyKey) {
          const existingAttempt = await tx.paymentTransaction.findUnique({
            where: { idempotencyKey },
            select: {
              id: true,
              invoiceId: true,
              provider: true,
              transactionCode: true,
              expiredAt: true,
              invoice: { select: { patientId: true } },
            },
          });

          if (existingAttempt) {
            if (
              existingAttempt.invoiceId !== invoiceId ||
              existingAttempt.provider !== input.provider ||
              existingAttempt.invoice.patientId !== patientId
            ) {
              throw new AppError(
                "Idempotency-Key đã được dùng cho yêu cầu khác",
                409,
                "PAYMENT_IDEMPOTENCY_CONFLICT",
              );
            }

            return {
              id: existingAttempt.id,
              isCreator: false,
              invoice,
              transactionCode: existingAttempt.transactionCode,
              expiredAt: existingAttempt.expiredAt,
            };
          }
        }

        const transactionCode = await this.generateUniqueTransactionCode(tx);
        const expiredAt = new Date(
          Date.now() + PAYMENT_EXPIRES_MINUTES * 60 * 1000,
        );
        const transaction = await tx.paymentTransaction.upsert({
          where: { activeKey },
          update: {},
          create: {
            invoiceId: invoice.id,
            provider: input.provider,
            amount: invoice.finalAmount,
            transactionCode,
            activeKey,
            idempotencyKey,
            expiredAt,
          },
          select: {
            id: true,
            transactionCode: true,
          },
        });

        return {
          id: transaction.id,
          isCreator: transaction.transactionCode === transactionCode,
          invoice,
          transactionCode: transaction.transactionCode,
          expiredAt,
        };
      });
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;

      const racedReservation = await prisma.paymentTransaction.findFirst({
        where: {
          activeKey,
          invoice: { patientId },
        },
        select: { id: true },
      });
      if (racedReservation) {
        return this.getById(racedReservation.id, patientId);
      }

      if (idempotencyKey) {
        const idempotencyOwner = await prisma.paymentTransaction.findUnique({
          where: { idempotencyKey },
          select: { invoiceId: true, provider: true },
        });
        if (idempotencyOwner) {
          throw new AppError(
            "Idempotency-Key đã được dùng cho yêu cầu khác",
            409,
            "PAYMENT_IDEMPOTENCY_CONFLICT",
          );
        }
      }

      throw error;
    }

    if (!reservation.isCreator) {
      return this.getById(reservation.id, patientId);
    }

    try {
      const adapter = getPaymentProviderAdapter(input.provider);
      const providerResult = await adapter.createPayment({
        provider: input.provider,
        transactionCode: reservation.transactionCode,
        invoiceId: reservation.invoice.id,
        invoiceCode: reservation.invoice.invoiceCode,
        amount: reservation.invoice.finalAmount,
        orderInfo: `Thanh toán hóa đơn ${reservation.invoice.invoiceCode}`,
        expiredAt: reservation.expiredAt,
      });

      await prisma.paymentTransaction.updateMany({
        where: {
          id: reservation.id,
          status: "PENDING",
          activeKey,
        },
        data: {
          providerOrderId: providerResult.providerOrderId,
          paymentUrl: providerResult.paymentUrl,
          rawRequest: providerResult.rawRequest,
          rawResponse: providerResult.rawResponse,
        },
      });
    } catch (error) {
      await prisma.paymentTransaction.updateMany({
        where: { id: reservation.id, status: "PENDING", activeKey },
        data: {
          status: "FAILED",
          activeKey: null,
          rawResponse: {
            error:
              error instanceof Error
                ? error.message.slice(0, 500)
                : "Provider request failed",
          },
        },
      });
      throw error;
    }

    return this.getById(reservation.id, patientId);
  }

  getCapabilities() {
    return getPaymentProviderCapabilities();
  }

  async handleMomoWebhook(payload: Record<string, unknown>) {
    const callback = parseVerifiedMomoCallback(payload);
    const configuredPartnerCode = process.env.MOMO_PARTNER_CODE?.trim();
    if (!configuredPartnerCode || callback.partnerCode !== configuredPartnerCode) {
      throw new AppError(
        "Callback không thuộc đối tác MoMo đã cấu hình",
        400,
        "MOMO_PARTNER_MISMATCH",
      );
    }

    const transaction = await prisma.paymentTransaction.findFirst({
      where: { transactionCode: callback.orderId, provider: "MOMO" },
      select: {
        id: true,
        status: true,
        amount: true,
        transactionCode: true,
        invoiceId: true,
        invoice: {
          select: {
            id: true,
            invoiceCode: true,
            status: true,
            finalAmount: true,
            patientId: true,
            appointment: { select: { id: true, bookingCode: true } },
          },
        },
      },
    });
    if (!transaction) {
      throw new AppError(
        "Không tìm thấy giao dịch MoMo",
        404,
        "MOMO_TRANSACTION_NOT_FOUND",
      );
    }
    this.assertMomoCallbackMatchesTransaction(callback, transaction);

    const safeResponse = this.safeMomoCallback(callback);
    if (MOMO_PENDING_RESULT_CODES.has(callback.resultCode)) {
      if (transaction.status === "PENDING") {
        await prisma.paymentTransaction.update({
          where: { id: transaction.id },
          data: { rawResponse: safeResponse },
        });
      }
      return this.getById(transaction.id, transaction.invoice.patientId);
    }

    if (!MOMO_SUCCESS_RESULT_CODES.has(callback.resultCode)) {
      if (transaction.status === "PENDING") {
        await prisma.paymentTransaction.updateMany({
          where: { id: transaction.id, status: "PENDING" },
          data: {
            status: "FAILED",
            activeKey: null,
            rawResponse: safeResponse,
          },
        });
      }
      return this.getById(transaction.id, transaction.invoice.patientId);
    }

    if (transaction.status === "SUCCESS") {
      return this.getById(transaction.id, transaction.invoice.patientId);
    }
    if (!(["PENDING", "EXPIRED"] as const).includes(transaction.status as "PENDING" | "EXPIRED")) {
      throw new AppError(
        "Giao dịch không thể chuyển sang thành công từ trạng thái hiện tại",
        409,
        "PAYMENT_STATE_CONFLICT",
      );
    }

    const paidAt = new Date();
    const transition = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${transaction.invoice.id} FOR UPDATE`,
      );
      const claimed = await tx.paymentTransaction.updateMany({
        where: {
          id: transaction.id,
          status: { in: ["PENDING", "EXPIRED"] },
          amount: callback.amount,
        },
        data: {
          status: "SUCCESS",
          activeKey: null,
          paidAt,
          providerOrderId: callback.transId ?? callback.orderId,
          rawResponse: safeResponse,
        },
      });
      if (claimed.count !== 1) return { notificationId: null };

      const invoiceUpdated = await tx.invoice.updateMany({
        where: {
          id: transaction.invoice.id,
          status: "UNPAID",
          finalAmount: callback.amount,
        },
        data: {
          status: "PAID",
          paymentMethod: "MOMO",
          paymentReference: callback.transId ?? callback.orderId,
          paidAt,
        },
      });
      if (invoiceUpdated.count !== 1) {
        const currentInvoice = await tx.invoice.findUniqueOrThrow({
          where: { id: transaction.invoice.id },
          select: { status: true, finalAmount: true },
        });
        if (
          currentInvoice.status !== "PAID" ||
          currentInvoice.finalAmount !== callback.amount
        ) {
          throw new AppError(
            "Trạng thái hóa đơn đã thay đổi",
            409,
            "INVOICE_STATE_CONFLICT",
          );
        }
        return { notificationId: null };
      }

      await tx.appointmentLog.create({
        data: {
          appointmentId: transaction.invoice.appointment.id,
          action: "PAYMENT_RECORDED",
          note: `MoMo xác nhận thanh toán · ${callback.transId ?? callback.orderId}`,
        },
      });

      const notification =
        await PatientEventNotificationService.createPaymentSucceeded(
          {
            userId: transaction.invoice.patientId,
            invoiceId: transaction.invoice.id,
            invoiceCode: transaction.invoice.invoiceCode,
            bookingCode: transaction.invoice.appointment.bookingCode,
            finalAmount: transaction.invoice.finalAmount,
          },
          tx,
        );
      return { notificationId: notification.id };
    });

    if (transition.notificationId) {
      await PatientEventNotificationService.dispatchBestEffort(
        transition.notificationId,
      );
    }
    return this.getById(transaction.id, transaction.invoice.patientId);
  }

  async getById(id: string, patientId: string) {
    let transaction = await prisma.paymentTransaction.findFirst({
      where: { id, invoice: { patientId } },
      select: paymentTransactionSelect,
    });

    if (!transaction) {
      throw new AppError("Không tìm thấy giao dịch thanh toán", 404);
    }

    if (
      transaction.status === "PENDING" &&
      transaction.expiredAt.getTime() <= Date.now()
    ) {
      const expired = await prisma.paymentTransaction.updateMany({
        where: {
          id: transaction.id,
          status: "PENDING",
          expiredAt: { lte: new Date() },
        },
        data: { status: "EXPIRED", activeKey: null },
      });
      if (expired.count === 1) {
        transaction = await prisma.paymentTransaction.findUniqueOrThrow({
          where: { id: transaction.id },
          select: paymentTransactionSelect,
        });
      }
    }

    return transaction;
  }

  async getByTransactionCode(transactionCode: string, patientId: string) {
    assertMockPaymentEnabled();

    const transaction = await prisma.paymentTransaction.findFirst({
      where: { transactionCode, invoice: { patientId } },
      select: paymentTransactionSelect,
    });

    if (!transaction) {
      throw new AppError("Không tìm thấy giao dịch thanh toán", 404);
    }

    return transaction;
  }

  async markMockSuccess(transactionCode: string, patientId: string) {
    assertMockPaymentEnabled();

    const transaction = await prisma.paymentTransaction.findFirst({
      where: { transactionCode, invoice: { patientId } },
      select: {
        id: true,
        invoiceId: true,
        transactionCode: true,
        provider: true,
        status: true,
        amount: true,
        expiredAt: true,
        invoice: {
          select: {
            id: true,
            invoiceCode: true,
            status: true,
            finalAmount: true,
            appointment: {
              select: {
                id: true,
                bookingCode: true,
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      throw new AppError("Không tìm thấy giao dịch thanh toán", 404);
    }

    if (transaction.status === "SUCCESS") {
      return this.getById(transaction.id, patientId);
    }

    this.ensurePendingTransaction(transaction.status, transaction.expiredAt);

    if (transaction.invoice.status !== "UNPAID") {
      throw new AppError("Hóa đơn không còn ở trạng thái chờ thanh toán", 400);
    }

    if (transaction.amount !== transaction.invoice.finalAmount) {
      throw new AppError("Số tiền giao dịch không khớp với hóa đơn", 400);
    }

    const paidAt = new Date();

    const transition = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${transaction.invoiceId} FOR UPDATE`,
      );
      const claimed = await tx.paymentTransaction.updateMany({
        where: {
          id: transaction.id,
          status: "PENDING",
          expiredAt: { gt: paidAt },
        },
        data: {
          status: "SUCCESS",
          activeKey: null,
          paidAt,
          rawResponse: {
            mode: "MOCK",
            result: "SUCCESS",
            paidAt: paidAt.toISOString(),
          },
        },
      });

      if (claimed.count !== 1) {
        const current = await tx.paymentTransaction.findUniqueOrThrow({
          where: { id: transaction.id },
          select: { status: true },
        });
        if (current.status !== "SUCCESS") {
          throw new AppError(
            "Trạng thái giao dịch đã thay đổi",
            409,
            "PAYMENT_STATE_CONFLICT",
          );
        }

        const payment = await tx.paymentTransaction.findUniqueOrThrow({
          where: { id: transaction.id },
          select: paymentTransactionSelect,
        });
        return { payment, notificationId: null };
      }

      const invoiceUpdate = await tx.invoice.updateMany({
        where: {
          id: transaction.invoiceId,
          status: "UNPAID",
          finalAmount: transaction.amount,
        },
        data: {
          status: "PAID",
          paymentMethod: mapProviderToPaymentMethod(transaction.provider),
          paymentReference: transaction.transactionCode,
          paidAt,
        },
      });

      if (invoiceUpdate.count !== 1 && transaction.invoice.status === "UNPAID") {
        throw new AppError(
          "Trạng thái hóa đơn đã thay đổi",
          409,
          "INVOICE_STATE_CONFLICT",
        );
      }

      if (invoiceUpdate.count === 1) {
        await tx.appointmentLog.create({
          data: {
            appointmentId: transaction.invoice.appointment.id,
            action: "PAYMENT_RECORDED",
            note: `Thanh toán ${transaction.provider} được xác nhận · ${transaction.transactionCode}`,
          },
        });
      }

      const notification =
        await PatientEventNotificationService.createPaymentSucceeded(
          {
            userId: patientId,
            invoiceId: transaction.invoice.id,
            invoiceCode: transaction.invoice.invoiceCode,
            bookingCode: transaction.invoice.appointment.bookingCode,
            finalAmount: transaction.invoice.finalAmount,
          },
          tx,
        );
      const payment = await tx.paymentTransaction.findUniqueOrThrow({
        where: {
          id: transaction.id,
        },
        select: paymentTransactionSelect,
      });
      return { payment, notificationId: notification.id };
    });

    if (transition.notificationId) {
      await PatientEventNotificationService.dispatchBestEffort(
        transition.notificationId,
      );
    }
    return transition.payment;
  }

  async markMockFailed(transactionCode: string, patientId: string) {
    assertMockPaymentEnabled();

    const transaction = await prisma.paymentTransaction.findFirst({
      where: { transactionCode, invoice: { patientId } },
      select: {
        id: true,
        status: true,
        expiredAt: true,
      },
    });

    if (!transaction) {
      throw new AppError("Không tìm thấy giao dịch thanh toán", 404);
    }

    if (transaction.status === "FAILED") {
      return this.getById(transaction.id, patientId);
    }

    this.ensurePendingTransaction(transaction.status, transaction.expiredAt);

    const failed = await prisma.paymentTransaction.updateMany({
      where: {
        id: transaction.id,
        status: "PENDING",
      },
      data: {
        status: "FAILED",
        activeKey: null,
        rawResponse: {
          mode: "MOCK",
          result: "FAILED",
          failedAt: new Date().toISOString(),
        },
      },
    });
    if (failed.count !== 1) {
      throw new AppError(
        "Trạng thái giao dịch đã thay đổi",
        409,
        "PAYMENT_STATE_CONFLICT",
      );
    }
    return this.getById(transaction.id, patientId);
  }

  async cancel(id: string, patientId: string) {
    const transaction = await prisma.paymentTransaction.findFirst({
      where: { id, invoice: { patientId } },
      select: {
        id: true,
        provider: true,
        status: true,
      },
    });

    if (!transaction) {
      throw new AppError("Không tìm thấy giao dịch thanh toán", 404);
    }

    if (transaction.status !== "PENDING") {
      throw new AppError("Chỉ có thể hủy giao dịch đang chờ thanh toán", 400);
    }
    if (transaction.provider !== "MOCK") {
      throw new AppError(
        "Không thể hủy giao dịch tại cổng thanh toán từ ứng dụng. Nếu chưa thanh toán, giao dịch sẽ tự hết hạn.",
        409,
        "PROVIDER_PAYMENT_CANNOT_BE_CANCELLED_LOCALLY",
      );
    }

    const cancelled = await prisma.paymentTransaction.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: "CANCELLED",
        activeKey: null,
      },
    });
    if (cancelled.count !== 1) {
      throw new AppError(
        "Trạng thái giao dịch đã thay đổi",
        409,
        "PAYMENT_STATE_CONFLICT",
      );
    }
    return this.getById(id, patientId);
  }

  private ensurePendingTransaction(status: string, expiredAt: Date) {
    if (status !== "PENDING") {
      throw new AppError(
        "Giao dịch không còn ở trạng thái chờ thanh toán",
        400,
      );
    }

    if (expiredAt.getTime() <= Date.now()) {
      throw new AppError("Giao dịch thanh toán đã hết hạn", 400);
    }
  }

  private assertMomoCallbackMatchesTransaction(
    callback: VerifiedMomoCallback,
    transaction: {
      transactionCode: string;
      amount: number;
      invoice: { finalAmount: number };
    },
  ) {
    if (
      callback.orderId !== transaction.transactionCode ||
      callback.requestId !== transaction.transactionCode
    ) {
      throw new AppError(
        "Mã giao dịch trong callback MoMo không khớp",
        400,
        "MOMO_TRANSACTION_MISMATCH",
      );
    }
    if (
      callback.amount !== transaction.amount ||
      callback.amount !== transaction.invoice.finalAmount
    ) {
      throw new AppError(
        "Số tiền trong callback MoMo không khớp hóa đơn",
        400,
        "MOMO_AMOUNT_MISMATCH",
      );
    }
  }

  private safeMomoCallback(
    callback: VerifiedMomoCallback,
  ): Prisma.InputJsonObject {
    return {
      provider: "MOMO",
      partnerCode: callback.partnerCode,
      orderId: callback.orderId,
      requestId: callback.requestId,
      amount: callback.amount,
      resultCode: callback.resultCode,
      message: callback.message,
      transId: callback.transId,
      responseTime: callback.responseTime,
    };
  }

  private async generateUniqueTransactionCode(tx: Prisma.TransactionClient) {
    for (let index = 0; index < 10; index += 1) {
      const transactionCode = generatePaymentTransactionCode();
      const existing = await tx.paymentTransaction.findUnique({
        where: { transactionCode },
        select: { id: true },
      });

      if (!existing) {
        return transactionCode;
      }
    }

    throw new AppError("Không thể tạo mã giao dịch thanh toán", 500);
  }
}

export default new PaymentService();
