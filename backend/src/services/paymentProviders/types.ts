import type { PaymentProvider } from "../../../generated/prisma/enums.js";
import type { Prisma } from "../../../generated/prisma/client.js";

export type CreateProviderPaymentInput = {
  provider: PaymentProvider;
  transactionCode: string;
  invoiceId: string;
  invoiceCode: string;
  amount: number;
  orderInfo: string;
  expiredAt: Date;
  ipAddress?: string;
};

export type CreateProviderPaymentResult = {
  providerOrderId: string;
  paymentUrl: string | null;
  rawRequest: Prisma.InputJsonObject;
  rawResponse: Prisma.InputJsonObject;
};

export type PaymentProviderAdapter = {
  provider: PaymentProvider;
  createPayment(
    input: CreateProviderPaymentInput,
  ): Promise<CreateProviderPaymentResult>;
};
