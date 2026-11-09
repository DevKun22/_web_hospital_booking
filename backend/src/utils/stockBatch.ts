// Quy tắc lô thuốc và hạn dùng, tách riêng khỏi cơ sở dữ liệu để kiểm thử được.
// Ngày luôn là chuỗi YYYY-MM-DD (giờ Việt Nam). Lô hết hạn khi hạn dùng nhỏ hơn hôm nay
// (đúng ngày hạn dùng vẫn còn dùng được).

export type BatchLike = { id: string; expiryDate: string; quantity: number };
export type BatchStatus = "EXPIRED" | "EXPIRING" | "OK";

export const EXPIRY_WARNING_DAYS = 60;

export const isExpired = (expiryDate: string, today: string) => expiryDate < today;

const dayNumber = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);

export const daysUntil = (expiryDate: string, today: string) => dayNumber(expiryDate) - dayNumber(today);

export const batchStatus = (expiryDate: string, today: string, warningDays = EXPIRY_WARNING_DAYS): BatchStatus => {
  if (isExpired(expiryDate, today)) return "EXPIRED";
  return daysUntil(expiryDate, today) <= warningDays ? "EXPIRING" : "OK";
};

// Tồn cấp được = tồn tổng trừ phần nằm trong các lô đã hết hạn.
export const sellableQuantity = (stockQuantity: number, batches: BatchLike[], today: string) =>
  stockQuantity - batches.filter((batch) => isExpired(batch.expiryDate, today)).reduce((sum, batch) => sum + batch.quantity, 0);

// Phần tồn chưa gắn lô (nhập trước khi quản lý lô hoặc nhập không khai lô).
export const unbatchedQuantity = (stockQuantity: number, batches: BatchLike[]) =>
  stockQuantity - batches.reduce((sum, batch) => sum + batch.quantity, 0);

export type Allocation = { batchId: string; quantity: number };

// FEFO: lấy từ lô còn hạn có hạn dùng sớm nhất trước; phần thiếu lấy từ tồn chưa gắn lô.
// Trả về null nếu không đủ hàng cấp được. Không bao giờ lấy từ lô đã hết hạn.
export const allocateFefo = (
  batches: BatchLike[],
  unbatchedAvailable: number,
  quantity: number,
  today: string,
): { allocations: Allocation[]; fromUnbatched: number } | null => {
  const usable = batches
    .filter((batch) => batch.quantity > 0 && !isExpired(batch.expiryDate, today))
    .sort((left, right) => (left.expiryDate < right.expiryDate ? -1 : left.expiryDate > right.expiryDate ? 1 : left.id < right.id ? -1 : 1));

  let remaining = quantity;
  const allocations: Allocation[] = [];
  for (const batch of usable) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity, remaining);
    allocations.push({ batchId: batch.id, quantity: take });
    remaining -= take;
  }

  if (remaining > Math.max(unbatchedAvailable, 0)) return null;
  return { allocations, fromUnbatched: remaining };
};
