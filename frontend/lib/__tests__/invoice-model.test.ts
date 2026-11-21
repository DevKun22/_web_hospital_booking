import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildInsuranceForm, buildInsurancePayload, calculateInsuranceDiscount } from "../../app/dashboard/invoices/invoice-model";
import { formatMoneyInput, parseMoneyInput, toMoneyNumber } from "../money-input";
import type { Invoice } from "../types";

const invoice = (patch: Partial<Invoice>) => patch as Invoice;

describe("tiền và BHYT của hóa đơn", () => {
  it("chuỗi nhập tiền chỉ giữ chữ số", () => {
    assert.equal(parseMoneyInput("1.250.000 đ"), "1250000");
    assert.equal(toMoneyNumber(""), 0);
    assert.equal(toMoneyNumber("350.000"), 350000);
    assert.equal(formatMoneyInput(""), "");
    assert.match(formatMoneyInput("1250000"), /^1[.  ]?250[.  ]?000$/);
  });

  it("giảm trừ BHYT làm tròn xuống theo mức hưởng", () => {
    const form = { eligibleAmount: "333333", coverageRate: "80", routeType: "RIGHT_ROUTE" as const, note: "" };
    assert.equal(calculateInsuranceDiscount(form), 266666);
    assert.equal(calculateInsuranceDiscount({ ...form, coverageRate: "0" }), 0);
    assert.equal(calculateInsuranceDiscount({ ...form, eligibleAmount: "" }), 0);
  });

  it("không có số tiền BHYT thì xóa mức hưởng, tuyến và ghi chú", () => {
    const payload = buildInsurancePayload({ eligibleAmount: "", coverageRate: "95", routeType: "REFERRAL", note: "x" });
    assert.deepEqual(payload, { insuranceEligibleAmount: 0, insuranceCoverageRate: 0, insuranceRouteType: null, insuranceNote: null });
    const withAmount = buildInsurancePayload({ eligibleAmount: "200000", coverageRate: "95", routeType: "REFERRAL", note: " ghi chú " });
    assert.deepEqual(withAmount, { insuranceEligibleAmount: 200000, insuranceCoverageRate: 95, insuranceRouteType: "REFERRAL", insuranceNote: "ghi chú" });
  });

  it("mở lại hóa đơn đã áp BHYT giữ nguyên mức hưởng 0%, chưa áp thì mặc định 80%", () => {
    assert.equal(buildInsuranceForm(invoice({ insuranceEligibleAmount: 100000, insuranceCoverageRate: 0 })).coverageRate, "0");
    assert.equal(buildInsuranceForm(invoice({ insuranceEligibleAmount: 100000, insuranceCoverageRate: 95 })).coverageRate, "95");
    assert.equal(buildInsuranceForm(invoice({ insuranceEligibleAmount: 0, insuranceCoverageRate: 0 })).coverageRate, "80");
    assert.equal(buildInsuranceForm(invoice({})).routeType, "RIGHT_ROUTE");
  });
});
