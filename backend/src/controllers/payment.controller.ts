import type { Request, Response } from "express";
import PaymentService from "../services/payment.service.js";
import { AppError } from "../utils/appError.js";

const getPaymentResultUrl = () =>
  process.env.PAYMENT_RESULT_URL?.trim() ||
  `${(process.env.FRONTEND_URL || "http://localhost:3000").split(",")[0].trim()}/thanh-toan/ket-qua`;

// Trình duyệt người dùng được VNPAY chuyển về đây. Dữ liệu có chữ ký nên
// backend xác thực và ghi nhận ngay, sau đó chuyển sang trang kết quả web.
export const vnpayReturnHandler = async (req: Request, res: Response) => {
  const resultUrl = new URL(getPaymentResultUrl());
  resultUrl.searchParams.set("provider", "VNPAY");
  try {
    const query = req.query as Record<string, unknown>;
    const { callback } = await PaymentService.handleVnpayCallback(query);
    resultUrl.searchParams.set("orderId", callback.txnRef);
    resultUrl.searchParams.set("status", callback.isSuccess ? "success" : "failed");
  } catch (error) {
    console.warn("[VNPAY_RETURN]", error instanceof Error ? error.message : error);
    resultUrl.searchParams.set("status", "error");
  }
  return res.redirect(302, resultUrl.toString());
};

// IPN: VNPAY gọi server-to-server (GET) và chờ phản hồi theo mã RspCode.
export const vnpayIpnHandler = async (req: Request, res: Response) => {
  try {
    await PaymentService.handleVnpayCallback(req.query as Record<string, unknown>);
    return res.status(200).json({ RspCode: "00", Message: "Confirm Success" });
  } catch (error) {
    const code = error instanceof AppError ? error.code : undefined;
    const rspCode =
      code === "VNPAY_INVALID_SIGNATURE"
        ? "97"
        : code === "VNPAY_TRANSACTION_NOT_FOUND"
          ? "01"
          : code === "VNPAY_AMOUNT_MISMATCH"
            ? "04"
            : code === "PAYMENT_STATE_CONFLICT" || code === "INVOICE_STATE_CONFLICT"
              ? "02"
              : "99";
    console.warn("[VNPAY_IPN]", rspCode, error instanceof Error ? error.message : error);
    return res.status(200).json({ RspCode: rspCode, Message: "Not confirmed" });
  }
};
