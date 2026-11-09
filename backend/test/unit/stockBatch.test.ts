import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateFefo,
  batchStatus,
  daysUntil,
  isExpired,
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
