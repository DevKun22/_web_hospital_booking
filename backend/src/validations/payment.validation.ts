import { z } from "zod";

const providers = ["MOCK", "VNPAY", "MOMO"] as const;

export const createPaymentTransactionSchema = z.object({
  provider: z
    .string("Nha cung cap thanh toan la bat buoc")
    .trim()
    .min(1, "Nha cung cap thanh toan la bat buoc")
    .refine(
      (value) => providers.includes(value as (typeof providers)[number]),
      {
        message:
          "Nha cung cap thanh toan khong hop le. Gia tri hop le: MOCK, VNPAY, MOMO",
      },
    ),
});
