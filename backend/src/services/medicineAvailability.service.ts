import { prisma } from "../config/prisma.js";
import {
  availabilityLevel,
  isShortFor,
  sellableQuantity,
  type AvailabilityLevel,
} from "../utils/stockBatch.js";
import { getVietnamNowParts, toDateOnly } from "../utils/time.js";

// Thông tin khả dụng của thuốc cho bác sĩ khi kê đơn. Bác sĩ không có quyền xem kho, nên mọi giá trị
// trả ra ở đây chỉ gồm mức (còn, sắp hết, hết) và cờ "vượt tồn"; không bao giờ có số tồn, giá hay lô.
type MedicineOption = {
  id: string;
  code: string;
  name: string;
  activeIngredient: string | null;
  strength: string | null;
  dosageForm: string | null;
  unit: string;
  availability: AvailabilityLevel;
};

type ItemAvailability = { level: AvailabilityLevel; short: boolean };

const stockSelect = {
  stockQuantity: true,
  minStock: true,
  batches: { where: { quantity: { gt: 0 } }, select: { expiryDate: true, quantity: true } },
} as const;

type StockRow = {
  stockQuantity: number;
  minStock: number;
  batches: { expiryDate: Date; quantity: number }[];
};

const sellableOf = (row: StockRow, today: string) =>
  sellableQuantity(
    row.stockQuantity,
    row.batches.map((batch) => ({ id: "", expiryDate: toDateOnly(batch.expiryDate), quantity: batch.quantity })),
    today,
  );

class MedicineAvailabilityService {
  async listOptions(query: { q?: string; limit?: number }): Promise<MedicineOption[]> {
    const limit = Math.min(Math.max(query.limit || 20, 1), 50);
    const search = query.q?.trim();
    const today = getVietnamNowParts().date;
    const rows = await prisma.medicine.findMany({
      where: {
        isActive: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
                { activeIngredient: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      take: limit,
      select: {
        id: true,
        code: true,
        name: true,
        activeIngredient: true,
        strength: true,
        dosageForm: true,
        unit: true,
        ...stockSelect,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      activeIngredient: row.activeIngredient,
      strength: row.strength,
      dosageForm: row.dosageForm,
      unit: row.unit,
      availability: availabilityLevel(sellableOf(row, today), row.minStock),
    }));
  }

  // Khả dụng từng dòng thuốc của một đơn (chỉ dòng đã gắn thuốc kho). Số lượng cùng một thuốc ở nhiều dòng
  // được cộng dồn, vì kho cấp theo tổng nhu cầu của cả đơn.
  async forItems(items: { id: string; medicineId: string | null; quantity: number | null }[]) {
    const ids = [...new Set(items.map((item) => item.medicineId).filter((id): id is string => Boolean(id)))];
    const result = new Map<string, ItemAvailability>();
    if (ids.length === 0) return result;

    const today = getVietnamNowParts().date;
    const rows = await prisma.medicine.findMany({ where: { id: { in: ids } }, select: { id: true, ...stockSelect } });
    const sellable = new Map(rows.map((row) => [row.id, { row, value: sellableOf(row, today) }]));
    const needed = new Map<string, number>();
    for (const item of items) {
      if (item.medicineId) needed.set(item.medicineId, (needed.get(item.medicineId) || 0) + (item.quantity || 0));
    }
    for (const item of items) {
      const entry = item.medicineId ? sellable.get(item.medicineId) : null;
      if (!entry || !item.medicineId) continue;
      result.set(item.id, {
        level: availabilityLevel(entry.value, entry.row.minStock),
        short: isShortFor(entry.value, needed.get(item.medicineId)),
      });
    }
    return result;
  }

  // Thuốc phải có trong danh mục và còn dùng khi gắn vào dòng đơn.
  async assertUsable(medicineId: string) {
    const medicine = await prisma.medicine.findUnique({ where: { id: medicineId }, select: { id: true, isActive: true } });
    return Boolean(medicine?.isActive);
  }
}

export default new MedicineAvailabilityService();
