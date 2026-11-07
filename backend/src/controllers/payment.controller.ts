import type { Request, Response, NextFunction } from "express";
import PaymentService from "../services/payment.service.js";
import { AppError } from "../utils/appError.js";

const getParam = (value: string | string[] | undefined, name = "id") => {
  const param = Array.isArray(value) ? value[0] : value;

  if (!param) {
    throw new AppError(`Thiếu ${name}`, 400);
  }

  return param;
};

export const paymentProviderWebhookHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const provider = getParam(req.params.provider, "provider").toUpperCase();
    if (provider !== "MOMO") {
      throw new AppError(
        "Nhà cung cấp chưa hỗ trợ webhook",
        404,
        "PAYMENT_PROVIDER_UNAVAILABLE",
      );
    }
    const payload =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};
    await PaymentService.handleMomoWebhook(payload);

    // MoMo expects an HTTP 200 acknowledgement. Do not expose the internal
    // transaction or patient data on this public provider callback.
    return res.status(200).json({
      partnerCode: process.env.MOMO_PARTNER_CODE,
      requestId: payload.requestId ?? "",
      orderId: payload.orderId ?? "",
      resultCode: 0,
      message: "Callback received successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const paymentProviderReturnHandler = async (
  req: Request,
  res: Response,
) => {
  return res.status(200).json({
    success: true,
    message:
      "Đã quay lại từ cổng thanh toán. Vui lòng kiểm tra trạng thái giao dịch trong ứng dụng; kết quả cuối cùng được xác nhận qua IPN.",
    data: {
      provider: getParam(req.params.provider, "provider").toUpperCase(),
      orderId: typeof req.query.orderId === "string" ? req.query.orderId : null,
    },
  });
};

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
