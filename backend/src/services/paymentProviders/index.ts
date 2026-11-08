import type { PaymentProvider } from "../../../generated/prisma/enums.js";
import type { PaymentProviderAdapter } from "./types.js";
import { AppError } from "../../utils/appError.js";
import {
  getVnpayConfigurationStatus,
  vnpayPaymentProvider,
} from "./vnpay.provider.js";

// VNPay là cổng thanh toán online duy nhất. Giữ lớp adapter để việc thêm cổng
// khác sau này chỉ cần thêm một provider, không phải sửa PaymentService.
const adapters = {
  VNPAY: vnpayPaymentProvider,
} satisfies Record<PaymentProvider, PaymentProviderAdapter>;

export const getPaymentProviderAdapter = (provider: PaymentProvider) =>
  adapters[provider];

export const getPaymentProviderCapabilities = () => {
  const vnpay = getVnpayConfigurationStatus();
  return {
    providers:
      vnpay.enabled && vnpay.configured
        ? [
            {
              provider: "VNPAY" as const,
              label: "VNPAY (ATM, thẻ quốc tế, QR ngân hàng)",
            },
          ]
        : [],
  };
};

export const assertPaymentProviderAvailable = (provider: PaymentProvider) => {
  const vnpay = getVnpayConfigurationStatus();
  if (provider === "VNPAY" && vnpay.enabled && vnpay.configured) return;

  throw new AppError(
    "Nhà cung cấp thanh toán chưa sẵn sàng",
    404,
    "PAYMENT_PROVIDER_UNAVAILABLE",
  );
};

export type {
  CreateProviderPaymentResult,
  PaymentProviderAdapter,
} from "./types.js";
export {
  getVnpayConfigurationStatus,
  parseVerifiedVnpayCallback,
  queryVnpayTransaction,
} from "./vnpay.provider.js";
export type {
  VerifiedVnpayCallback,
  VerifiedVnpayQuery,
} from "./vnpay.provider.js";
