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

test("client IP is normalized to IPv4 for VNPAY", async () => {
  const { normalizeVnpayIp } = await import(
    "../../src/services/paymentProviders/vnpay.provider.js"
  );
  assert.equal(normalizeVnpayIp("::ffff:203.0.113.7"), "203.0.113.7");
  assert.equal(normalizeVnpayIp("203.0.113.7"), "203.0.113.7");
  assert.equal(normalizeVnpayIp("2001:db8::1"), "127.0.0.1");
  assert.equal(normalizeVnpayIp("999.1.1.1"), "127.0.0.1");
  assert.equal(normalizeVnpayIp(undefined), "127.0.0.1");
});

// ---- querydr -------------------------------------------------------------
// Chữ ký viết độc lập với provider (nối bằng "|" theo đặc tả VNPAY 2.1.0).
const crypto = await import("node:crypto");
const hmac = (fields: Array<string | undefined>) =>
  crypto
    .createHmac("sha512", "TESTSECRETTESTSECRETTESTSECRET12")
    .update(fields.map((value) => value ?? "").join("|"))
    .digest("hex");

const signedQueryResponse = (overrides: Record<string, string | undefined> = {}) => {
  const data: Record<string, string | undefined> = {
    vnp_ResponseId: "resp-1",
    vnp_Command: "querydr",
    vnp_ResponseCode: "00",
    vnp_Message: "QueryDR Success",
    vnp_TmnCode: "TESTTMN1",
    vnp_TxnRef: "PAY-UNIT-001",
    vnp_Amount: "25000000",
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261108120000",
    vnp_TransactionNo: "14000001",
    vnp_TransactionType: "01",
    vnp_TransactionStatus: "00",
    vnp_OrderInfo: "Thanh toan",
    ...overrides,
  };
  const vnp_SecureHash = hmac([
    data.vnp_ResponseId,
    data.vnp_Command,
    data.vnp_ResponseCode,
    data.vnp_Message,
    "TESTTMN1",
    data.vnp_TxnRef,
    data.vnp_Amount,
    data.vnp_BankCode,
    data.vnp_PayDate,
    data.vnp_TransactionNo,
    data.vnp_TransactionType,
    data.vnp_TransactionStatus,
    data.vnp_OrderInfo,
    undefined,
    undefined,
  ]);
  return { ...data, vnp_SecureHash };
};

const fakeFetch = (payload: unknown, captured?: { body?: Record<string, string> }) =>
  (async (_url: unknown, init?: RequestInit) => {
    if (captured) captured.body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(payload), { status: 200 });
  }) as unknown as typeof fetch;

test("querydr sends a correctly signed request and accepts a signed paid response", async () => {
  const { queryVnpayTransaction } = await import(
    "../../src/services/paymentProviders/vnpay.provider.js"
  );
  const captured: { body?: Record<string, string> } = {};
  const result = await queryVnpayTransaction(
    { txnRef: "PAY-UNIT-001", transactionDate: "20261108115900", ipAddress: "203.0.113.10" },
    fakeFetch(signedQueryResponse(), captured),
  );

  const body = captured.body!;
  assert.equal(body.vnp_Command, "querydr");
  assert.equal(body.vnp_TransactionDate, "20261108115900");
  assert.match(body.vnp_RequestId, /^[0-9a-f]{32}$/);
  assert.equal(
    body.vnp_SecureHash,
    hmac([
      body.vnp_RequestId,
      body.vnp_Version,
      body.vnp_Command,
      body.vnp_TmnCode,
      body.vnp_TxnRef,
      body.vnp_TransactionDate,
      body.vnp_CreateDate,
      body.vnp_IpAddr,
      body.vnp_OrderInfo,
    ]),
  );

  assert.equal(result.outcome, "PAID");
  assert.equal(result.amount, 250000);
  assert.equal(result.transactionNo, "14000001");
});

