import crypto from "crypto";
import type { Prisma } from "../../../generated/prisma/client.js";
import { AppError } from "../../utils/appError.js";
import type { PaymentProviderAdapter } from "./types.js";

type MomoCreateResponse = {
  payUrl?: string;
  deeplink?: string;
  qrCodeUrl?: string;
  orderId?: string;
  requestId?: string;
  resultCode?: number;
  message?: string;
  [key: string]: unknown;
};

export type VerifiedMomoCallback = {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  resultCode: number;
  message: string;
  transId: string | null;
  responseTime: string | null;
};

const momoRequiredConfigurationKeys = [
  "MOMO_PARTNER_CODE",
  "MOMO_ACCESS_KEY",
  "MOMO_SECRET_KEY",
  "MOMO_REDIRECT_URL",
  "MOMO_IPN_URL",
] as const;

const isEnabled = (value?: string) =>
  ["true", "1", "yes", "on"].includes((value || "").toLowerCase());

export const getMomoConfigurationStatus = (
  env: NodeJS.ProcessEnv = process.env,
) => {
  const missing = momoRequiredConfigurationKeys.filter(
    (key) => !env[key]?.trim(),
  );
  return {
    enabled: isEnabled(env.PAYMENT_MOMO_ENABLED),
    configured: missing.length === 0,
    missing,
  };
};

const requiredEnv = (key: string) => {
  const value = process.env[key];

  if (!value) {
    throw new AppError(`Chưa cấu hình biến môi trường ${key}`, 500);
  }

  return value;
};

const optionalEnv = (key: string, fallback: string) =>
  process.env[key] || fallback;

const signMomo = (rawSignature: string, secretKey: string) =>
  crypto.createHmac("sha256", secretKey).update(rawSignature).digest("hex");

export const momoPaymentProvider: PaymentProviderAdapter = {
  provider: "MOMO",

  async createPayment(input) {
    const partnerCode = requiredEnv("MOMO_PARTNER_CODE");
    const accessKey = requiredEnv("MOMO_ACCESS_KEY");
    const secretKey = requiredEnv("MOMO_SECRET_KEY");
    const endpoint = optionalEnv(
      "MOMO_ENDPOINT",
      "https://test-payment.momo.vn/v2/gateway/api/create",
    );
    const redirectUrl = requiredEnv("MOMO_REDIRECT_URL");
    const ipnUrl = requiredEnv("MOMO_IPN_URL");
    const requestType = process.env.MOMO_REQUEST_TYPE || "captureWallet";
    const lang = process.env.MOMO_LANG || "vi";
    const extraData = "";
    const orderId = input.transactionCode;
    const requestId = input.transactionCode;

    const rawSignature = [
      `accessKey=${accessKey}`,
      `amount=${input.amount}`,
      `extraData=${extraData}`,
      `ipnUrl=${ipnUrl}`,
      `orderId=${orderId}`,
      `orderInfo=${input.orderInfo}`,
      `partnerCode=${partnerCode}`,
      `redirectUrl=${redirectUrl}`,
      `requestId=${requestId}`,
      `requestType=${requestType}`,
    ].join("&");
    const signature = signMomo(rawSignature, secretKey);

    const requestBody = {
      partnerCode,
      partnerName: process.env.MOMO_PARTNER_NAME || "Hospital Booking",
      storeId: process.env.MOMO_STORE_ID || "HospitalBooking",
      requestId,
      amount: input.amount,
      orderId,
      orderInfo: input.orderInfo,
      redirectUrl,
      ipnUrl,
      lang,
      requestType,
      autoCapture: true,
      extraData,
      signature,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    const responseBody = (await response.json()) as MomoCreateResponse;

    if (!response.ok || responseBody.resultCode !== 0 || !responseBody.payUrl) {
      throw new AppError(
        responseBody.message || "MoMo không tạo được đường dẫn thanh toán",
        502,
      );
    }

    let paymentUrl: URL;
    try {
      paymentUrl = new URL(responseBody.payUrl);
    } catch {
      throw new AppError("MoMo trả về đường dẫn thanh toán không hợp lệ", 502);
    }
    if (paymentUrl.protocol !== "https:") {
      throw new AppError("MoMo trả về đường dẫn thanh toán không an toàn", 502);
    }

    const { signature: _signature, ...safeRequest } = requestBody;
    return {
      providerOrderId: responseBody.orderId || orderId,
      paymentUrl: paymentUrl.toString(),
      rawRequest: safeRequest,
      rawResponse: {
        orderId: responseBody.orderId || orderId,
        requestId: responseBody.requestId || requestId,
        resultCode: responseBody.resultCode ?? null,
        message: responseBody.message || "",
      } as Prisma.InputJsonObject,
    };
  },
};

export const verifyMomoSignature = (payload: Record<string, unknown>) => {
  const secretKey = requiredEnv("MOMO_SECRET_KEY");
  const signature = String(payload.signature || "");
  const value = (key: string) =>
    payload[key] === undefined || payload[key] === null
      ? ""
      : String(payload[key]);

  const rawSignature = [
    `accessKey=${requiredEnv("MOMO_ACCESS_KEY")}`,
    `amount=${value("amount")}`,
    `extraData=${value("extraData")}`,
    `message=${value("message")}`,
    `orderId=${value("orderId")}`,
    `orderInfo=${value("orderInfo")}`,
    `orderType=${value("orderType")}`,
    `partnerCode=${value("partnerCode")}`,
    `payType=${value("payType")}`,
    `requestId=${value("requestId")}`,
    `responseTime=${value("responseTime")}`,
    `resultCode=${value("resultCode")}`,
    `transId=${value("transId")}`,
  ].join("&");

  const expected = Buffer.from(signMomo(rawSignature, secretKey), "utf8");
  const received = Buffer.from(signature.toLowerCase(), "utf8");
  return (
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received)
  );
};

const requiredCallbackString = (
  payload: Record<string, unknown>,
  key: string,
) => {
  const value = payload[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(`MoMo callback thiếu ${key}`, 400, "INVALID_MOMO_CALLBACK");
  }
  return value.trim();
};

const requiredCallbackInteger = (
  payload: Record<string, unknown>,
  key: string,
) => {
  const value = Number(payload[key]);
  if (!Number.isSafeInteger(value)) {
    throw new AppError(`MoMo callback có ${key} không hợp lệ`, 400, "INVALID_MOMO_CALLBACK");
  }
  return value;
};

export const parseVerifiedMomoCallback = (
  payload: Record<string, unknown>,
): VerifiedMomoCallback => {
  if (!verifyMomoSignature(payload)) {
    throw new AppError(
      "Chữ ký callback MoMo không hợp lệ",
      401,
      "INVALID_MOMO_SIGNATURE",
    );
  }

  return {
    partnerCode: requiredCallbackString(payload, "partnerCode"),
    orderId: requiredCallbackString(payload, "orderId"),
    requestId: requiredCallbackString(payload, "requestId"),
    amount: requiredCallbackInteger(payload, "amount"),
    resultCode: requiredCallbackInteger(payload, "resultCode"),
    message:
      typeof payload.message === "string" ? payload.message.slice(0, 500) : "",
    transId:
      payload.transId === undefined || payload.transId === null
        ? null
        : String(payload.transId),
    responseTime:
      payload.responseTime === undefined || payload.responseTime === null
        ? null
        : String(payload.responseTime),
  };
};
