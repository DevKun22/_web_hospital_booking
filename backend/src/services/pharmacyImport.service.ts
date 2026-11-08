import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { parseCsv } from "../utils/csvParse.js";
import AuditLogService from "./auditLog.service.js";
import PharmacyService from "./pharmacy.service.js";

// Nhập CSV cho kho thuốc. Hai loại tệp:
//   - catalog:  thêm thuốc mới hoặc cập nhật thông tin thuốc đã có (KHÔNG đụng tới tồn kho);
//   - receipts: nhập kho theo mã thuốc, mỗi dòng đi qua sổ kho như nhập tay.
// Luôn kiểm tra toàn bộ tệp trước (apply=false chỉ xem trước). Chỉ áp dụng khi không có dòng
// nào lỗi, và áp dụng trong một transaction: hoặc đủ mọi dòng hoặc không đổi gì.

export const IMPORT_MAX_ROWS = 500;
export type ImportKind = "catalog" | "receipts";
type Actor = { userId: string; role: string };

export type ImportRow = {
  line: number;
  code: string;
  action: "create" | "update" | "unchanged" | "receive" | "error";
  quantity?: number;
  errors: string[];
};

export type ImportResult = {
  kind: ImportKind;
  applied: boolean;
  rows: ImportRow[];
  summary: {
    total: number;
    create: number;
    update: number;
    unchanged: number;
    receive: number;
    errors: number;
    totalQuantity: number;
  };
};

const HEADERS = {
  code: "Mã thuốc",
  name: "Tên thuốc",
  activeIngredient: "Hoạt chất",
  strength: "Hàm lượng",
  dosageForm: "Dạng bào chế",
  unit: "Đơn vị",
  minStock: "Mức tối thiểu",
  note: "Ghi chú",
  quantity: "Số lượng",
  reason: "Lý do",
} as const;

const LIMITS = { code: 40, name: 200, activeIngredient: 200, strength: 80, dosageForm: 80, unit: 30, note: 500, reason: 300 };
const MAX_NUMBER = 1_000_000;
// 500 dòng x vài truy vấn dễ vượt 5 giây mặc định của transaction.
const TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 };
const DEFAULT_RECEIPT_REASON = "Nhập kho từ tệp CSV";

// Tiêu đề so khớp không phân biệt hoa thường và khoảng trắng thừa.
const key = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

const columnIndex = (headers: string[], required: string[]) => {
  const index = new Map(headers.map((header, position) => [key(header), position]));
  const missing = required.filter((name) => !index.has(key(name)));
  if (missing.length > 0) {
    throw new AppError(`Thiếu cột bắt buộc: ${missing.join(", ")}`, 400, "IMPORT_MISSING_COLUMN");
  }
  const lookup = (name: string) => index.get(key(name));
  return { lookup };
};

const intField = (raw: string, field: string, min: number, errors: string[]) => {
  if (!/^\d+$/.test(raw)) {
    errors.push(`${field} phải là số nguyên không âm`);
    return undefined;
  }
  const value = Number(raw);
  if (value < min || value > MAX_NUMBER) {
    errors.push(`${field} phải từ ${min} đến ${MAX_NUMBER.toLocaleString("vi-VN")}`);
    return undefined;
  }
  return value;
};

const tooLong = (value: string, max: number, field: string, errors: string[]) => {
  if (value.length > max) errors.push(`${field} tối đa ${max} ký tự`);
};

const summarise = (kind: ImportKind, applied: boolean, rows: ImportRow[]): ImportResult => ({
  kind,
  applied,
  rows,
  summary: {
    total: rows.length,
    create: rows.filter((row) => row.action === "create").length,
    update: rows.filter((row) => row.action === "update").length,
    unchanged: rows.filter((row) => row.action === "unchanged").length,
    receive: rows.filter((row) => row.action === "receive").length,
    errors: rows.filter((row) => row.action === "error").length,
    totalQuantity: rows.reduce((sum, row) => sum + (row.action === "receive" ? (row.quantity ?? 0) : 0), 0),
  },
});

