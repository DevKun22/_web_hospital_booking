import { randomBytes } from "node:crypto";
import { writeAppointmentLog } from "./appointmentLog.service.js";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { normalizeOptionalString } from "../utils/text.js";
import AuditLogService from "./auditLog.service.js";
import PatientEventNotificationService from "./patientEventNotification.service.js";
import StaffNotificationService from "./staffNotification.service.js";
import { invoiceSelect } from "./invoice.shared.js";
import { refundVnpayTransaction } from "./paymentProviders/index.js";

// Hoàn tiền toàn phần của hóa đơn (ghi nhận thủ công hoặc qua API VNPAY). Hoàn tiền thuốc một phần nằm ở
// invoiceMedicine.service.ts; lập, thu, hủy hóa đơn nằm ở invoice.service.ts.
type RefundInvoiceInput = {
  refundReason: string;
  refundReference?: string | null;
};

class InvoiceRefundService {
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
      await writeAppointmentLog(tx, {
        appointmentId: invoice.appointmentId,
        action: "PAYMENT_REFUNDED",
        note: `Hoàn tiền: ${input.refundReason.trim()}${refundReference ? ` · ${refundReference}` : ""}`,
        actorId,
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
}

export default new InvoiceRefundService();
