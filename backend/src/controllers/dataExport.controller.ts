import type { Request, RequestHandler, Response } from "express";
import type { InvoiceStatus, PaymentMethod } from "../../generated/prisma/enums.js";
import DataExportService, {
  invoiceStatuses,
  paymentMethods,
  type CsvExport,
} from "../services/dataExport.service.js";
import AuditLogService, { AUDIT_ACTIONS } from "../services/auditLog.service.js";
import { AppError } from "../utils/appError.js";
import { getClientIp } from "../utils/clientIp.js";
import { parseExportRange, sendCsv } from "../utils/csvExport.js";
import { parseEnumQuery, parseStringQuery } from "../shared/http/requestParsers.js";

// Mỗi lần xuất dữ liệu là một sự kiện bảo mật: ghi ai xuất, loại gì, bao nhiêu dòng, bộ lọc nào
// (không ghi nội dung), rồi mới trả tệp.
const respond =
  (
    baseName: string,
    targetType: string,
    build: (req: Request, range: ReturnType<typeof parseExportRange>) => Promise<CsvExport>,
    options: { ranged?: boolean } = {},
  ): RequestHandler =>
  async (req: Request, res: Response) => {
    if (!req.user) throw new AppError("Chưa đăng nhập", 401);
    const range = parseExportRange(options.ranged === false ? {} : req.query);
    const result = await build(req, range);

    await AuditLogService.record({
      actor: { userId: req.user.userId, role: req.user.role },
      action: "DATA_EXPORTED" satisfies (typeof AUDIT_ACTIONS)[number],
      targetType,
      ipAddress: getClientIp(req),
      meta: {
        rows: result.rows,
        ...(options.ranged === false ? {} : { from: range.fromText, to: range.toText }),
        ...Object.fromEntries(
          ["status", "paymentMethod", "action", "medicineId"]
            .filter((key) => typeof req.query[key] === "string" && req.query[key])
            .map((key) => [key, String(req.query[key])]),
        ),
      },
    });

    return sendCsv(res, baseName, result.csv);
  };


export const exportInvoicesHandler = respond("hoa-don", "INVOICES", (req, range) =>
  DataExportService.invoices({
    ...range,
    status: parseEnumQuery<InvoiceStatus>(req.query.status, invoiceStatuses, "status", "EXPORT_INVALID_FILTER"),
    paymentMethod: parseEnumQuery<PaymentMethod>(req.query.paymentMethod, paymentMethods, "paymentMethod", "EXPORT_INVALID_FILTER"),
  }),
);

export const exportRevenueHandler = respond("doanh-thu", "REVENUE_REPORT", (_req, range) =>
  DataExportService.revenue(range),
);

export const exportAuditLogsHandler = respond("nhat-ky-truy-cap", "AUDIT_LOGS", (req, range) =>
  DataExportService.auditLogs({
    ...range,
    action: parseEnumQuery(req.query.action, AUDIT_ACTIONS, "action", "EXPORT_INVALID_FILTER"),
  }),
);

export const exportInventoryHandler = respond(
  "ton-kho-thuoc",
  "MEDICINE_INVENTORY",
  () => DataExportService.inventory(),
  { ranged: false },
);

export const exportMovementsHandler = respond("so-kho-thuoc", "STOCK_MOVEMENTS", (req, range) => {
  const medicineId = parseStringQuery(req.query.medicineId);
  if (medicineId && !/^[0-9a-f-]{36}$/i.test(medicineId)) {
    throw new AppError("medicineId không hợp lệ", 400, "EXPORT_INVALID_FILTER");
  }
  return DataExportService.movements({ ...range, medicineId });
});
