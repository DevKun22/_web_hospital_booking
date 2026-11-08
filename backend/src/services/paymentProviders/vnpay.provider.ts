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

// ---------------------------------------------------------------------------
// Truy vấn kết quả giao dịch (querydr) để đối soát chủ động khi Return URL và IPN
// đều không tới. Đặc tả: VNPAY API 2.1.0, POST JSON, chữ ký HMAC-SHA512 trên các
// trường nối bằng "|" (khác với chữ ký query của luồng thanh toán).
// ---------------------------------------------------------------------------

const DEFAULT_QUERY_URL = "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction";
const QUERY_TIMEOUT_MS = 10_000;

const joinHashFields = (values: Array<string | number | undefined | null>) =>
  values.map((value) => (value === undefined || value === null ? "" : String(value))).join("|");

const safeEqualHex = (received: string, expected: string) =>
  received.length === expected.length &&
  crypto.timingSafeEqual(Buffer.from(received.toLowerCase()), Buffer.from(expected.toLowerCase()));

export type VnpayQueryOutcome = "PAID" | "FAILED" | "PENDING" | "NOT_FOUND" | "UNKNOWN";

export type VerifiedVnpayQuery = {
  outcome: VnpayQueryOutcome;
  responseCode: string;
  transactionStatus: string | null;
  amount: number | null;
  transactionNo: string | null;
  bankCode: string | null;
  payDate: string | null;
};

// vnp_ResponseCode là kết quả của chính lệnh truy vấn; vnp_TransactionStatus mới là
// trạng thái giao dịch thanh toán: 00 thành công, 01 chưa hoàn tất, 02 lỗi. Các trạng
// thái đảo/hoàn tiền (04..09) không được tự động xử lý nên trả UNKNOWN.
export const interpretVnpayQuery = (
  responseCode: string,
  transactionStatus: string | null,
): VnpayQueryOutcome => {
  if (responseCode === "91") return "NOT_FOUND";
  if (responseCode !== "00") return "UNKNOWN";
  if (transactionStatus === "00") return "PAID";
  if (transactionStatus === "01") return "PENDING";
  if (transactionStatus === "02") return "FAILED";
  return "UNKNOWN";
};

