# Vận hành thanh toán VNPay

VNPay là cổng thanh toán online duy nhất của hệ thống. MoMo, ZaloPay và thanh toán giả lập (mock) đã được gỡ khỏi mã nguồn và khỏi cơ sở dữ liệu (migration `20261107110000_remove_momo_and_mock_payment`).

## Phạm vi đã triển khai

- Backend tạo giao dịch qua provider adapter (`backend/src/services/paymentProviders/vnpay.provider.ts`) và chỉ công bố VNPay khi cờ bật và đủ thông tin cấu hình. Trạng thái này lấy ở `GET /api/v1/capabilities` (`payment.enabled`, `supportedProviders`).
- Mỗi hóa đơn chỉ có một giao dịch đang hoạt động (`activeKey`); `Idempotency-Key` chống tạo trùng khi người dùng bấm nhiều lần. Giao dịch hết hạn sau 15 phút.
- Dữ liệu VNPay gửi về được xác thực bằng chữ ký HMAC-SHA512 (so sánh thời gian hằng định), mã merchant (`vnp_TmnCode`) và số tiền (nhân 100) trước khi chạm vào dữ liệu. Sai chữ ký trả mã `97`.
- Return URL và IPN dùng chung một hàm xử lý idempotent (`PaymentService.handleVnpayCallback`). Gọi lại nhiều lần chỉ ghi nhận thanh toán một lần, trong một giao dịch cơ sở dữ liệu có khóa hóa đơn.
- Trình duyệt người dùng chỉ là kênh chuyển trang. Trạng thái chính xác luôn lấy từ hóa đơn trong tài khoản.
- Địa chỉ IP gửi sang VNPay được chuẩn hóa về IPv4 (`normalizeVnpayIp`); giá trị không hợp lệ dùng `127.0.0.1`.

## Điểm cuối

| Mục đích | Đường dẫn | Ghi chú |
|---|---|---|
| Return URL | `GET /api/payments/vnpay/return` | Xác thực, ghi nhận, rồi chuyển sang trang kết quả web (`PAYMENT_RESULT_URL`) kèm `status=success/failed/error` |
| IPN | `GET /api/payments/vnpay/ipn` | VNPay gọi server-to-server; luôn trả HTTP 200 kèm `RspCode` |
| Tạo giao dịch | `POST /api/v1/me/invoices/:id/payments` | Cổng bệnh nhân (web và mobile), cần đăng nhập |

Mã phản hồi IPN: `00` thành công, `01` không thấy giao dịch, `02` trạng thái xung đột, `04` sai số tiền, `97` sai chữ ký, `99` lỗi khác.

## Cấu hình

```env
PAYMENT_VNPAY_ENABLED=true
VNPAY_TMN_CODE=<mã terminal do VNPay cấp>
VNPAY_HASH_SECRET=<khóa bí mật do VNPay cấp>
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://<api>/api/payments/vnpay/return
PAYMENT_RESULT_URL=https://<web>/thanh-toan/ket-qua
```

- `VNPAY_TMN_CODE` và `VNPAY_HASH_SECRET` chỉ nằm ở backend hoặc secret manager. Không đưa vào Flutter, biến công khai của Next.js, Git hay tài liệu.
- `VNPAY_RETURN_URL` và `PAYMENT_RESULT_URL` phải là địa chỉ HTTPS của môi trường đang chạy. Không import nguyên file `.env` local lên máy chủ: giá trị localhost sẽ làm thanh toán quay về sai chỗ.
- Trong cổng quản trị merchant của VNPay (sandbox: mục "Cấu hình IPN URL"), đăng ký IPN URL `https://<api>/api/payments/vnpay/ipn` cho đúng terminal.
- Bật `PAYMENT_VNPAY_ENABLED` chỉ sau khi hai khóa đã được cấu hình; thiếu khóa thì hệ thống tự ẩn VNPay.

## Quy trình kiểm thử sandbox

