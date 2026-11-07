import type { PaymentProviderAdapter } from "./types.js";

// Provider giả lập cho kiểm thử: không có trang checkout. Kết quả được giả lập
// qua POST /api/v1/me/payments/mock/:transactionCode/success|fail.
export const mockPaymentProvider: PaymentProviderAdapter = {
  provider: "MOCK",

  async createPayment(input) {
    return {
      providerOrderId: input.transactionCode,
      paymentUrl: null,
      rawRequest: {
        invoiceId: input.invoiceId,
        invoiceCode: input.invoiceCode,
        provider: input.provider,
        amount: input.amount,
        transactionCode: input.transactionCode,
      },
      rawResponse: { mode: "MOCK" },
    };
  },
};