export const queryVnpayTransaction = async (
  input: { txnRef: string; transactionDate: string; ipAddress?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<VerifiedVnpayQuery> => {
  const tmnCode = requiredEnv("VNPAY_TMN_CODE");
  const secret = requiredEnv("VNPAY_HASH_SECRET");
  const url = process.env.VNPAY_QUERY_URL?.trim() || DEFAULT_QUERY_URL;

  const requestId = crypto.randomUUID().replace(/-/g, "");
  const orderInfo = toAsciiOrderInfo(`Truy van giao dich ${input.txnRef}`);
  const createDate = formatVnpayDate(new Date());
  const ipAddr = normalizeVnpayIp(input.ipAddress);
  const body = {
    vnp_RequestId: requestId,
    vnp_Version: "2.1.0",
    vnp_Command: "querydr",
    vnp_TmnCode: tmnCode,
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: orderInfo,
    vnp_TransactionDate: input.transactionDate,
    vnp_CreateDate: createDate,
    vnp_IpAddr: ipAddr,
    vnp_SecureHash: sign(
      joinHashFields([
        requestId,
        "2.1.0",
        "querydr",
        tmnCode,
        input.txnRef,
        input.transactionDate,
        createDate,
        ipAddr,
        orderInfo,
      ]),
      secret,
    ),
  };

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
    });
  } catch {
    throw new AppError("Không kết nối được VNPAY để truy vấn giao dịch", 502, "VNPAY_QUERY_UNAVAILABLE");
  }
  if (!response.ok) {
    throw new AppError(`VNPAY truy vấn trả HTTP ${response.status}`, 502, "VNPAY_QUERY_UNAVAILABLE");
  }

  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!data || typeof data !== "object") {
    throw new AppError("Phản hồi truy vấn VNPAY không hợp lệ", 502, "VNPAY_QUERY_INVALID");
  }
  const field = (key: string) =>
    data[key] === undefined || data[key] === null ? undefined : String(data[key]);

  const expected = sign(
    joinHashFields([
      field("vnp_ResponseId"),
      field("vnp_Command"),
      field("vnp_ResponseCode"),
      field("vnp_Message"),
      tmnCode,
      field("vnp_TxnRef"),
      field("vnp_Amount"),
      field("vnp_BankCode"),
      field("vnp_PayDate"),
      field("vnp_TransactionNo"),
      field("vnp_TransactionType"),
      field("vnp_TransactionStatus"),
      field("vnp_OrderInfo"),
      field("vnp_PromotionCode"),
      field("vnp_PromotionAmount"),
    ]),
    secret,
  );
  const received = field("vnp_SecureHash") || "";
  if (!safeEqualHex(received, expected)) {
    throw new AppError("Chữ ký phản hồi truy vấn VNPAY không hợp lệ", 502, "VNPAY_INVALID_SIGNATURE");
  }
  // Phản hồi hợp lệ nhưng thuộc giao dịch khác thì không được dùng.
  if (field("vnp_TxnRef") && field("vnp_TxnRef") !== input.txnRef) {
    throw new AppError("Phản hồi truy vấn VNPAY không khớp giao dịch", 502, "VNPAY_QUERY_INVALID");
  }

  const responseCode = field("vnp_ResponseCode") || "";
  const transactionStatus = field("vnp_TransactionStatus") ?? null;
  const rawAmount = Number(field("vnp_Amount"));
  return {
    outcome: interpretVnpayQuery(responseCode, transactionStatus),
    responseCode,
    transactionStatus,
    amount: Number.isSafeInteger(rawAmount) && rawAmount % 100 === 0 ? rawAmount / 100 : null,
    transactionNo: field("vnp_TransactionNo") || null,
    bankCode: field("vnp_BankCode") || null,
    payDate: field("vnp_PayDate") || null,
  };
};

// ---------------------------------------------------------------------------
// Hoàn tiền (refund) toàn phần qua API VNPAY 2.1.0. Cùng endpoint và cách ký với querydr.
// Hoàn tiền là thao tác không đảo ngược: mọi kết quả không xác minh được (mất mạng, HTTP
// lỗi, chữ ký phản hồi sai) phải báo "chưa xác nhận" chứ không được coi là bị từ chối,
// vì tiền có thể đã được hoàn.
// ---------------------------------------------------------------------------

export type VnpayRefundResult =
  | {
      outcome: "ACCEPTED";
      responseCode: string;
      refundTransactionNo: string | null;
      transactionStatus: string | null;
    }
  | { outcome: "REJECTED"; responseCode: string; message: string };

const REFUND_REJECT_MESSAGES: Record<string, string> = {
  "02": "Mã merchant VNPAY không hợp lệ",
  "03": "VNPAY không nhận dữ liệu yêu cầu hoàn tiền",
  "91": "VNPAY không tìm thấy giao dịch cần hoàn",
  "94": "Yêu cầu hoàn tiền bị trùng trong thời gian ngắn",
  "95": "VNPAY từ chối hoàn tiền giao dịch này",
  "97": "VNPAY báo chữ ký yêu cầu không hợp lệ",
};