const readCsv = (csv: string, required: string[]) => {
  if (typeof csv !== "string" || csv.trim() === "") {
    throw new AppError("Tệp CSV trống", 400, "IMPORT_EMPTY");
  }
  let parsed;
  try {
    parsed = parseCsv(csv);
  } catch (error) {
    throw new AppError(error instanceof Error ? error.message : "Không đọc được tệp CSV", 400, "IMPORT_INVALID_CSV");
  }
  const columns = columnIndex(parsed.headers, required);
  if (parsed.rows.length === 0) throw new AppError("Tệp không có dòng dữ liệu", 400, "IMPORT_EMPTY");
  if (parsed.rows.length > IMPORT_MAX_ROWS) {
    throw new AppError(
      `Tệp có ${parsed.rows.length} dòng, tối đa ${IMPORT_MAX_ROWS} dòng mỗi lần nhập`,
      413,
      "IMPORT_TOO_LARGE",
    );
  }
  return { rows: parsed.rows, lookup: columns.lookup };
};

type CatalogPlan = {
  row: ImportRow;
  data: {
    code: string;
    name?: string;
    activeIngredient?: string;
    strength?: string;
    dosageForm?: string;
    unit?: string;
    minStock?: number;
    note?: string;
  };
  existingId?: string;
};

class PharmacyImportService {
  async run(kind: ImportKind, csv: string, apply: boolean, actor: Actor, ipAddress?: string) {
    const result = kind === "catalog" ? await this.catalog(csv, apply) : await this.receipts(csv, apply, actor);

    if (result.applied) {
      await AuditLogService.record({
        actor,
        action: "DATA_IMPORTED",
        targetType: kind === "catalog" ? "MEDICINE_CATALOG" : "STOCK_RECEIPTS",
        ipAddress,
        meta: {
          rows: result.summary.total,
          created: result.summary.create,
          updated: result.summary.update,
          received: result.summary.receive,
          totalQuantity: result.summary.totalQuantity,
        },
      });
    }
    return result;
  }