1. Tạo hóa đơn `UNPAID` cho một lịch đã hoàn thành (dashboard, quyền `invoice.manage`).
2. Đăng nhập cổng người khám, mở hóa đơn và chọn VNPay.
3. Ở trang VNPay chọn "Thẻ nội địa và tài khoản ngân hàng", ngân hàng NCB, và dùng thẻ test do VNPay công bố trong tài liệu sandbox (số thẻ, tên chủ thẻ, ngày phát hành, mật khẩu OTP test).
4. Sau khi trả, trình duyệt quay về trang kết quả của web. Kiểm tra: giao dịch `SUCCESS`, hóa đơn `PAID` với `paymentMethod=VNPAY` và số tiền đúng, có thông báo "Thanh toán đã được ghi nhận", log có Return URL (302) rồi IPN (200, `RspCode` `00`).
5. Kiểm tra các trường hợp lỗi: hủy giữa chừng hoặc nhập sai OTP (giao dịch `FAILED`, hóa đơn vẫn `UNPAID`), chữ ký hoặc số tiền bị sửa (bị từ chối, hóa đơn không đổi), gọi lại IPN (không ghi nhận lần hai).

Kết quả nghiệm thu trên production ngày 08/11/2026: lịch thử `BK20261107338497`, hóa đơn 300.000 đ, trả bằng thẻ test NCB; Return URL trả 302 rồi IPN trả 200 trong vòng 0,5 giây; hóa đơn chuyển `PAID` qua VNPAY, đủ chuỗi 6 thông báo tới người khám.

## Chuyển production thật

- Thay `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` bằng khóa production và `VNPAY_PAYMENT_URL` bằng địa chỉ cổng thanh toán chính thức do VNPay cung cấp khi ký hợp đồng.
- Đăng ký lại IPN URL trong cổng merchant production.
- Theo dõi giao dịch `PENDING` kéo dài, tỷ lệ IPN lỗi và chênh lệch giữa hóa đơn và giao dịch (log theo `requestId`, không ghi khóa hay chữ ký).
- Khi có sự cố nhà cung cấp, đặt `PAYMENT_VNPAY_ENABLED=false`; dữ liệu giao dịch cũ vẫn giữ để đối soát.

## Đối soát chủ động bằng querydr

Khi cả Return URL và IPN đều lỡ (ví dụ máy chủ đang ngủ), hệ thống tự hỏi VNPay bằng API `querydr` (`POST` JSON, chữ ký HMAC-SHA512 trên các trường nối bằng `|`, phản hồi cũng được xác thực chữ ký và đối chiếu mã giao dịch).

- **Quét định kỳ:** worker `payments` (`INLINE_WORKERS=...,payments` hoặc `npm run worker:payments`) chạy mỗi 5 phút (`PAYMENT_RECONCILIATION_INTERVAL_MS`, tối thiểu 60 giây), lấy tối đa 50 giao dịch VNPAY còn `PENDING` đã tạo trên 2 phút.
- **Khi người dùng mở lại giao dịch:** `GET /api/v1/me/payments/:id` tự đối soát nếu giao dịch `PENDING` quá 2 phút, tối đa một lần mỗi 30 giây cho mỗi giao dịch.
- **Kết quả:** `vnp_TransactionStatus=00` ghi nhận thanh toán (qua cùng hàm idempotent với IPN, kiểm tra số tiền khớp giao dịch và hóa đơn); `02` ghi nhận `FAILED`; `01` hoặc mã `91` (VNPay không có giao dịch) giữ `PENDING` cho tới khi quá hạn thêm 2 phút rồi chuyển `EXPIRED`; trạng thái đảo/hoàn tiền (04 đến 09) và mã lỗi khác được giữ nguyên để xử lý thủ công.
- **Cấu hình:** `VNPAY_QUERY_URL` (mặc định sandbox `https://sandbox.vnpayment.vn/merchant_webapi/api/transaction`, production dùng địa chỉ do VNPay cấp). Trên Render cần thêm `payments` vào `INLINE_WORKERS`.
- **An toàn:** lỗi mạng hoặc chữ ký phản hồi sai không làm đổi dữ liệu và không làm hỏng việc xem giao dịch; log chỉ ghi mã lỗi, không ghi khóa hay chữ ký.

## Giới hạn hiện tại

- Chưa tích hợp API hoàn tiền của VNPay: hoàn tiền (`invoice.refund`) chỉ đánh dấu trong hệ thống và phải xử lý phía VNPay.
- Máy chủ gói free của Render ngủ sau 15 phút không có yêu cầu; lần gọi đầu có thể mất khoảng 50 giây, nên IPN đầu tiên có thể chậm.
