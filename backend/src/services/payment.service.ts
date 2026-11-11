import { Prisma } from "../../generated/prisma/client.js";
import type {
  PaymentMethod,
  PaymentProvider,
} from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { getReconciliationConcurrency } from "../config/environment.js";
import { AppError } from "../utils/appError.js";
import { mapWithConcurrency } from "../utils/concurrency.js";
import { generatePaymentTransactionCode } from "../utils/paymentCode.js";
import {
  assertPaymentProviderAvailable,
  getPaymentProviderAdapter,
  getPaymentProviderCapabilities,
  getVnpayConfigurationStatus,
  parseVerifiedVnpayCallback,
  queryVnpayTransaction,
} from "./paymentProviders/index.js";
import PatientEventNotificationService from "./patientEventNotification.service.js";

const PAYMENT_EXPIRES_MINUTES = 15;
// Chỉ đối soát giao dịch đã treo đủ lâu để Return URL/IPN bình thường kịp tới trước.
const RECONCILE_MIN_AGE_MS = 2 * 60 * 1000;
// Chờ thêm sau hạn thanh toán trước khi kết luận giao dịch hết hạn.
const RECONCILE_EXPIRY_GRACE_MS = 2 * 60 * 1000;
// Giới hạn tần suất gọi VNPAY khi người dùng liên tục tải lại trang kết quả.
const RECONCILE_THROTTLE_MS = 30 * 1000;

export type VnpayReconcileOutcome =
  | "PAID"
  | "FAILED"
  | "EXPIRED"
  | "PENDING"
  | "UNKNOWN"
  | "SKIPPED";

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

const providerTransactionSelect = {
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
} satisfies Prisma.PaymentTransactionSelect;

class PaymentService {
  async createForInvoice(
    invoiceId: string,
    input: CreatePaymentTransactionInput,
    patientId: string,
    idempotencyKey?: string,
    ipAddress?: string,
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
        ipAddress,
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

  // Dùng chung cho Return URL và IPN của VNPAY. Chữ ký đã được xác thực
  // trong parseVerifiedVnpayCallback trước khi chạm vào dữ liệu.
  async handleVnpayCallback(query: Record<string, unknown>) {
    const callback = parseVerifiedVnpayCallback(query);
    const transaction = await prisma.paymentTransaction.findFirst({
      where: { transactionCode: callback.txnRef, provider: "VNPAY" },
      select: providerTransactionSelect,
    });
    if (!transaction) {
      throw new AppError(
        "Không tìm thấy giao dịch VNPAY",
        404,
        "VNPAY_TRANSACTION_NOT_FOUND",
      );
    }
    if (
      callback.amount !== transaction.amount ||
      callback.amount !== transaction.invoice.finalAmount
    ) {
      throw new AppError(
        "Số tiền VNPAY không khớp hóa đơn",
        400,
        "VNPAY_AMOUNT_MISMATCH",
      );
    }

    const result = await this.applyProviderOutcome({
      transaction,
      outcome: callback.isSuccess ? "SUCCESS" : "FAILED",
      amount: callback.amount,
      providerReference: callback.transactionNo ?? callback.txnRef,
      paymentMethod: "VNPAY",
      providerLabel: "VNPAY",
      safeResponse: {
        provider: "VNPAY",
        txnRef: callback.txnRef,
        amount: callback.amount,
        responseCode: callback.responseCode,
        transactionStatus: callback.transactionStatus,
        transactionNo: callback.transactionNo,
        bankCode: callback.bankCode,
        payDate: callback.payDate,
      },
    });
    return { transaction: result, callback };
  }

  // Áp kết quả đã xác thực từ cổng thanh toán vào giao dịch + hóa đơn.
  // Idempotent: gọi lại nhiều lần (IPN retry, người dùng tải lại Return URL)
  // chỉ ghi nhận thanh toán đúng một lần.
  private async applyProviderOutcome(input: {
    transaction: Prisma.PaymentTransactionGetPayload<{
      select: typeof providerTransactionSelect;
    }>;
    outcome: "PENDING" | "SUCCESS" | "FAILED";
    amount: number;
    providerReference: string;
    paymentMethod: PaymentMethod;
    providerLabel: string;
    safeResponse: Prisma.InputJsonObject;
  }) {
    const { transaction, safeResponse } = input;
    if (input.outcome === "PENDING") {
      if (transaction.status === "PENDING") {
        await prisma.paymentTransaction.update({
          where: { id: transaction.id },
          data: { rawResponse: safeResponse },
        });
      }
      return this.getById(transaction.id, transaction.invoice.patientId);
    }

    if (input.outcome === "FAILED") {
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
          amount: input.amount,
        },
        data: {
          status: "SUCCESS",
          activeKey: null,
          paidAt,
          providerOrderId: input.providerReference,
          rawResponse: safeResponse,
        },
      });
      if (claimed.count !== 1) return { notificationId: null };

