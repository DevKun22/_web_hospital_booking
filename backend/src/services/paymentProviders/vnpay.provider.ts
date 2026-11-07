import crypto from "crypto";
import { AppError } from "../../utils/appError.js";
import type { PaymentProviderAdapter } from "./types.js";

// Tích hợp VNPAY Payment Gateway v2.1.0 (sandbox/production theo env).
// Tài liệu: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html

const DEFAULT_PAYMENT_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

const vnpayRequiredConfigurationKeys = [
  "VNPAY_TMN_CODE",
  "VNPAY_HASH_SECRET",
  "VNPAY_RETURN_URL",
] as const;

const isEnabled = (value?: string) =>
  ["true", "1", "yes", "on"].includes((value || "").toLowerCase());

export const getVnpayConfigurationStatus = (
  env: NodeJS.ProcessEnv = process.env,
) => {
  const missing = vnpayRequiredConfigurationKeys.filter(
    (key) => !env[key]?.trim(),
  );
  return {
    enabled: isEnabled(env.PAYMENT_VNPAY_ENABLED),
    configured: missing.length === 0,
    missing,
  };
};

const requiredEnv = (key: (typeof vnpayRequiredConfigurationKeys)[number]) => {
  const value = process.env[key]?.trim();
  if (!value) throw new AppError(`Chưa cấu hình biến môi trường ${key}`, 500);
  return value;
};

// VNPAY ký trên chuỗi query: key sắp xếp tăng dần, value encodeURIComponent
// với khoảng trắng thành "+" (đúng như code mẫu chính thức của VNPAY).
const encodeValue = (value: string) =>
  encodeURIComponent(value).replace(/%20/g, "+");

const buildSignData = (params: Record<string, string>) =>
  Object.keys(params)
    .sort()
    .map((key) => `${key}=${encodeValue(params[key])}`)
    .join("&");

const sign = (data: string, secret: string) =>
  crypto.createHmac("sha512", secret).update(Buffer.from(data, "utf-8")).digest("hex");

// Định dạng yyyyMMddHHmmss theo giờ Việt Nam (GMT+7) mà VNPAY yêu cầu.
const formatVnpayDate = (date: Date) => {
  const vn = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    vn.getUTCFullYear().toString() +
    pad(vn.getUTCMonth() + 1) +
    pad(vn.getUTCDate()) +
    pad(vn.getUTCHours()) +
    pad(vn.getUTCMinutes()) +
    pad(vn.getUTCSeconds())
  );
};

// VNPAY chỉ nhận OrderInfo tiếng Việt không dấu, không ký tự đặc biệt.
const toAsciiOrderInfo = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);

// VNPAY chỉ nhận IPv4. Express có thể trả "::ffff:1.2.3.4" hoặc IPv6 thuần;
// bỏ tiền tố ánh xạ IPv4, còn lại không hợp lệ thì dùng địa chỉ mặc định.
export const normalizeVnpayIp = (value?: string) => {
  const ip = (value || "").trim().replace(/^::ffff:/i, "");
  return /^(\d{1,3})(\.\d{1,3}){3}$/.test(ip) &&
    ip.split(".").every((part) => Number(part) <= 255)
    ? ip
    : "127.0.0.1";
};

export const vnpayPaymentProvider: PaymentProviderAdapter = {
  provider: "VNPAY",

  async createPayment(input) {
    const tmnCode = requiredEnv("VNPAY_TMN_CODE");
    const secret = requiredEnv("VNPAY_HASH_SECRET");
    const returnUrl = requiredEnv("VNPAY_RETURN_URL");
    const paymentUrl = process.env.VNPAY_PAYMENT_URL?.trim() || DEFAULT_PAYMENT_URL;

    const params: Record<string, string> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode,
      vnp_Amount: String(input.amount * 100),
      vnp_CurrCode: "VND",
      vnp_TxnRef: input.transactionCode,
      vnp_OrderInfo: toAsciiOrderInfo(input.orderInfo),
      vnp_OrderType: "other",
      vnp_Locale: "vn",
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: normalizeVnpayIp(input.ipAddress),
      vnp_CreateDate: formatVnpayDate(new Date()),
      vnp_ExpireDate: formatVnpayDate(input.expiredAt),
    };

    const signData = buildSignData(params);
    const secureHash = sign(signData, secret);
    const url = `${paymentUrl}?${signData}&vnp_SecureHash=${secureHash}`;

    return {
      providerOrderId: input.transactionCode,
      paymentUrl: url,
      rawRequest: { ...params },
      rawResponse: { mode: "REDIRECT" },
    };
  },
};

export type VerifiedVnpayCallback = {
  txnRef: string;
  amount: number;
  responseCode: string;
  transactionStatus: string | null;
  transactionNo: string | null;
  bankCode: string | null;
  payDate: string | null;
  isSuccess: boolean;
};

// Xác thực chữ ký của dữ liệu VNPAY gửi về (Return URL hoặc IPN).
export const parseVerifiedVnpayCallback = (
  query: Record<string, unknown>,
): VerifiedVnpayCallback => {
  const secret = requiredEnv("VNPAY_HASH_SECRET");
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (!key.startsWith("vnp_") || typeof value !== "string") continue;
    if (key === "vnp_SecureHash" || key === "vnp_SecureHashType") continue;
    params[key] = value;
  }

  const received = String(query.vnp_SecureHash || "").toLowerCase();
  const expected = sign(buildSignData(params), secret);
  const isValid =
    received.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  if (!isValid) {
    throw new AppError("Chữ ký VNPAY không hợp lệ", 400, "VNPAY_INVALID_SIGNATURE");
  }

  if (params.vnp_TmnCode !== requiredEnv("VNPAY_TMN_CODE")) {
    throw new AppError("Callback không thuộc merchant VNPAY đã cấu hình", 400, "VNPAY_MERCHANT_MISMATCH");
  }

  const rawAmount = Number(params.vnp_Amount);
  if (!params.vnp_TxnRef || !Number.isSafeInteger(rawAmount) || rawAmount % 100 !== 0) {
    throw new AppError("Dữ liệu callback VNPAY không hợp lệ", 400, "VNPAY_INVALID_CALLBACK");
  }

  const responseCode = params.vnp_ResponseCode || "";
  const transactionStatus = params.vnp_TransactionStatus ?? null;
  return {
    txnRef: params.vnp_TxnRef,
    amount: rawAmount / 100,
    responseCode,
    transactionStatus,
    transactionNo: params.vnp_TransactionNo || null,
    bankCode: params.vnp_BankCode || null,
    payDate: params.vnp_PayDate || null,
    isSuccess: responseCode === "00" && (transactionStatus === null || transactionStatus === "00"),
  };
};
