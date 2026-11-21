import type { DsTone } from "@/components/ds";
import { toMoneyNumber } from "@/lib/money-input";
import type { Appointment, InsuranceRouteType, Invoice, InvoiceStatus, PaymentMethod } from "@/lib/types";

// Hóa đơn: nhãn, tùy chọn và phép tính thuần (tiền, BHYT) tách khỏi trang để kiểm thử được.
export type InvoiceAction = "pay" | "cancel" | "refund" | "adjust";
export type InsuranceForm = {
  eligibleAmount: string;
  coverageRate: string;
  routeType: InsuranceRouteType;
  note: string;
};

// "Chưa thanh toán" đứng đầu và là tab mặc định: đó là việc của thu ngân; hóa đơn tự tạo khi bác sĩ hoàn thành khám.
export const statusTabs = [
  { id: "UNPAID", label: "Chưa thanh toán" },
  { id: "", label: "Tất cả" },
  { id: "PAID", label: "Đã thanh toán" },
  { id: "CANCELLED", label: "Đã hủy" },
  { id: "REFUNDED", label: "Đã hoàn tiền" },
];

export const paymentOptions: { value: "" | PaymentMethod; label: string }[] = [
  { value: "", label: "Mọi phương thức" },
  { value: "CASH", label: "Tiền mặt" },
  { value: "CARD", label: "Thẻ" },
  { value: "BANK_TRANSFER", label: "Chuyển khoản" },
  { value: "VNPAY", label: "VNPay" },
  { value: "OTHER", label: "Khác" },
];

export const manualPayments: {
  value: Exclude<PaymentMethod, "VNPAY">;
  label: string;
}[] = [
  { value: "CASH", label: "Tiền mặt" },
  { value: "CARD", label: "Thẻ" },
  { value: "BANK_TRANSFER", label: "Chuyển khoản" },
  { value: "OTHER", label: "Khác" },
];

export const insuranceCoverageOptions = ["0", "80", "95", "100"];

export const insuranceRouteOptions: { value: InsuranceRouteType; label: string }[] = [
  { value: "RIGHT_ROUTE", label: "Đúng tuyến" },
  { value: "WRONG_ROUTE", label: "Trái tuyến" },
  { value: "REFERRAL", label: "Chuyển tuyến" },
  { value: "EMERGENCY", label: "Cấp cứu" },
  { value: "SERVICE", label: "Dịch vụ" },
];

export const defaultInsuranceForm: InsuranceForm = {
  eligibleAmount: "",
  coverageRate: "80",
  routeType: "RIGHT_ROUTE",
  note: "",
};

export const insuranceRouteLabel: Record<InsuranceRouteType, string> = {
  RIGHT_ROUTE: "Đúng tuyến",
  WRONG_ROUTE: "Trái tuyến",
  REFERRAL: "Chuyển tuyến",
  EMERGENCY: "Cấp cứu",
  SERVICE: "Dịch vụ",
};

export const statusLabel: Record<InvoiceStatus, string> = {
  UNPAID: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  CANCELLED: "Đã hủy",
  REFUNDED: "Đã hoàn tiền",
};

export const statusTone: Record<InvoiceStatus, DsTone> = {
  UNPAID: "warn",
  PAID: "good",
  CANCELLED: "bad",
  REFUNDED: "neutral",
};

export const paymentLabel: Partial<Record<PaymentMethod, string>> = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  BANK_TRANSFER: "Chuyển khoản",
  VNPAY: "VNPay",
  OTHER: "Khác",
};

export const transactionStatusLabel = {
  PENDING: "Đang chờ",
  SUCCESS: "Thành công",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
} as const;
export const transactionTone: Record<keyof typeof transactionStatusLabel, DsTone> = {
  PENDING: "warn",
  SUCCESS: "good",
  FAILED: "bad",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
};

export const calculateInsuranceDiscount = (form: InsuranceForm) =>
  Math.floor(
    (toMoneyNumber(form.eligibleAmount) * Number(form.coverageRate || 0)) / 100,
  );

export const buildInsuranceForm = (invoice: Invoice): InsuranceForm => ({
  eligibleAmount: invoice.insuranceEligibleAmount
    ? String(invoice.insuranceEligibleAmount)
    : "",
  // Mức hưởng 0% là lựa chọn hợp lệ khi đã có số tiền BHYT; chỉ hóa đơn chưa áp BHYT mới lấy mức mặc định 80%.
  coverageRate: String(invoice.insuranceEligibleAmount ? (invoice.insuranceCoverageRate ?? 80) : 80),
  routeType: invoice.insuranceRouteType || "RIGHT_ROUTE",
  note: invoice.insuranceNote || "",
});

export const buildInsurancePayload = (form: InsuranceForm) => {
  const eligibleAmount = toMoneyNumber(form.eligibleAmount);

  return {
    insuranceEligibleAmount: eligibleAmount,
    insuranceCoverageRate:
      eligibleAmount > 0 ? Number(form.coverageRate || 0) : 0,
    insuranceRouteType: eligibleAmount > 0 ? form.routeType : null,
    insuranceNote: eligibleAmount > 0 ? form.note.trim() || null : null,
  };
};

export const doctorName = (invoice: Invoice) =>
  [invoice.appointment.doctor.title, invoice.appointment.doctor.user.fullName]
    .filter(Boolean)
    .join(" ");

export const appointmentDoctorName = (appointment: Appointment) =>
  [appointment.doctor.title, appointment.doctor.user.fullName]
    .filter(Boolean)
    .join(" ");
