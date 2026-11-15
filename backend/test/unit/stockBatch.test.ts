import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateFefo,
  availabilityLevel,
  batchStatus,
  daysUntil,
  isExpired,
  isShortFor,
  sellableQuantity,
  unbatchedQuantity,
  type BatchLike,
} from "../../src/utils/stockBatch.js";

const today = "2026-11-09";

test("expiry is inclusive of the expiry date itself", () => {
  assert.equal(isExpired("2026-11-08", today), true);
  assert.equal(isExpired("2026-11-09", today), false);
  assert.equal(daysUntil("2026-11-19", today), 10);
  assert.equal(batchStatus("2026-11-08", today), "EXPIRED");
  assert.equal(batchStatus("2026-12-31", today), "EXPIRING");
  assert.equal(batchStatus("2027-03-01", today), "OK");
});

test("sellable stock excludes expired batches and unbatched stock is the remainder", () => {
  const batches: BatchLike[] = [
    { id: "a", expiryDate: "2026-10-01", quantity: 30 },
    { id: "b", expiryDate: "2027-01-01", quantity: 50 },
  ];
  assert.equal(sellableQuantity(200, batches, today), 170);
  assert.equal(unbatchedQuantity(200, batches), 120);
});

test("FEFO takes the earliest-expiring usable batch first and spills into later ones", () => {
  const batches: BatchLike[] = [
    { id: "late", expiryDate: "2027-06-01", quantity: 100 },
    { id: "soon", expiryDate: "2026-12-01", quantity: 20 },
    { id: "expired", expiryDate: "2026-01-01", quantity: 500 },
  ];
  const result = allocateFefo(batches, 0, 50, today);
  assert.deepEqual(result, {
    allocations: [
      { batchId: "soon", quantity: 20 },
      { batchId: "late", quantity: 30 },
    ],
    fromUnbatched: 0,
  });
});

test("FEFO uses unbatched stock last and never touches expired batches", () => {
  const batches: BatchLike[] = [
    { id: "soon", expiryDate: "2026-12-01", quantity: 10 },
    { id: "expired", expiryDate: "2026-01-01", quantity: 500 },
  ];
  assert.deepEqual(allocateFefo(batches, 15, 20, today), {
    allocations: [{ batchId: "soon", quantity: 10 }],
    fromUnbatched: 10,
  });
  assert.equal(allocateFefo(batches, 5, 20, today), null);
});

test("availability exposes only three levels: out, low (at or below the minimum) and in stock", () => {
  assert.equal(availabilityLevel(0, 5), "OUT");
  assert.equal(availabilityLevel(-3, 0), "OUT");
  assert.equal(availabilityLevel(5, 5), "LOW");
  assert.equal(availabilityLevel(3, 5), "LOW");
  assert.equal(availabilityLevel(6, 5), "IN_STOCK");
  // Không đặt mức tối thiểu thì còn hàng là còn hàng, không bao giờ "sắp hết".
  assert.equal(availabilityLevel(1, 0), "IN_STOCK");
});

test("a prescribed quantity is short only when it exceeds what can be dispensed", () => {
  assert.equal(isShortFor(10, 10), false);
  assert.equal(isShortFor(10, 11), true);
  assert.equal(isShortFor(0, 1), true);
  assert.equal(isShortFor(-2, 1), true);
  // Chưa biết số lượng thì không kết luận là thiếu.
  assert.equal(isShortFor(0, null), false);
  assert.equal(isShortFor(0, undefined), false);
  assert.equal(isShortFor(0, 0), false);
});