  private async catalog(csv: string, apply: boolean): Promise<ImportResult> {
    const { rows, lookup } = readCsv(csv, [HEADERS.code, HEADERS.name, HEADERS.unit]);
    const cell = (cells: string[], name: string) => {
      const position = lookup(name);
      return position === undefined ? "" : (cells[position] ?? "").trim();
    };

    const codes = rows.map((row) => cell(row.cells, HEADERS.code).toUpperCase()).filter(Boolean);
    const existing = await prisma.medicine.findMany({
      where: { code: { in: codes } },
      select: {
        id: true,
        code: true,
        name: true,
        activeIngredient: true,
        strength: true,
        dosageForm: true,
        unit: true,
        minStock: true,
        note: true,
      },
    });
    const byCode = new Map(existing.map((medicine) => [medicine.code, medicine]));

    const seen = new Set<string>();
    const plans: CatalogPlan[] = rows.map(({ line, cells }) => {
      const errors: string[] = [];
      const code = cell(cells, HEADERS.code).toUpperCase();
      if (!code) errors.push("Thiếu mã thuốc");
      tooLong(code, LIMITS.code, "Mã thuốc", errors);
      if (code && seen.has(code)) errors.push("Mã thuốc bị lặp trong tệp");
      seen.add(code);

      const data: CatalogPlan["data"] = { code };
      const text = (name: string, field: keyof typeof LIMITS, target: Exclude<keyof CatalogPlan["data"], "code" | "minStock">) => {
        const value = cell(cells, name);
        tooLong(value, LIMITS[field], name, errors);
        if (value) data[target] = value;
      };
      text(HEADERS.name, "name", "name");
      text(HEADERS.activeIngredient, "activeIngredient", "activeIngredient");
      text(HEADERS.strength, "strength", "strength");
      text(HEADERS.dosageForm, "dosageForm", "dosageForm");
      text(HEADERS.unit, "unit", "unit");
      text(HEADERS.note, "note", "note");
      const minStockRaw = cell(cells, HEADERS.minStock);
      if (minStockRaw) data.minStock = intField(minStockRaw, HEADERS.minStock, 0, errors);

      const current = byCode.get(code);
      if (!current) {
        if (!data.name) errors.push("Thuốc mới cần có Tên thuốc");
        if (!data.unit) errors.push("Thuốc mới cần có Đơn vị");
      }

      let action: ImportRow["action"] = "create";
      if (current) {
        // Ô trống nghĩa là giữ nguyên giá trị hiện có.
        const changed = (Object.keys(data) as (keyof typeof data)[]).some(
          (field) => field !== "code" && data[field] !== undefined && data[field] !== (current[field] ?? undefined),
        );
        action = changed ? "update" : "unchanged";
      }
      return {
        row: { line, code, action: errors.length > 0 ? "error" : action, errors },
        data,
        existingId: current?.id,
      };
    });

    const outcome = plans.map((plan) => plan.row);
    const result = summarise("catalog", false, outcome);
    if (!apply || result.summary.errors > 0) return result;

    try {
      await prisma.$transaction(async (tx) => {
        for (const plan of plans) {
          if (plan.row.action === "create") {
            await tx.medicine.create({
              data: {
                code: plan.data.code,
                name: plan.data.name!,
                unit: plan.data.unit!,
                activeIngredient: plan.data.activeIngredient,
                strength: plan.data.strength,
                dosageForm: plan.data.dosageForm,
                minStock: plan.data.minStock ?? 0,
                note: plan.data.note,
              },
            });
          } else if (plan.row.action === "update") {
            const { code, ...changes } = plan.data;
            void code;
            await tx.medicine.update({ where: { id: plan.existingId! }, data: changes });
          }
        }
      }, TX_OPTIONS);
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        throw new AppError("Có mã thuốc vừa được thêm bởi người khác, hãy kiểm tra lại tệp", 409, "MEDICINE_CODE_EXISTS");
      }
      throw error;
    }
    return summarise("catalog", true, outcome);
  }

  private async receipts(csv: string, apply: boolean, actor: Actor): Promise<ImportResult> {
    const { rows, lookup } = readCsv(csv, [HEADERS.code, HEADERS.quantity]);
    const cell = (cells: string[], name: string) => {
      const position = lookup(name);
      return position === undefined ? "" : (cells[position] ?? "").trim();
    };

    const codes = rows.map((row) => cell(row.cells, HEADERS.code).toUpperCase()).filter(Boolean);
    const medicines = await prisma.medicine.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true, isActive: true },
    });
    const byCode = new Map(medicines.map((medicine) => [medicine.code, medicine]));

    const seen = new Set<string>();
    const plans = rows.map(({ line, cells }) => {
      const errors: string[] = [];
      const code = cell(cells, HEADERS.code).toUpperCase();
      const medicine = byCode.get(code);
      if (!code) errors.push("Thiếu mã thuốc");
      else if (!medicine) errors.push("Không có thuốc với mã này trong danh mục");
      else if (!medicine.isActive) errors.push("Thuốc đã ngừng sử dụng");
      if (code && seen.has(code)) errors.push("Mã thuốc bị lặp trong tệp, hãy gộp thành một dòng");
      seen.add(code);

      const quantity = intField(cell(cells, HEADERS.quantity), HEADERS.quantity, 1, errors);
      const reason = cell(cells, HEADERS.reason) || DEFAULT_RECEIPT_REASON;
      tooLong(reason, LIMITS.reason, HEADERS.reason, errors);

      const row: ImportRow = {
        line,
        code,
        action: errors.length > 0 ? "error" : "receive",
        quantity,
        errors,
      };
      return { row, medicineId: medicine?.id, quantity, reason };
    });

    const outcome = plans.map((plan) => plan.row);
    const result = summarise("receipts", false, outcome);
    if (!apply || result.summary.errors > 0) return result;

    // Theo thứ tự id để hai lần nhập đồng thời không khóa chéo nhau.
    const ordered = [...plans].sort((a, b) => a.medicineId!.localeCompare(b.medicineId!));
    await prisma.$transaction(async (tx) => {
      for (const plan of ordered) {
        await PharmacyService.moveStockIn(tx, plan.medicineId!, plan.quantity!, "RECEIPT", plan.reason, actor);
      }
    }, TX_OPTIONS);
    return summarise("receipts", true, outcome);
  }
}

export default new PharmacyImportService();
