import type { InsuranceRouteType } from "../../generated/prisma/enums.js";
import { AppError } from "./appError.js";
import { normalizeOptionalString } from "./text.js";

// Quy tắc tính tiền hóa đơn thuần túy (không chạm cơ sở dữ liệu): dựng các dòng phí khám từ lịch hẹn và tính giảm trừ BHYT.

export type InsuranceInput = {
  bhytDiscount?: number;
  insuranceEligibleAmount?: number;
  insuranceCoverageRate?: number;
  insuranceRouteType?: InsuranceRouteType | null;
  insuranceNote?: string | null;
};

export type InsuranceAppointmentPolicy = {
  hasBHYT: boolean;
  package: {
    isBHYTSupport: boolean;
  } | null;
};

export type InvoiceItemSource = {
  estimatedPrice: number;
  serviceFee: number;
  package: { name: string } | null;
  department: { name: string };
};

export type InvoiceItemDraft = {
  type: "CONSULTATION" | "PACKAGE" | "SERVICE_FEE" | "MEDICINE" | "OTHER";
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sortOrder: number;
  // Dòng tiền thuốc gắn với dòng đơn thuốc sinh ra nó.
  prescriptionItemId?: string;
};

export const buildInvoiceItems = (appointment: InvoiceItemSource) => {
  const items: InvoiceItemDraft[] = [
    {
      type: appointment.package ? "PACKAGE" as const : "CONSULTATION" as const,
      description: appointment.package
        ? `Gói khám: ${appointment.package.name}`
        : `Phí khám: ${appointment.department.name}`,
      quantity: 1,
      unitPrice: appointment.estimatedPrice,
      amount: appointment.estimatedPrice,
      sortOrder: 0,
    },
  ];

  if (appointment.serviceFee > 0) {
    items.push({
      type: "SERVICE_FEE" as const,
      description: "Phí dịch vụ đặt lịch",
      quantity: 1,
      unitPrice: appointment.serviceFee,
      amount: appointment.serviceFee,
      sortOrder: 1,
    });
  }

  return items;
};

export const calculateInsurance = (
  input: InsuranceInput,
  totalAmount: number,
  appointment: InsuranceAppointmentPolicy,
  fallbackDiscount = 0,
) => {
  const hasStructuredInsurance =
    input.insuranceEligibleAmount !== undefined ||
    input.insuranceCoverageRate !== undefined ||
    input.insuranceRouteType !== undefined ||
    input.insuranceNote !== undefined;

  const eligibleAmount = hasStructuredInsurance
    ? (input.insuranceEligibleAmount ?? 0)
    : (input.bhytDiscount ?? fallbackDiscount);
  const coverageRate = hasStructuredInsurance
    ? (input.insuranceCoverageRate ?? 0)
    : eligibleAmount > 0
      ? 100
      : 0;
  const routeType =
    input.insuranceRouteType ?? (eligibleAmount > 0 ? "SERVICE" : null);
  const note = normalizeOptionalString(input.insuranceNote);
  const discountAmount = hasStructuredInsurance
    ? Math.floor((eligibleAmount * coverageRate) / 100)
    : (input.bhytDiscount ?? fallbackDiscount);

  if (eligibleAmount > totalAmount) {
    throw new AppError(
      "Số tiền đủ điều kiện BHYT không được lớn hơn tổng tiền",
      400,
    );
  }

  if (discountAmount > totalAmount) {
    throw new AppError("Giảm trừ BHYT không được lớn hơn tổng tiền", 400);
  }

  if (!appointment.hasBHYT && discountAmount > 0) {
    throw new AppError(
      "Lịch hẹn không có BHYT nên không được giảm trừ BHYT",
      400,
    );
  }

  if (
    appointment.hasBHYT &&
    appointment.package &&
    !appointment.package.isBHYTSupport &&
    discountAmount > 0
  ) {
    throw new AppError("Gói khám này không hỗ trợ giảm trừ BHYT", 400);
  }

  return {
    insuranceEligibleAmount: eligibleAmount,
    insuranceCoverageRate: coverageRate,
    insuranceRouteType: routeType,
    insuranceNote: note,
    bhytDiscount: discountAmount,
    finalAmount: totalAmount - discountAmount,
  };
};