      const invoiceUpdated = await tx.invoice.updateMany({
        where: {
          id: transaction.invoice.id,
          status: "UNPAID",
          finalAmount: input.amount,
        },
        data: {
          status: "PAID",
          paymentMethod: input.paymentMethod,
          paymentReference: input.providerReference,
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
          currentInvoice.finalAmount !== input.amount
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
          note: `${input.providerLabel} xác nhận thanh toán · ${input.providerReference}`,
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

  private readonly lastVnpayQueryAt = new Map<string, number>();

  // Đối soát một giao dịch VNPAY còn PENDING bằng API querydr. Dùng khi Return URL và
  // IPN đều không tới (ví dụ máy chủ đang ngủ). Kết quả đi qua cùng hàm áp dụng
  // idempotent như callback nên không thể ghi nhận thanh toán hai lần.
  async reconcileVnpayTransaction(
    transactionId: string,
    now = new Date(),
  ): Promise<{ outcome: VnpayReconcileOutcome }> {
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
      select: {
        ...providerTransactionSelect,
        provider: true,
        expiredAt: true,
        rawRequest: true,
      },
    });
    if (
      !transaction ||
      transaction.provider !== "VNPAY" ||
      transaction.status !== "PENDING"
    ) {
      return { outcome: "SKIPPED" };
    }

    const request = transaction.rawRequest as Record<string, unknown> | null;
    const transactionDate =
      typeof request?.vnp_CreateDate === "string" ? request.vnp_CreateDate : null;
    if (!transactionDate) return { outcome: "UNKNOWN" };

    const query = await queryVnpayTransaction({
      txnRef: transaction.transactionCode,
      transactionDate,
    });

    if (query.outcome === "PAID" || query.outcome === "FAILED") {
      if (
        query.amount !== transaction.amount ||
        transaction.amount !== transaction.invoice.finalAmount
      ) {
        throw new AppError(
          "Số tiền VNPAY không khớp hóa đơn",
          400,
          "VNPAY_AMOUNT_MISMATCH",
        );
      }
      await this.applyProviderOutcome({
        transaction,
        outcome: query.outcome === "PAID" ? "SUCCESS" : "FAILED",
        amount: query.amount,
        providerReference: query.transactionNo ?? transaction.transactionCode,
        paymentMethod: "VNPAY",
        providerLabel: "VNPAY",
        safeResponse: {
          provider: "VNPAY",
          source: "QUERYDR",
          txnRef: transaction.transactionCode,
          amount: query.amount,
          responseCode: query.responseCode,
          transactionStatus: query.transactionStatus,
          transactionNo: query.transactionNo,
          bankCode: query.bankCode,
          payDate: query.payDate,
        },
      });
      return { outcome: query.outcome };
    }

    if (query.outcome === "NOT_FOUND" || query.outcome === "PENDING") {
      const expired =
        now.getTime() >= transaction.expiredAt.getTime() + RECONCILE_EXPIRY_GRACE_MS;
      if (!expired) return { outcome: "PENDING" };
      const result = await prisma.paymentTransaction.updateMany({
        where: { id: transaction.id, status: "PENDING" },
        data: { status: "EXPIRED", activeKey: null },
      });
      return { outcome: result.count === 1 ? "EXPIRED" : "SKIPPED" };
    }

    return { outcome: "UNKNOWN" };
  }

  // Quét các giao dịch VNPAY treo PENDING; mỗi giao dịch lỗi không cản các giao dịch khác.
  async reconcilePendingVnpay(options: { limit?: number; now?: Date } = {}) {
    const summary = {
      scanned: 0,
      paid: 0,
      failed: 0,
      expired: 0,
      pending: 0,
      errors: 0,
    };
    const vnpay = getVnpayConfigurationStatus();
    if (!vnpay.enabled || !vnpay.configured) return summary;

    const now = options.now ?? new Date();
    const candidates = await prisma.paymentTransaction.findMany({
      where: {
        provider: "VNPAY",
        status: "PENDING",
        createdAt: { lte: new Date(now.getTime() - RECONCILE_MIN_AGE_MS) },
      },
      orderBy: { createdAt: "asc" },
      take: options.limit ?? 50,
      select: { id: true },
    });

    const results = await mapWithConcurrency(
      candidates,
      getReconciliationConcurrency(),
      async (candidate) => {
        try {
          const { outcome } = await this.reconcileVnpayTransaction(candidate.id, now);
          return { outcome, error: false };
        } catch (error) {
          console.error(
            "[PAYMENT_RECONCILIATION]",
            candidate.id,
            error instanceof AppError ? (error.code ?? error.message) : error,
          );
          return { outcome: "UNKNOWN" as const, error: true };
        }
      },
    );

    summary.scanned = results.length;
    for (const { outcome, error } of results) {
      if (error) {
        summary.errors += 1;
      } else {
        if (outcome === "PAID") summary.paid += 1;
        else if (outcome === "FAILED") summary.failed += 1;
        else if (outcome === "EXPIRED") summary.expired += 1;
        else summary.pending += 1;
      }
    }
    return summary;
  }

  // Như getById nhưng nếu giao dịch VNPAY còn PENDING quá lâu thì đối soát ngay, để người
  // dùng mở lại trang kết quả là thấy trạng thái đúng mà không chờ lần quét định kỳ.
  async getByIdWithReconciliation(id: string, patientId: string) {
    const transaction = await this.getById(id, patientId);
    const vnpay = getVnpayConfigurationStatus();
    const lastQuery = this.lastVnpayQueryAt.get(id) ?? 0;
    if (
      transaction.provider !== "VNPAY" ||
      transaction.status !== "PENDING" ||
      !vnpay.enabled ||
      !vnpay.configured ||
      Date.now() - transaction.createdAt.getTime() < RECONCILE_MIN_AGE_MS ||
      Date.now() - lastQuery < RECONCILE_THROTTLE_MS
    ) {
      return transaction;
    }
    this.lastVnpayQueryAt.set(id, Date.now());
    try {
      await this.reconcileVnpayTransaction(id);
    } catch (error) {
      // Đối soát chỉ là tối ưu: lỗi mạng tới VNPAY không được làm hỏng việc xem giao dịch.
      console.error(
        "[PAYMENT_RECONCILIATION]",
        id,
        error instanceof AppError ? (error.code ?? error.message) : error,
      );
    }
    return this.getById(id, patientId);
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
