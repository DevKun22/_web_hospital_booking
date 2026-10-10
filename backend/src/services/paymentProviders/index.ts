import type { PaymentProvider } from "../../../generated/prisma/enums.js";
import { mockPaymentProvider } from "./mock.provider.js";
import { momoPaymentProvider } from "./momo.provider.js";
import { createUnsupportedProvider } from "./unsupported.provider.js";
import type { PaymentProviderAdapter } from "./types.js";
import { isProductionLike } from "../../config/environment.js";
import { AppError } from "../../utils/appError.js";

const adapters = {
  MOCK: mockPaymentProvider,
  MOMO: momoPaymentProvider,
  VNPAY: createUnsupportedProvider("VNPAY"),
  ZALOPAY: createUnsupportedProvider("ZALOPAY"),
} satisfies Record<PaymentProvider, PaymentProviderAdapter>;

export const getPaymentProviderAdapter = (provider: PaymentProvider) =>
  adapters[provider];

const isEnabled = (value?: string) =>
  ["true", "1", "yes", "on"].includes((value || "").toLowerCase());

export const isMockPaymentEnabled = () =>
  !isProductionLike() && isEnabled(process.env.PAYMENT_MOCK_ENABLED);

export const getPaymentProviderCapabilities = () => ({
  providers: [
    ...(isMockPaymentEnabled()
      ? [
          {
            provider: "MOCK" as const,
            label: "Thanh toán mô phỏng",
            isMock: true,
          },
        ]
      : []),
  ],
});

export const assertPaymentProviderAvailable = (provider: PaymentProvider) => {
  if (provider === "MOCK" && isMockPaymentEnabled()) return;

  throw new AppError(
    provider === "MOCK"
      ? "Thanh toán mô phỏng không khả dụng"
      : "Nhà cung cấp thanh toán chưa sẵn sàng",
    404,
    provider === "MOCK"
      ? "MOCK_PAYMENT_DISABLED"
      : "PAYMENT_PROVIDER_UNAVAILABLE",
  );
};

export const assertMockPaymentEnabled = () => {
  if (!isMockPaymentEnabled()) {
    throw new AppError(
      "Thanh toán mô phỏng không khả dụng",
      404,
      "MOCK_PAYMENT_DISABLED",
    );
  }
};

export type {
  CreateProviderPaymentResult,
  PaymentProviderAdapter,
} from "./types.js";
export { verifyMomoSignature } from "./momo.provider.js";
