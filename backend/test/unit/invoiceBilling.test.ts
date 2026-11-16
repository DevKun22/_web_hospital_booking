import assert from "node:assert/strict";
import test from "node:test";

import { buildInvoiceItems, calculateInsurance } from "../../src/utils/invoiceBilling.js";

const withInsurance = { hasBHYT: true, package: null };
const withoutInsurance = { hasBHYT: false, package: null };

test("a consultation invoice has the exam fee line and adds the booking fee only when it is above zero", () => {
  const base = { estimatedPrice: 200_000, serviceFee: 0, package: null, department: { name: "Khoa tổng quát" } };
  assert.deepEqual(buildInvoiceItems(base).map((item) => [item.type, item.description, item.amount]), [
    ["CONSULTATION", "Phí khám: Khoa tổng quát", 200_000],
  ]);

  const withFee = buildInvoiceItems({ ...base, serviceFee: 10_000 });
  assert.deepEqual(withFee.map((item) => [item.type, item.amount, item.sortOrder]), [
    ["CONSULTATION", 200_000, 0],
    ["SERVICE_FEE", 10_000, 1],
  ]);

  const packaged = buildInvoiceItems({ ...base, package: { name: "Gói tổng quát" } });
  assert.equal(packaged[0].type, "PACKAGE");
  assert.equal(packaged[0].description, "Gói khám: Gói tổng quát");
});

test("insurance is calculated from the eligible amount and rate, and the final amount is what is left", () => {
  const result = calculateInsurance(
    { insuranceEligibleAmount: 100_000, insuranceCoverageRate: 80, insuranceRouteType: "SERVICE" },
    200_000,
    withInsurance,
  );
  assert.equal(result.insuranceDiscountAmount, 80_000);
  assert.equal(result.bhytDiscount, 80_000);
  assert.equal(result.finalAmount, 120_000);
});

test("a plain discount without structured insurance fields is treated as fully covered", () => {
  const result = calculateInsurance({ bhytDiscount: 50_000 }, 200_000, withInsurance);
  assert.equal(result.insuranceEligibleAmount, 50_000);
  assert.equal(result.insuranceCoverageRate, 100);
  assert.equal(result.finalAmount, 150_000);
  assert.equal(result.insuranceRouteType, "SERVICE");
});

test("no insurance fields means no discount and the full amount is charged", () => {
  const result = calculateInsurance({}, 200_000, withoutInsurance);
  assert.equal(result.bhytDiscount, 0);
  assert.equal(result.finalAmount, 200_000);
  assert.equal(result.insuranceRouteType, null);
});

test("insurance is refused when it exceeds the total, when the visit has no BHYT, or when the package does not support it", () => {
  assert.throws(() => calculateInsurance({ insuranceEligibleAmount: 300_000, insuranceCoverageRate: 50 }, 200_000, withInsurance), /không được lớn hơn tổng tiền/);
  assert.throws(() => calculateInsurance({ bhytDiscount: 300_000 }, 200_000, withInsurance), /không được lớn hơn tổng tiền/);
  assert.throws(() => calculateInsurance({ bhytDiscount: 10_000 }, 200_000, withoutInsurance), /không có BHYT/);
  assert.throws(
    () => calculateInsurance({ bhytDiscount: 10_000 }, 200_000, { hasBHYT: true, package: { isBHYTSupport: false } }),
    /không hỗ trợ giảm trừ BHYT/,
  );
});

test("the fallback discount is used when the input carries no insurance data", () => {
  const result = calculateInsurance({}, 200_000, withInsurance, 20_000);
  assert.equal(result.insuranceDiscountAmount, 20_000);
  assert.equal(result.finalAmount, 180_000);
});
