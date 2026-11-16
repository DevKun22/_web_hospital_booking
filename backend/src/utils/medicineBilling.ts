// Quy tắc tính tiền thuốc trên hóa đơn, tách khỏi cơ sở dữ liệu để kiểm thử được.
// Tiền thuốc được tính từ lúc phát hành đơn (theo số lượng kê); khi dược sĩ cấp thì theo số lượng thực cấp.
// Mỗi dòng hóa đơn gắn với đúng một dòng đơn thuốc nên đồng bộ lặp lại không tính tiền hai lần.

type FulfillmentLike = "PENDING" | "DISPENSED" | "OUTSIDE" | "OUT_OF_STOCK";

export type BillableItem = {
  id: string;
  medicineName: string;
  unit: string | null;
  quantity: number | null;
  dispensedQuantity: number;
  fulfillmentStatus: FulfillmentLike;
  medicineId: string | null;
  medicine: { unitPrice: number } | null;
};

type MedicineLineDraft = {
  prescriptionItemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

// Dòng cần có trên hóa đơn cho một dòng đơn, hoặc null nếu không tính tiền (thuốc ngoài danh mục, giá 0,
// người khám tự mua, hết hàng, hoặc chưa có số lượng). `snapshotPrice` là giá đã chụp ở dòng hóa đơn hiện có:
// giá không đổi giữa lúc phát hành và lúc thanh toán dù giá thuốc trong kho đổi.
export const desiredMedicineLine = (item: BillableItem, snapshotPrice?: number | null): MedicineLineDraft | null => {
  if (!item.medicineId || !item.medicine) return null;
  if (item.fulfillmentStatus === "OUTSIDE" || item.fulfillmentStatus === "OUT_OF_STOCK") return null;
  const unitPrice = snapshotPrice ?? item.medicine.unitPrice;
  const quantity = item.fulfillmentStatus === "DISPENSED" ? item.dispensedQuantity : (item.quantity ?? 0);
  if (unitPrice <= 0 || quantity <= 0) return null;
  return {
    prescriptionItemId: item.id,
    description: `Thuốc: ${item.medicineName}${item.unit ? ` (${item.unit})` : ""}`,
    quantity,
    unitPrice,
    amount: unitPrice * quantity,
  };
};

type ExistingMedicineLine = { id: string; prescriptionItemId: string; quantity: number; unitPrice: number };

type MedicineLineDiff = {
  add: MedicineLineDraft[];
  update: { id: string; quantity: number; amount: number }[];
  remove: { id: string; amount: number }[];
  // Thay đổi tổng tiền (có dấu) nếu áp dụng diff.
  delta: number;
};

// So sánh dòng mong muốn với dòng hiện có (chỉ các dòng đã gắn dòng đơn). Giá đã chụp được giữ nguyên.
export const diffMedicineLines = (items: BillableItem[], existing: ExistingMedicineLine[]): MedicineLineDiff => {
  const byItem = new Map(existing.map((line) => [line.prescriptionItemId, line]));
  const diff: MedicineLineDiff = { add: [], update: [], remove: [], delta: 0 };
  const wanted = new Set<string>();

  for (const item of items) {
    const current = byItem.get(item.id);
    const desired = desiredMedicineLine(item, current?.unitPrice);
    if (!desired) continue;
    wanted.add(item.id);
    if (!current) {
      diff.add.push(desired);
      diff.delta += desired.amount;
    } else if (current.quantity !== desired.quantity) {
      diff.update.push({ id: current.id, quantity: desired.quantity, amount: desired.amount });
      diff.delta += desired.amount - current.unitPrice * current.quantity;
    }
  }
  for (const line of existing) {
    if (wanted.has(line.prescriptionItemId)) continue;
    diff.remove.push({ id: line.id, amount: line.unitPrice * line.quantity });
    diff.delta -= line.unitPrice * line.quantity;
  }
  return diff;
};
