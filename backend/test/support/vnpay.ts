import crypto from "node:crypto";

// Đóng vai VNPay trong test: ký dữ liệu callback (Return URL hoặc IPN) đúng thuật
// toán của VNPay (HMAC-SHA512 trên query sắp xếp theo khóa, khoảng trắng là "+").
// Hàm này cố ý viết độc lập với provider để test bắt được sai lệch thuật toán.

export const VNPAY_TEST_TMN_CODE = "TESTTMN1";
export const VNPAY_TEST_HASH_SECRET = "TESTSECRETTESTSECRETTESTSECRET12";
export const VNPAY_TEST_RETURN_URL = "https://api.example.test/api/payments/vnpay/return";
export const VNPAY_TEST_RESULT_URL = "https://web.example.test/thanh-toan/ket-qua";

export const vnpayTestEnvironment = {
  PAYMENT_VNPAY_ENABLED: "true",
  VNPAY_TMN_CODE: VNPAY_TEST_TMN_CODE,
  VNPAY_HASH_SECRET: VNPAY_TEST_HASH_SECRET,
  VNPAY_RETURN_URL: VNPAY_TEST_RETURN_URL,
  PAYMENT_RESULT_URL: VNPAY_TEST_RESULT_URL,
};

const encode = (value: string) => encodeURIComponent(value).replace(/%20/g, "+");

export const signVnpayParams = (
  params: Record<string, string>,
  secret = VNPAY_TEST_HASH_SECRET,
) => {
  const data = Object.keys(params)
    .sort()
    .map((key) => `${key}=${encode(params[key])}`)
    .join("&");
  const hash = crypto.createHmac("sha512", secret).update(data).digest("hex");
  return { data, hash };
};

export type VnpayCallbackInput = {
  transactionCode: string;
  amount: number;
  // "00" là thành công; mã khác (ví dụ "24" khách hủy) là thất bại.
  responseCode?: string;
  transactionStatus?: string;
  tmnCode?: string;
  secret?: string;
};

// Trả về query string hoàn chỉnh (kèm vnp_SecureHash) để gắn sau "?".
export const buildVnpayCallbackQuery = (input: VnpayCallbackInput) => {
  const responseCode = input.responseCode ?? "00";
  const params: Record<string, string> = {
    vnp_TmnCode: input.tmnCode ?? VNPAY_TEST_TMN_CODE,
    vnp_Amount: String(input.amount * 100),
    vnp_BankCode: "NCB",
    vnp_OrderInfo: "Thanh toan hoa don test",
    vnp_PayDate: "20261107120000",
    vnp_ResponseCode: responseCode,
    vnp_TransactionNo: "14000001",
    vnp_TransactionStatus: input.transactionStatus ?? responseCode,
    vnp_TxnRef: input.transactionCode,
  };
  const { data, hash } = signVnpayParams(params, input.secret);
  return `${data}&vnp_SecureHash=${hash}`;
};

// Phản hồi của API querydr, ký đúng đặc tả (các trường nối bằng "|"); viết độc lập với provider.
export const buildVnpayQueryResponse = (input: {
  transactionCode: string;
  amount: number;
  responseCode?: string;
  transactionStatus?: string;
  secret?: string;
}) => {
  const data: Record<string, string> = {
    vnp_ResponseId: "resp-test",
    vnp_Command: "querydr",
    vnp_ResponseCode: input.responseCode ?? "00",
    vnp_Message: "QueryDR Success",
    vnp_TmnCode: VNPAY_TEST_TMN_CODE,
    vnp_TxnRef: input.transactionCode,
    vnp_Amount: String(input.amount * 100),
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261108120000",
    vnp_TransactionNo: "15000001",
    vnp_TransactionType: "01",
    vnp_TransactionStatus: input.transactionStatus ?? "00",
    vnp_OrderInfo: "Thanh toan",
  };
  const fields = [
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
    "",
    "",
  ];
  const vnp_SecureHash = crypto
    .createHmac("sha512", input.secret ?? VNPAY_TEST_HASH_SECRET)
    .update(fields.join("|"))
    .digest("hex");
  return { ...data, vnp_SecureHash };
};
