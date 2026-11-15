import assert from "node:assert/strict";
import test from "node:test";
import {
  desiredMedicineLine,
  diffMedicineLines,
  type BillableItem,
} from "../../src/utils/medicineBilling.js";

const item = (overrides: Partial<BillableItem> = {}): BillableItem => ({
  id: "item-1",
  medicineName: "Amoxicillin",
  unit: "viên",
  quantity: 10,
  dispensedQuantity: 0,
  fulfillmentStatus: "PENDING",
  medicineId: "med-1",
  medicine: { unitPrice: 2000 },
  ...overrides,
});

test("a pending stock line is billed by prescribed quantity at the current price", () => {
  const line = desiredMedicineLine(item());
  assert.deepEqual(line, {
    prescriptionItemId: "item-1",
    description: "Thuốc: Amoxicillin (viên)",
    quantity: 10,
    unitPrice: 2000,
    amount: 20000,
  });
});

test("a dispensed line is billed by the quantity actually dispensed", () => {
  const line = desiredMedicineLine(item({ fulfillmentStatus: "DISPENSED", dispensedQuantity: 8 }));
  assert.equal(line?.quantity, 8);
  assert.equal(line?.amount, 16000);
});

test("lines that are not sold by the facility are never billed", () => {
  assert.equal(desiredMedicineLine(item({ medicineId: null, medicine: null })), null, "thuốc ngoài danh mục");
  assert.equal(desiredMedicineLine(item({ medicine: { unitPrice: 0 } })), null, "giá 0");
  assert.equal(desiredMedicineLine(item({ quantity: null })), null, "chưa có số lượng");
  assert.equal(desiredMedicineLine(item({ fulfillmentStatus: "OUTSIDE" })), null, "người khám tự mua");
  assert.equal(desiredMedicineLine(item({ fulfillmentStatus: "OUT_OF_STOCK" })), null, "kho hết hàng");
});

test("the price already on the invoice line wins over a later price change", () => {
  const line = desiredMedicineLine(item({ medicine: { unitPrice: 5000 } }), 2000);
  assert.equal(line?.unitPrice, 2000);
  assert.equal(line?.amount, 20000);
});

test("syncing is idempotent: the same state produces no change", () => {
  const items = [item()];
  const first = diffMedicineLines(items, []);
  assert.equal(first.add.length, 1);
  assert.equal(first.delta, 20000);
  const again = diffMedicineLines(items, [{ id: "line-1", prescriptionItemId: "item-1", quantity: 10, unitPrice: 2000 }]);
  assert.deepEqual(again, { add: [], update: [], remove: [], delta: 0 });
});

test("an out-of-stock or outside line is removed and the total goes down by exactly its amount", () => {
  const existing = [{ id: "line-1", prescriptionItemId: "item-1", quantity: 10, unitPrice: 2000 }];
  const outOfStock = diffMedicineLines([item({ fulfillmentStatus: "OUT_OF_STOCK" })], existing);
  assert.deepEqual(outOfStock, { add: [], update: [], remove: [{ id: "line-1", amount: 20000 }], delta: -20000 });
  const outside = diffMedicineLines([item({ fulfillmentStatus: "OUTSIDE" })], existing);
  assert.equal(outside.delta, -20000);
});

test("a changed quantity updates the existing line and keeps its price snapshot", () => {
  const existing = [{ id: "line-1", prescriptionItemId: "item-1", quantity: 10, unitPrice: 2000 }];
  const diff = diffMedicineLines([item({ quantity: 12, medicine: { unitPrice: 9999 } })], existing);
  assert.deepEqual(diff.update, [{ id: "line-1", quantity: 12, amount: 24000 }]);
  assert.equal(diff.delta, 4000);
});

test("lines whose prescription item disappeared are removed", () => {
  const existing = [{ id: "line-9", prescriptionItemId: "gone", quantity: 2, unitPrice: 1500 }];
  const diff = diffMedicineLines([], existing);
  assert.deepEqual(diff.remove, [{ id: "line-9", amount: 3000 }]);
  assert.equal(diff.delta, -3000);
});
