import { z } from "zod";

const manualPaymentMethods = [
  "CASH",
  "CARD",
  "BANK_TRANSFER",
  "OTHER",
] as const;
const insuranceRouteTypes = [
  "RIGHT_ROUTE",
  "WRONG_ROUTE",
  "REFERRAL",
  "EMERGENCY",
  "SERVICE",
] as const;

const invoiceInsuranceFields = {
  bhytDiscount: z
    .number()
    .int()
    .min(0, "Giam tru BHYT khong duoc am")
    .optional(),
  insuranceEligibleAmount: z
    .number()
    .int()
    .min(0, "So tien du dieu kien BHYT khong duoc am")
    .optional(),
  insuranceCoverageRate: z
    .number()
    .int()
    .min(0, "Ty le huong BHYT khong duoc am")
    .max(100, "Ty le huong BHYT khong duoc vuot qua 100")
    .optional(),
  insuranceRouteType: z.enum(insuranceRouteTypes).nullable().optional(),
  insuranceNote: z
    .string()
    .trim()
    .max(500, "Ghi chu BHYT khong duoc vuot qua 500 ky tu")
    .nullable()
    .optional(),
};

export const createInvoiceSchema = z.object({
  ...invoiceInsuranceFields,
});

export const updateInvoiceSchema = z.object({
  ...invoiceInsuranceFields,
});

export const payInvoiceSchema = z.object({
  paymentMethod: z
    .string("Phuong thuc thanh toan la bat buoc")
    .trim()
    .min(1, "Phuong thuc thanh toan la bat buoc")
    .refine(
      (value) =>
        manualPaymentMethods.includes(
          value as (typeof manualPaymentMethods)[number],
        ),
      {
        message:
          "Phuong thuc thanh toan thu cong khong hop le. Gia tri hop le: CASH, CARD, BANK_TRANSFER, OTHER. MOMO/VNPAY phai di qua API /api/payments.",
      },
    ),
  paymentReference: z
    .string()
    .trim()
    .max(100, "Ma tham chieu khong duoc vuot qua 100 ky tu")
    .nullable()
    .optional(),
});

export const refundInvoiceSchema = z.object({
  refundReason: z
    .string("Ly do hoan tien la bat buoc")
    .trim()
    .min(5, "Ly do hoan tien phai co it nhat 5 ky tu")
    .max(500, "Ly do hoan tien khong duoc vuot qua 500 ky tu"),
  refundReference: z
    .string()
    .trim()
    .max(100, "Ma tham chieu hoan tien khong duoc vuot qua 100 ky tu")
    .nullable()
    .optional(),
});