export const refundVnpayTransaction = async (
  input: {
    requestId: string;
    txnRef: string;
    amount: number;
    transactionNo: string;
    transactionDate: string;
    createBy: string;
    reason: string;
    ipAddress?: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<VnpayRefundResult> => {
  const tmnCode = requiredEnv("VNPAY_TMN_CODE");
  const secret = requiredEnv("VNPAY_HASH_SECRET");
  const url = process.env.VNPAY_QUERY_URL?.trim() || DEFAULT_QUERY_URL;

  const orderInfo = toAsciiOrderInfo(input.reason) || "Hoan tien";
  const createDate = formatVnpayDate(new Date());
  const ipAddr = normalizeVnpayIp(input.ipAddress);
  const createBy = toAsciiOrderInfo(input.createBy).slice(0, 245) || "system";
  const amount = String(input.amount * 100);
  const body = {
    vnp_RequestId: input.requestId,
    vnp_Version: "2.1.0",
    vnp_Command: "refund",
    vnp_TmnCode: tmnCode,
    vnp_TransactionType: "02",
    vnp_TxnRef: input.txnRef,
    vnp_Amount: Number(amount),
    vnp_OrderInfo: orderInfo,
    vnp_TransactionNo: input.transactionNo,
    vnp_TransactionDate: input.transactionDate,
    vnp_CreateBy: createBy,
    vnp_CreateDate: createDate,
    vnp_IpAddr: ipAddr,
    vnp_SecureHash: sign(
      joinHashFields([
        input.requestId,
        "2.1.0",
        "refund",
        tmnCode,
        "02",
        input.txnRef,
        amount,
        input.transactionNo,
        input.transactionDate,
        createBy,
        createDate,
        ipAddr,
        orderInfo,
      ]),
      secret,
    ),
  };

  const unverified = (detail: string) =>
    new AppError(
      `Chưa xác nhận được kết quả hoàn tiền từ VNPAY (${detail}). Hãy kiểm tra trên cổng quản trị VNPAY trước khi thử lại.`,
      502,
      "VNPAY_REFUND_UNVERIFIED",
    );

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS * 2),
    });
  } catch {
    throw unverified("không kết nối được");
  }
  if (!response.ok) throw unverified(`HTTP ${response.status}`);

  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!data || typeof data !== "object") throw unverified("phản hồi không hợp lệ");
  const field = (key: string) =>
    data[key] === undefined || data[key] === null ? undefined : String(data[key]);

  const expected = sign(
    joinHashFields([
      field("vnp_ResponseId"),
      field("vnp_Command"),
      field("vnp_ResponseCode"),
      field("vnp_Message"),
      field("vnp_TmnCode"),
      field("vnp_TxnRef"),
      field("vnp_Amount"),
      field("vnp_BankCode"),
      field("vnp_PayDate"),
      field("vnp_TransactionNo"),
      field("vnp_TransactionType"),
      field("vnp_TransactionStatus"),
      field("vnp_OrderInfo"),
    ]),
    secret,
  );
  if (!safeEqualHex(field("vnp_SecureHash") || "", expected)) {
    throw unverified("chữ ký phản hồi không hợp lệ");
  }
  if (field("vnp_TxnRef") && field("vnp_TxnRef") !== input.txnRef) {
    throw unverified("phản hồi không khớp giao dịch");
  }

  const responseCode = field("vnp_ResponseCode") || "";
  const transactionStatus = field("vnp_TransactionStatus") ?? null;
  // Trạng thái 09: VNPAY đã nhận yêu cầu nhưng từ chối hoàn trả (xử lý ngay bên dưới).
  if (responseCode === "00" && transactionStatus !== "09") {
    return {
      outcome: "ACCEPTED",
      responseCode,
      refundTransactionNo: field("vnp_TransactionNo") || null,
      transactionStatus,
    };
  }
  if (responseCode === "00") {
    return {
      outcome: "REJECTED",
      responseCode: "00/09",
      message: "VNPAY từ chối hoàn trả giao dịch này",
    };
  }
  // Mã khác 00 được ký hợp lệ nhưng không thuộc danh sách từ chối đã biết (ví dụ 99 lỗi
  // hệ thống) thì chưa chắc đã hoàn hay chưa: coi là chưa xác nhận.
  if (!REFUND_REJECT_MESSAGES[responseCode]) {
    throw unverified(`mã ${responseCode || "không rõ"}`);
  }
  return {
    outcome: "REJECTED",
    responseCode,
    message: REFUND_REJECT_MESSAGES[responseCode],
  };
};
