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
} from "./paymentProviders/index.js";

const PAYMENT_EXPIRES_MINUTES = 15;

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
    const activeKey = `${invoiceId}:${input.provider}`;
    const now = new Date();
    let reservation;
    try {
      reservation = await prisma.$transaction(async (tx) => {
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

  async getById(id: string, patientId: string) {
    const transaction = await prisma.paymentTransaction.findFirst({
      where: { id, invoice: { patientId } },
      select: paymentTransactionSelect,
    });

    if (!transaction) {
      throw new AppError("Không tìm thấy giao dịch thanh toán", 404);
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
        provider: true,
        status: true,
        amount: true,
        expiredAt: true,
        invoice: {
          select: {
            status: true,
            finalAmount: true,
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

    return prisma.$transaction(async (tx) => {
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

        return tx.paymentTransaction.findUniqueOrThrow({
          where: { id: transaction.id },
          select: paymentTransactionSelect,
        });
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

      return tx.paymentTransaction.findUniqueOrThrow({
        where: {
          id: transaction.id,
        },
        select: paymentTransactionSelect,
      });
    });
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
        status: true,
      },
    });

    if (!transaction) {
      throw new AppError("Không tìm thấy giao dịch thanh toán", 404);
    }

    if (transaction.status !== "PENDING") {
      throw new AppError("Chỉ có thể hủy giao dịch đang chờ thanh toán", 400);
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
