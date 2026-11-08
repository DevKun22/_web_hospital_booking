import type { Prisma } from "../../generated/prisma/client.js";
import type { InvoiceStatus, PaymentMethod } from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import {
  EXPORT_MAX_ROWS,
  assertWithinRowLimit,
  buildCsv,
  type CsvCell,
} from "../utils/csvExport.js";
import DashboardStatisticsService from "./dashboardStatistics.service.js";

// Xuất báo cáo CSV cho dashboard. Nguyên tắc: chỉ các cột vận hành cần cho đối soát, không đưa họ tên,
// số điện thoại hay nội dung y tế của bệnh nhân vào tệp xuất.

type Range = { from: Date; to: Date };
export type CsvExport = { csv: string; rows: number };

export const invoiceStatuses = ["UNPAID", "PAID", "CANCELLED", "REFUNDED"] as const;
export const paymentMethods = ["CASH", "CARD", "BANK_TRANSFER", "VNPAY", "OTHER"] as const;

const statusLabel: Record<string, string> = {
  UNPAID: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  CANCELLED: "Đã hủy",
  REFUNDED: "Đã hoàn tiền",
};
const methodLabel: Record<string, string> = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  BANK_TRANSFER: "Chuyển khoản",
  VNPAY: "VNPay",
  OTHER: "Khác",
};
const movementLabel: Record<string, string> = {
  RECEIPT: "Nhập kho",
  DISPENSE: "Cấp phát",
  ADJUSTMENT: "Điều chỉnh",
};

const finish = (headers: string[], rows: CsvCell[][]): CsvExport => {
  assertWithinRowLimit(rows.length);
  return { csv: buildCsv(headers, rows), rows: rows.length };
};

class DataExportService {
  async invoices(input: Range & { status?: InvoiceStatus; paymentMethod?: PaymentMethod }) {
    const items = await prisma.invoice.findMany({
      where: {
        createdAt: { gte: input.from, lte: input.to },
        status: input.status,
        paymentMethod: input.paymentMethod,
      },
      orderBy: { createdAt: "asc" },
      take: EXPORT_MAX_ROWS + 1,
      select: {
        invoiceCode: true,
        createdAt: true,
        status: true,
        paymentMethod: true,
        totalAmount: true,
        bhytDiscount: true,
        finalAmount: true,
        paymentReference: true,
        paidAt: true,
        refundedAt: true,
        refundReference: true,
        appointment: { select: { bookingCode: true } },
      },
    });

    return finish(
      [
        "Mã hóa đơn",
        "Mã lịch hẹn",
        "Ngày tạo",
        "Trạng thái",
        "Phương thức",
        "Tổng tiền",
        "Giảm trừ BHYT",
        "Thành tiền",
        "Mã tham chiếu thanh toán",
        "Ngày thanh toán",
        "Ngày hoàn tiền",
        "Mã tham chiếu hoàn tiền",
      ],
      items.map((item) => [
        item.invoiceCode,
        item.appointment.bookingCode,
        item.createdAt,
        statusLabel[item.status] ?? item.status,
        item.paymentMethod ? (methodLabel[item.paymentMethod] ?? item.paymentMethod) : "",
        item.totalAmount,
        item.bhytDiscount,
        item.finalAmount,
        item.paymentReference,
        item.paidAt,
        item.refundedAt,
        item.refundReference,
      ]),
    );
  }

  // Dùng lại số liệu của trang thống kê để báo cáo luôn khớp với biểu đồ.
  async revenue(input: Range) {
    const report = await DashboardStatisticsService.getRevenue({ from: input.from, to: input.to });
    const rows: CsvCell[][] = report.daily.map((day) => [
      day.date,
      day.collectedAmount,
      day.refundedAmount,
      day.netAmount,
    ]);
    rows.push([
      "Tổng",
      report.metrics.collectedAmount,
      report.metrics.refundedAmount,
      report.metrics.netAmount,
    ]);
    return finish(["Ngày", "Đã thu", "Hoàn tiền", "Thực thu"], rows);
  }

  async auditLogs(input: Range & { action?: string }) {
    const items = await prisma.auditLog.findMany({
      where: { createdAt: { gte: input.from, lte: input.to }, action: input.action || undefined },
      orderBy: { createdAt: "asc" },
      take: EXPORT_MAX_ROWS + 1,
    });

    return finish(
      ["Thời gian", "Người thực hiện", "Vai trò", "Hành động", "Đối tượng", "Mã đối tượng", "IP", "Chi tiết"],
      items.map((item) => [
        item.createdAt,
        item.actorName,
        item.actorRole,
        item.action,
        item.targetType,
        item.targetId,
        item.ipAddress,
        item.meta ? JSON.stringify(item.meta) : "",
      ]),
    );
  }

  async inventory() {
    const items = await prisma.medicine.findMany({
      orderBy: { name: "asc" },
      take: EXPORT_MAX_ROWS + 1,
      select: {
        code: true,
        name: true,
        activeIngredient: true,
        strength: true,
        dosageForm: true,
        unit: true,
        stockQuantity: true,
        minStock: true,
        isActive: true,
      },
    });

    return finish(
      [
        "Mã thuốc",
        "Tên thuốc",
        "Hoạt chất",
        "Hàm lượng",
        "Dạng bào chế",
        "Đơn vị",
        "Tồn kho",
        "Mức tối thiểu",
        "Dưới mức tối thiểu",
        "Đang dùng",
      ],
      items.map((item) => [
        item.code,
        item.name,
        item.activeIngredient,
        item.strength,
        item.dosageForm,
        item.unit,
        item.stockQuantity,
        item.minStock,
        item.stockQuantity < item.minStock,
        item.isActive,
      ]),
    );
  }

  async movements(input: Range & { medicineId?: string }) {
    const where: Prisma.StockMovementWhereInput = {
      createdAt: { gte: input.from, lte: input.to },
      medicineId: input.medicineId,
    };
    const items = await prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: EXPORT_MAX_ROWS + 1,
      select: {
        createdAt: true,
        type: true,
        quantity: true,
        balanceAfter: true,
        reason: true,
        medicine: { select: { code: true, name: true, unit: true } },
        actor: { select: { fullName: true } },
        prescriptionItem: {
          select: { prescription: { select: { prescriptionCode: true } } },
        },
      },
    });

    return finish(
      [
        "Thời gian",
        "Mã thuốc",
        "Tên thuốc",
        "Đơn vị",
        "Loại",
        "Số lượng",
        "Tồn sau",
        "Mã đơn thuốc",
        "Lý do",
        "Người thực hiện",
      ],
      items.map((item) => [
        item.createdAt,
        item.medicine.code,
        item.medicine.name,
        item.medicine.unit,
        movementLabel[item.type] ?? item.type,
        item.quantity,
        item.balanceAfter,
        item.prescriptionItem?.prescription.prescriptionCode,
        item.reason,
        item.actor.fullName,
      ]),
    );
  }
}

export default new DataExportService();
