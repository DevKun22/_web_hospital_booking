import assert from "node:assert/strict";
import { test } from "node:test";

process.env.VNPAY_TMN_CODE = "TESTTMN1";
process.env.VNPAY_HASH_SECRET = "TESTSECRETTESTSECRETTESTSECRET12";
process.env.VNPAY_RETURN_URL = "https://api.example.test/api/payments/vnpay/return";

const { vnpayPaymentProvider, parseVerifiedVnpayCallback } = await import(
  "../../src/services/paymentProviders/vnpay.provider.js"
);

const createPaymentQuery = async () => {
  const result = await vnpayPaymentProvider.createPayment({
    provider: "VNPAY",
    transactionCode: "PAY-UNIT-001",
    invoiceId: "invoice-id",
    invoiceCode: "INV-001",
    amount: 250000,
    orderInfo: "Thanh toán hóa đơn INV-001",
    expiredAt: new Date(Date.now() + 15 * 60 * 1000),
    ipAddress: "203.0.113.10",
  });
  return Object.fromEntries(new URL(result.paymentUrl!).searchParams);
};

test("payment URL carries a signature that VNPAY-style verification accepts", async () => {
  const query = await createPaymentQuery();
  assert.equal(query.vnp_Amount, "25000000");
  assert.equal(query.vnp_OrderInfo, "Thanh toan hoa don INV 001");
  assert.match(query.vnp_CreateDate, /^\d{14}$/);

  // Mô phỏng VNPAY gửi lại các tham số kèm kết quả và chữ ký mới.
  const { vnp_SecureHash: _ignored, ...signed } = query;
  const callback = {
    ...signed,
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TransactionNo: "14000001",
  };
  const crypto = await import("node:crypto");
  const signData = Object.keys(callback)
    .sort()
    .map((key) => `${key}=${encodeURIComponent((callback as Record<string, string>)[key]).replace(/%20/g, "+")}`)
    .join("&");
  const hash = crypto
    .createHmac("sha512", process.env.VNPAY_HASH_SECRET!)
    .update(signData)
    .digest("hex");

  const verified = parseVerifiedVnpayCallback({ ...callback, vnp_SecureHash: hash });
  assert.equal(verified.txnRef, "PAY-UNIT-001");
  assert.equal(verified.amount, 250000);
  assert.equal(verified.isSuccess, true);

  assert.throws(
    () => parseVerifiedVnpayCallback({ ...callback, vnp_Amount: "100", vnp_SecureHash: hash }),
    /Chữ ký VNPAY không hợp lệ/,
  );
});