test("querydr rejects tampered or foreign responses", async () => {
  const { queryVnpayTransaction } = await import(
    "../../src/services/paymentProviders/vnpay.provider.js"
  );
  const input = { txnRef: "PAY-UNIT-001", transactionDate: "20261108115900" };

  const tampered = { ...signedQueryResponse(), vnp_Amount: "100" };
  await assert.rejects(
    queryVnpayTransaction(input, fakeFetch(tampered)),
    /Chữ ký phản hồi truy vấn VNPAY không hợp lệ/,
  );
  await assert.rejects(
    queryVnpayTransaction(input, fakeFetch({ ...signedQueryResponse(), vnp_SecureHash: "" })),
    /Chữ ký phản hồi/,
  );
  await assert.rejects(
    queryVnpayTransaction(input, fakeFetch(signedQueryResponse({ vnp_TxnRef: "OTHER-TXN" }))),
    /không khớp giao dịch/,
  );
  await assert.rejects(
    queryVnpayTransaction(input, (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch),
    /Không kết nối được VNPAY/,
  );
});

test("querydr outcome mapping distinguishes paid, pending, failed and not found", async () => {
  const { interpretVnpayQuery } = await import(
    "../../src/services/paymentProviders/vnpay.provider.js"
  );
  assert.equal(interpretVnpayQuery("00", "00"), "PAID");
  assert.equal(interpretVnpayQuery("00", "01"), "PENDING");
  assert.equal(interpretVnpayQuery("00", "02"), "FAILED");
  assert.equal(interpretVnpayQuery("91", null), "NOT_FOUND");
  assert.equal(interpretVnpayQuery("00", "04"), "UNKNOWN");
  assert.equal(interpretVnpayQuery("94", null), "UNKNOWN");
  assert.equal(interpretVnpayQuery("99", null), "UNKNOWN");
});

// ---- refund --------------------------------------------------------------
const signedRefundResponse = (overrides: Record<string, string | undefined> = {}) => {
  const data: Record<string, string | undefined> = {
    vnp_ResponseId: "resp-r1",
    vnp_Command: "refund",
    vnp_ResponseCode: "00",
    vnp_Message: "Refund Success",
    vnp_TmnCode: "TESTTMN1",
    vnp_TxnRef: "PAY-UNIT-001",
    vnp_Amount: "25000000",
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261108130000",
    vnp_TransactionNo: "16000001",
    vnp_TransactionType: "02",
    vnp_TransactionStatus: "05",
    vnp_OrderInfo: "Hoan tien",
    ...overrides,
  };
  const vnp_SecureHash = hmac([
    data.vnp_ResponseId,
    data.vnp_Command,
    data.vnp_ResponseCode,
    data.vnp_Message,
    data.vnp_TmnCode,
    data.vnp_TxnRef,
    data.vnp_Amount,
    data.vnp_BankCode,
    data.vnp_PayDate,
    data.vnp_TransactionNo,
    data.vnp_TransactionType,
    data.vnp_TransactionStatus,
    data.vnp_OrderInfo,
  ]);
  return { ...data, vnp_SecureHash };
};

const refundInput = {
  requestId: "a".repeat(32),
  txnRef: "PAY-UNIT-001",
  amount: 250000,
  transactionNo: "14000001",
  transactionDate: "20261108115900",
  createBy: "admin-1",
  reason: "Bệnh nhân yêu cầu hoàn",
  ipAddress: "203.0.113.10",
};

test("refund sends a correctly signed full-refund request and accepts a signed response", async () => {
  const { refundVnpayTransaction } = await import(
    "../../src/services/paymentProviders/vnpay.provider.js"
  );
  const captured: { body?: Record<string, string> } = {};
  const result = await refundVnpayTransaction(refundInput, fakeFetch(signedRefundResponse(), captured));

  const body = captured.body!;
  assert.equal(body.vnp_Command, "refund");
  assert.equal(body.vnp_TransactionType, "02");
  assert.equal(body.vnp_Amount, 25000000);
  assert.equal(body.vnp_OrderInfo, "Benh nhan yeu cau hoan");
  assert.equal(
    body.vnp_SecureHash,
    hmac([
      body.vnp_RequestId,
      body.vnp_Version,
      body.vnp_Command,
      body.vnp_TmnCode,
      body.vnp_TransactionType,
      body.vnp_TxnRef,
      String(body.vnp_Amount),
      body.vnp_TransactionNo,
      body.vnp_TransactionDate,
      body.vnp_CreateBy,
      body.vnp_CreateDate,
      body.vnp_IpAddr,
      body.vnp_OrderInfo,
    ]),
  );
  assert.deepEqual(result, {
    outcome: "ACCEPTED",
    responseCode: "00",
    refundTransactionNo: "16000001",
    transactionStatus: "05",
  });
});

test("refund distinguishes a definite rejection from an unverifiable result", async () => {
  const { refundVnpayTransaction } = await import(
    "../../src/services/paymentProviders/vnpay.provider.js"
  );

  // Từ chối rõ ràng, có chữ ký hợp lệ: an toàn để cho thử lại.
  const rejected = await refundVnpayTransaction(
    refundInput,
    fakeFetch(signedRefundResponse({ vnp_ResponseCode: "95" })),
  );
  assert.equal(rejected.outcome, "REJECTED");
  const refusedLater = await refundVnpayTransaction(
    refundInput,
    fakeFetch(signedRefundResponse({ vnp_TransactionStatus: "09" })),
  );
  assert.equal(refusedLater.outcome, "REJECTED");

  // Mọi trường hợp còn lại có thể tiền đã được hoàn: phải báo chưa xác nhận.
  const unverifiedCases: Array<[string, typeof fetch]> = [
    ["unknown code", fakeFetch(signedRefundResponse({ vnp_ResponseCode: "99" }))],
    ["tampered", fakeFetch({ ...signedRefundResponse(), vnp_Amount: "100" })],
    ["foreign txn", fakeFetch(signedRefundResponse({ vnp_TxnRef: "OTHER" }))],
    [
      "http 500",
      (async () => new Response("boom", { status: 500 })) as unknown as typeof fetch,
    ],
    [
      "network",
      (async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch,
    ],
  ];
  for (const [label, fetchImpl] of unverifiedCases) {
    await assert.rejects(
      refundVnpayTransaction(refundInput, fetchImpl),
      (error: { code?: string }) => error.code === "VNPAY_REFUND_UNVERIFIED",
      label,
    );
  }
});
