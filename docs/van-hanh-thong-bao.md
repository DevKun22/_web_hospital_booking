# Vận hành hệ thống thông báo

## Kiến trúc đang dùng

Mỗi sự kiện nghiệp vụ tạo một bản ghi `Notification` để làm hộp thư trong ứng
dụng. Với từng phiên bệnh nhân đang hoạt động và đã đăng ký FCM, backend tạo
`NotificationDelivery`. Việc gửi push là lớp bổ sung: lỗi Firebase không làm
rollback trạng thái lịch khám, hồ sơ, đơn thuốc hoặc hóa đơn.

Các trạng thái delivery gồm `PENDING`, `SENT`, `FAILED`, `EXHAUSTED`,
`CANCELLED` và `INVALID_TOKEN`. Worker dùng lease để hạn chế hai tiến trình gửi
trùng, retry theo exponential backoff và tự vô hiệu hóa token bị FCM từ chối.

## Tiến trình bắt buộc ở production

Triển khai thành bốn process độc lập từ cùng một backend build:

```text
API                  npm start
OTP worker           npm run worker:otp
Appointment worker   npm run worker:appointments
Notification worker  npm run worker:notifications
```

Không chạy notification worker thì hộp thư trong app vẫn hoạt động, nhưng lời
nhắc theo lịch và các delivery FCM cần retry sẽ không được gửi. Không chạy
appointment worker thì expiry giữ slot và reconciliation không được xử lý đúng
chu kỳ.

Mỗi process phải dùng cùng `DATABASE_URL`, `JWT_SECRET`, `OTP_SECRET` và
`LOOKUP_GRANT_SECRET`. Chỉ các worker BullMQ cần `QUEUE_REDIS_URL`; notification
worker đọc delivery từ PostgreSQL và cần Firebase Admin. Không đưa
`TEST_DATABASE_URL` vào bất kỳ process production nào.

## Cấu hình local

Dùng file service account nằm ngoài Git:

```dotenv
GOOGLE_APPLICATION_CREDENTIALS=D:\\duong-dan-an-toan\\firebase-admin-local.json
FIREBASE_SERVICE_ACCOUNT_BASE64=
NOTIFICATION_WORKER_INTERVAL_MS=30000
NOTIFICATION_DISPATCH_BATCH_SIZE=100
NOTIFICATION_MAX_DELIVERY_ATTEMPTS=3
```

Sau khi API và các worker cần thiết đã chạy, khởi động worker thông báo:

```powershell
cd backend
npm run worker:notifications:dev
```

## Cấu hình production

Đưa JSON service account đã encode base64 vào secret của nền tảng triển khai:

```dotenv
GOOGLE_APPLICATION_CREDENTIALS=
FIREBASE_SERVICE_ACCOUNT_BASE64=<secret-base64>
FIREBASE_PROJECT_ID=<firebase-project-id>
NOTIFICATION_WORKER_INTERVAL_MS=30000
NOTIFICATION_DISPATCH_BATCH_SIZE=100
NOTIFICATION_MAX_DELIVERY_ATTEMPTS=8
```

Chỉ cấu hình một trong `GOOGLE_APPLICATION_CREDENTIALS` hoặc
`FIREBASE_SERVICE_ACCOUNT_BASE64`. Không commit JSON service account hoặc giá
trị base64 vào repository.

API và worker sẽ từ chối khởi động trong môi trường production nếu secret yếu,
OTP debug/mock payment đang bật, `DATABASE_URL` trùng `TEST_DATABASE_URL`, CORS
frontend không dùng HTTPS hoặc đồng thời cấu hình cả hai cách cấp Firebase
credential. Notification worker production cũng bắt buộc có
`FIREBASE_PROJECT_ID`.

## Redis dành cho queue

BullMQ phải dùng Redis TCP riêng với `maxmemory-policy=noeviction`. Có thể đọc
policy hiện tại bằng công cụ quản trị của nhà cung cấp hoặc Redis CLI:

```text
CONFIG GET maxmemory-policy
```

Nếu nhà cung cấp khóa lệnh `CONFIG`, đặt policy trong dashboard của Redis. Không
tự đổi policy của một instance đang dùng chung với cache nếu chưa đánh giá tác
động; nên tách queue Redis khỏi cache ứng dụng.

Có thể chạy phép kiểm tra chỉ đọc từ backend:

```powershell
npm run check:queue-redis
```

Lệnh trả mã lỗi nếu Redis chưa dùng `noeviction`, nên có thể dùng làm release
preflight mà không tự thay đổi cấu hình hạ tầng.

## Tín hiệu kiểm tra

Worker ghi một dòng tổng hợp khi có công việc:

```text
[NOTIFICATION_WORKER] published=... scanned=... sent=... retryable=... exhausted=... invalid=... cancelled=... errors=...
```

- `sent`: FCM đã nhận message.
- `retryable`: lỗi tạm thời, worker sẽ thử lại.
- `exhausted`: đã hết số lần retry, cần xem `lastError` trong database.
- `invalid`: FCM token không còn hợp lệ và đã bị gỡ khỏi phiên.
- `cancelled`: phiên đăng nhập hết hạn, bị thu hồi hoặc đã tắt push.
- `errors`: lỗi bất thường ở một notification; các notification khác trong lô
  vẫn tiếp tục được xử lý.

Nếu Firebase Admin chưa cấu hình, worker chỉ cảnh báo một lần trong khi chạy;
delivery vẫn ở trạng thái chờ và hộp thư trong app vẫn khả dụng.

## Checklist kiểm thử Android thật

1. Chạy API bằng `DATABASE_URL` và chạy notification worker; không dùng
   `TEST_DATABASE_URL` cho kiểm thử thao tác thật.
2. Chạy app qua `mobile/tool/run_android_device.ps1` để thiết lập lại `adb
   reverse` và đăng nhập bệnh nhân.
3. Trong màn Thông báo, bật quyền và xác nhận app báo thiết bị đã đồng bộ.
4. Trên dashboard, lần lượt chuyển một lịch từ xác nhận sang check-in, đang
   khám và hoàn thành.
5. Với app foreground, kiểm tra banner/snackbar và dữ liệu lịch tự làm mới.
6. Đưa app background, cập nhật trạng thái khác và nhấn push; app phải mở đúng
   chi tiết lịch, nhưng hiển thị trạng thái mới nhất từ API.
7. Tắt quyền notification trong Android Settings: hộp thư trong app vẫn phải có
   dữ liệu. Bật lại quyền, quay lại app và dùng thao tác kết nối lại nếu cần.
8. Đăng xuất: token của phiên phải bị gỡ và thiết bị không tiếp tục nhận push
   của tài khoản cũ.
