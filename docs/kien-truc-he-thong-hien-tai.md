# KIẾN TRÚC KỸ THUẬT HỆ THỐNG ĐẶT LỊCH KHÁM

**Phiên bản tài liệu:** 08/11/2026  
**Phạm vi:** Web frontend, dashboard, backend, mobile, cơ sở dữ liệu, API, dịch vụ tích hợp và mô hình triển khai hiện có.

## 1. Tổng quan

Hệ thống được tổ chức theo mô hình client–server. Web và ứng dụng mobile không truy cập cơ sở dữ liệu trực tiếp mà giao tiếp với backend qua REST API. Backend là nguồn nghiệp vụ trung tâm và PostgreSQL là nguồn dữ liệu chính.

```text
Web công khai / Dashboard (Next.js) ─┐
                                     ├── REST API (Express + TypeScript) ── PostgreSQL
Ứng dụng bệnh nhân (Flutter) ────────┘                │
                                                      ├── Redis/BullMQ
                                                      ├── Firebase Cloud Messaging
                                                      ├── Cloudinary
                                                      ├── Resend/Email
                                                      ├── Gemini AI
                                                      └── VNPay (thanh toán online, IPN)
```

Nguyên tắc chính:

- Backend quyết định quyền truy cập, trạng thái lịch khám và tính hợp lệ của dữ liệu. Quyền của nhân sự được cấu hình theo ma trận quyền (mục 3), không gắn cứng vào vai trò.
- Web và mobile dùng chung dữ liệu, nhưng có API và cơ chế xác thực phù hợp với từng client.
- Các nghiệp vụ quan trọng có log, kiểm tra quyền sở hữu và trạng thái chuyển tiếp.
- Hộp thư thông báo trong PostgreSQL là dữ liệu chính; push notification chỉ là kênh chuyển phát.

## 2. Frontend web

### Công nghệ

- Next.js 16, React 19, TypeScript.
- TanStack Query quản lý server state và cache.
- Zustand quản lý một số trạng thái phía client.
- Tailwind CSS cho giao diện; Recharts cho thống kê.

### Phạm vi

- Website công khai: trang chủ, bác sĩ, chuyên khoa, gói khám, tìm kiếm, FAQ, hướng dẫn đặt lịch và cổng người khám (lịch hẹn, hồ sơ, đơn thuốc, hóa đơn, thông báo).
- Dashboard cho bốn vai trò nhân sự `ADMIN`, `STAFF`, `DOCTOR`, `PHARMACIST`. Mục điều hướng hiện theo quyền mà tài khoản được cấp: lịch khám, lịch làm việc, bác sĩ, khoa, gói khám, bệnh án, đơn thuốc, hóa đơn, nhân sự, chatbot, nội dung website, thông báo bệnh viện, **phân quyền và chính sách** (`/dashboard/permissions`), **cấp thuốc** (`/dashboard/pharmacy`) và **kho thuốc** (`/dashboard/medicines`).

### Luồng dữ liệu và xác thực

- Mặc định gọi backend qua `NEXT_PUBLIC_API_URL`, base URL local là `http://localhost:4000/api`.
- TanStack Query tách query theo từng miền nghiệp vụ và dùng query key tập trung.
- Dashboard đăng nhập bằng mật khẩu và OTP gửi qua email.
- Phiên dashboard dùng cookie `HttpOnly` và `Secure`; khi gặp `401`, frontend chỉ chạy một lần refresh session rồi thử lại request. Mọi nhân sự dùng chung một bộ cookie trong cùng một hồ sơ trình duyệt, nên đăng nhập vai trò khác sẽ thay phiên đang có.
- Web phải gọi API cùng domain gốc với web (ví dụ `hospital.ngoloi.dev` và `hospital-api.ngoloi.dev`) để cookie là cùng site; cấu hình bằng `NEXT_PUBLIC_API_URL`. Các lời gọi phía máy chủ để dựng trang tĩnh có thời hạn 12 giây để build không treo khi API đang ngủ.
- Giao diện ẩn hiện chức năng theo danh sách quyền trả về từ `/api/auth/dashboard/me` (hàm `can`). Phân quyền cuối cùng luôn được kiểm tra tại backend.
- Trang web gửi thêm các header bảo mật (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`). Chưa đặt `Content-Security-Policy`.

## 3. Backend

### Công nghệ và cấu trúc

- Node.js 20+, Express 5, TypeScript.
- Prisma 7 và PostgreSQL.
- Zod kiểm tra request; JWT và refresh token quản lý phiên.
- Cấu trúc chính: `routes → controllers → services/repositories → Prisma`.
- Middleware dùng chung: request context/request ID, CORS, Helmet, logging, xác thực, phân quyền, validation và xử lý lỗi tập trung.

### Miền nghiệp vụ

- Xác thực dashboard và bệnh nhân bằng OTP qua email (Resend). Kênh SMS chỉ bật khi cấu hình nhà cung cấp.
- **Phân quyền động:** 41 mã quyền (`backend/src/config/permissions.ts`), mỗi mã khai báo vai trò đủ điều kiện, vai trò cố định và mặc định. Ma trận vai trò–quyền lưu ở `SiteSetting` khóa `rbac.matrix`; API `/api/dashboard/rbac`; middleware `requirePermission(...mã quyền)` cho phép nếu vai trò có bất kỳ mã nào. Phạm vi dữ liệu theo người dùng (ví dụ bác sĩ chỉ thấy dữ liệu của mình) vẫn được kiểm tra trong service. Quản trị viên không mặc định có mọi quyền (không được khám, ghi bệnh án, kê đơn hay cấp thuốc, và mặc định không đọc nội dung bệnh án, đơn thuốc). Thao tác nhạy cảm ghi vào `AuditLog` (chỉ thêm dòng) xem ở `/dashboard/audit-logs`; tài khoản do quản trị tạo hoặc đặt lại mật khẩu phải tự đổi mật khẩu (`mustChangePassword`). Chi tiết: `docs/phan-quyen-va-kiem-soat-du-lieu-nhay-cam.md`.
- **Chính sách đặt lịch** lưu ở `SiteSetting` khóa `policy` (hạn hủy lịch, tự đánh dấu vắng mặt, giới hạn), API `/api/dashboard/policy`.
- Quản lý lịch khám và vòng đời trạng thái; tự đánh dấu vắng mặt theo chính sách; yêu cầu **đồng ý xử lý dữ liệu sức khỏe** (`healthConsentAt`, `healthConsentVersion`) khi đặt lịch có dữ liệu sức khỏe và khi người dùng thêm hoặc đổi dị ứng, tiền sử trong hồ sơ cá nhân (web và mobile đều có ô đồng ý).
- Lịch bác sĩ, khung giờ và yêu cầu thay đổi lịch.
- Hồ sơ bệnh nhân và hồ sơ người thân.
- Bệnh án, kết quả xét nghiệm, đơn thuốc và hóa đơn. Mọi thao tác lâm sàng (ghi, sửa, công bố, kê đơn, phát hành, hủy) được ghi vào `AppointmentLog` qua `logClinicalAction`.
- **Kho thuốc và cấp thuốc (vai trò `PHARMACIST`):** `Medicine` giữ tồn kho; `StockMovement` là sổ kho chỉ thêm (có trigger chặn sửa/xóa và ràng buộc dấu số lượng). Cấp thuốc theo nguyên đơn, tất cả hoặc không: trừ kho có điều kiện nguyên tử và chỉ khi toàn bộ dòng đủ hàng, dòng "mua ngoài" không trừ kho. Đơn đã cấp không hủy được. API `/api/dashboard/pharmacy`.
- Thanh toán qua lớp provider; VNPay là cổng online duy nhất (tạo URL ký HMAC-SHA512, Return URL và IPN dùng chung một hàm xử lý idempotent, kiểm tra chữ ký, mã merchant và số tiền, cập nhật hóa đơn nguyên tử). Chi tiết ở `docs/van-hanh-thanh-toan-vnpay.md`.
- Danh mục công khai: bác sĩ, khoa, gói khám, banner, FAQ và cài đặt website.
- Chatbot có rule/workflow, truy xuất dữ liệu nội bộ và adapter AI.
- Thông báo sự kiện bệnh nhân và chiến dịch thông báo từ dashboard.

### Tiến trình nền

- OTP worker: chuyển phát OTP bất đồng bộ qua hàng đợi Redis. Không có worker này thì OTP được tạo nhưng không ai gửi email.
- Appointment lifecycle worker: hết hạn lịch chờ OTP, tự đánh dấu vắng mặt, đối soát khung giờ và dọn OTP đã hết hạn.
- Notification worker: lấy delivery đang chờ, gửi FCM, retry và cập nhật trạng thái.
- Redis/BullMQ phục vụ queue OTP và vòng đời lịch; Upstash cần chính sách `noeviction`. Notification worker polling trực tiếp các delivery đang chờ trong PostgreSQL.
- Có hai cách chạy worker: tiến trình riêng (`npm run worker:otp`, `worker:appointments`, `worker:notifications`) hoặc **chạy ngay trong tiến trình API** bằng biến `INLINE_WORKERS` (`otp`, `appointments`, `notifications`, phân tách bằng dấu phẩy). Cách thứ hai dành cho môi trường chỉ có một dịch vụ (Render gói free); khi API ngủ thì worker cũng ngừng.

## 4. Ứng dụng mobile

### Công nghệ và kiến trúc

- Flutter/Dart, Material 3.
- Riverpod quản lý trạng thái và dependency.
- GoRouter quản lý điều hướng, route guard và lịch sử từng nhánh bottom navigation.
- Dio gọi API; repository tách truy cập dữ liệu khỏi controller và presentation.
- Mỗi tính năng được tổ chức theo `domain / data / application / presentation` khi cần.

### Chức năng hiện có

- Onboarding, đăng nhập OTP, khôi phục phiên và khóa ứng dụng bằng sinh trắc học.
- Trang chủ đồng bộ banner, bác sĩ, chuyên khoa, gói khám và lịch gần nhất.
- Đặt lịch theo bác sĩ hoặc gói khám; hỗ trợ bản thân và hồ sơ người thân.
- Lịch khám, chi tiết lịch, tiến trình, checklist chuẩn bị và vé QR.
- Hồ sơ bệnh nhân, bệnh án, tài liệu y tế, đơn thuốc và hóa đơn.
- Thanh toán VNPay theo capability của backend; mở cổng ngoài ứng dụng và tự đối soát lại khi quay về.
- Thông báo trong ứng dụng gồm cả sự kiện "Thuốc đã được cấp" (`PRESCRIPTION_DISPENSED`).
- Hộp thư thông báo, tùy chọn push và điều hướng an toàn tới màn hình liên quan.
- Chatbot công khai hỗ trợ tìm dịch vụ và chuyển ngữ cảnh sang luồng đặt lịch.

### Phiên và bảo mật trên thiết bị

- Mobile sử dụng API `/api/v1`.
- Access token chỉ giữ trong bộ nhớ; refresh token và device ID lưu trong secure storage.
- Khi nhận `401`, chỉ một tiến trình refresh được chạy và request được thử lại tối đa một lần.
- Dữ liệu bảo vệ được xóa khỏi state khi đăng xuất; app lock che nội dung y tế khi cần xác thực lại.
- Deep link từ thông báo chỉ chấp nhận loại thực thể/route nằm trong allowlist, không mở URL tùy ý.

## 5. Cơ sở dữ liệu

PostgreSQL được quản lý schema bằng Prisma migration (40 mô hình, 46 migration). Các nhóm dữ liệu chính:

| Nhóm | Các thực thể chính |
|---|---|
| Người dùng và phiên | `User` (vai trò `ADMIN`, `STAFF`, `DOCTOR`, `PATIENT`, `PHARMACIST`), `PatientProfile`, `DependentProfile`, `DashboardSession`, `AuthRefreshToken` |
| OTP và bảo mật | `OtpCode`, `OtpVerifyAttempt`, `OtpSecurityBlock`, `DashboardLoginChallenge`, `DashboardLoginFailure` |
| Lịch khám | `Appointment`, `AppointmentLog` (cũng là nhật ký lâm sàng), `DoctorSchedule`, `DoctorTimeSlot`, `ScheduleChangeRequest`, `ScheduleChangeLog` |
| Khám chữa bệnh | `MedicalRecord`, `LabResult`, `Prescription`, `PrescriptionItem` |
| Kho thuốc | `Medicine`, `StockMovement` (sổ kho chỉ thêm, kiểu `RECEIPT`, `DISPENSE`, `ADJUSTMENT`) |
| Tài chính | `Invoice`, `InvoiceItem`, `PaymentTransaction` (nhà cung cấp duy nhất: `VNPAY`) |
| Nội dung công khai | `Department`, `DoctorProfile`, `Package`, `PackageItem`, `Banner`, `FAQ`, `Review`, `MediaAsset` |
| Cấu hình | `SiteSetting` (cài đặt website, `rbac.matrix`, `policy`, `chatbot_runtime`) |
| Thông báo | `Notification`, `NotificationDelivery`, `NotificationPreference` |
| Chatbot | `ChatbotSession`, `ChatbotLog`, `ChatbotSetting` |

Các bảng tìm kiếm, tư vấn và FAQ chatbot cũ đã được loại bỏ (migration `20261106100000`).

`DATABASE_URL` dùng cho local/dev/production thực tế. `TEST_DATABASE_URL` chỉ dùng khi chạy integration test phá dữ liệu; database hoặc schema test bắt buộc có chữ `test`. Migration là nguồn schema chung và phải được áp dụng riêng cho từng database.

## 6. Thiết kế API

Backend được mount tại `/api` và chia thành ba nhóm:

| Nhóm API | Base path | Người sử dụng |
|---|---|---|
| Public/legacy | `/api/*` | Website công khai và các luồng cũ |
| Dashboard | `/api/dashboard/*`, `/api/auth/dashboard/*` | Admin, nhân viên, bác sĩ, dược sĩ (theo quyền) |
| Thanh toán | `/api/payments/vnpay/return`, `/api/payments/vnpay/ipn` | Cổng VNPay gọi về |
| Patient API v1 | `/api/v1/*` | Mobile và các client bệnh nhân mới |

Các nhóm endpoint dashboard mới: `/api/dashboard/rbac` (ma trận quyền, cần `rbac.manage`), `/api/dashboard/policy` (xem cần `settings.view`, sửa cần `settings.edit`), `/api/dashboard/pharmacy` (hàng đợi và cấp thuốc, danh mục thuốc, nhập kho, điều chỉnh tồn, sổ kho). Mọi route dashboard dùng `requirePermission`; yêu cầu thay đổi dữ liệu phải kèm header `X-Hospital-Dashboard-Request: 1`.

Các nhóm endpoint v1 quan trọng:

- `/api/v1/auth`: gửi/xác minh OTP, refresh, logout, push token và quản lý phiên thiết bị.
- `/api/v1/me`: hồ sơ, người thân, lịch khám, bệnh án, đơn thuốc và hóa đơn.
- `/api/v1/me/payment-capabilities`, `/invoices/:id/payments`, `/payments/:id`: capability, tạo và đọc trạng thái giao dịch của đúng bệnh nhân.
- `/api/v1/me/notifications`: hộp thư, số chưa đọc, đánh dấu đã đọc và tùy chọn thông báo.
- `/api/v1/departments`, `/doctors`, `/packages`, `/banners`, `/faqs`: dữ liệu công khai.
- `/api/v1/appointments`: tạo/xác thực/hủy lịch và các thao tác đặt lịch dùng chung.
- `/api/v1/chatbot`: cấu hình và hội thoại chatbot.
- `/api/v1/capabilities`: công bố khả năng backend để client thích ứng theo phiên bản.

Response dùng envelope thống nhất gồm trạng thái, thông báo và dữ liệu. Lỗi có HTTP status phù hợp và `requestId` để đối chiếu log.

## 7. Dịch vụ tích hợp

| Dịch vụ | Vai trò | Ghi chú vận hành |
|---|---|---|
| PostgreSQL/Prisma | Dữ liệu nghiệp vụ và migration | Thành phần bắt buộc |
| Firebase Admin + FCM | Push notification tới thiết bị | Local dùng credential file; production dùng service account base64 |
| Redis + BullMQ | Queue OTP và tác vụ nền | Cấu hình bằng URL `redis://` hoặc `rediss://` |
| Cloudinary | Lưu ảnh và media | Backend quản lý metadata trong `MediaAsset` |
| Resend | Gửi OTP/email | Cần domain gửi đã xác minh (ví dụ `mail.<domain>`); địa chỉ `onboarding@resend.dev` chỉ gửi tới email chủ tài khoản |
| Gemini | Hiểu ý định và tạo phản hồi chatbot có kiểm soát | Backend kết hợp rule, dữ liệu nội bộ và guardrail |
| VNPay | Thanh toán online và IPN đối soát | Cổng online duy nhất; khóa chỉ ở backend, redirect không quyết định kết quả; xem `docs/van-hanh-thanh-toan-vnpay.md` |

Android đã tích hợp Firebase. iOS còn cần `GoogleService-Info.plist`, APNs và signing trên macOS trước khi nghiệm thu push production.

## 8. Luồng nghiệp vụ tiêu biểu

### Đặt lịch

1. Client tải khoa, bác sĩ/gói, ngày và slot từ API.
2. Người dùng chọn người khám và nhập thông tin cần thiết.
3. Backend kiểm tra lại quyền sở hữu hồ sơ người thân và tính khả dụng của slot.
4. OTP xác thực yêu cầu đặt lịch.
5. Lịch chuyển qua các trạng thái `PENDING_CONFIRM → CONFIRMED → CHECKED_IN → IN_PROGRESS → COMPLETED` hoặc nhánh hủy/dời lịch/không đến.
6. Mỗi thay đổi quan trọng tạo log và sự kiện thông báo tương ứng.

### Thông báo

1. Nghiệp vụ tạo `Notification` có `dedupeKey` để tránh trùng.
2. Hộp thư mobile đọc trực tiếp từ API và là nguồn trạng thái chính.
3. `NotificationDelivery` theo dõi việc gửi tới từng phiên/thiết bị.
4. Worker gửi FCM, retry có giới hạn và đánh dấu token không hợp lệ.
5. Khi người dùng mở thông báo, ứng dụng chỉ điều hướng tới route được cho phép rồi tải dữ liệu mới nhất từ backend.

## 9. Mô hình triển khai

| Thành phần | Nền tảng | Ghi chú |
|---|---|---|
| Web và dashboard | Vercel (`hospital.ngoloi.dev`) | Build từ nhánh `main`; `NEXT_PUBLIC_API_URL` trỏ `https://hospital-api.ngoloi.dev/api` |
| API và worker | Render Web Service gói free (`hospital-api.ngoloi.dev`) | Build `npm install && npm run render:build` (áp migration, sinh Prisma client, `tsc`); `NODE_ENV=production` kèm `NPM_CONFIG_PRODUCTION=false` vì `typescript` và `prisma` nằm ở `devDependencies`; worker chạy trong API qua `INLINE_WORKERS` |
| Cơ sở dữ liệu | PostgreSQL (Prisma) | Dùng chung một database cho dev và production, nên không chạy seed hoặc reset từ máy cá nhân |
| Queue | Redis Upstash | Cần chính sách `noeviction` |
| Email OTP | Resend, domain `mail.ngoloi.dev` | |
| Thanh toán | VNPay sandbox | IPN đăng ký trong cổng merchant |

Mã `isProductionLike()` (có `NODE_ENV=production` hoặc biến `RENDER`) quyết định cookie `Secure`, danh sách CORS, che thông báo lỗi 500 và ẩn thông tin debug; không đọc thẳng `NODE_ENV`. Gói free ngủ sau 15 phút không có yêu cầu; instance có thể kẹt và cần triển khai lại thủ công (Manual Deploy > Deploy latest commit).

## 10. Vận hành và kiểm thử

- Backend có smoke test, type test, unit test, integration test riêng (chạy trên schema test) và script benchmark API. Lệnh một đường: `npm run test:all`.
- Mobile có `flutter analyze`, widget/unit test và nghiệm thu trên thiết bị thật.
- Web có ESLint và Next.js production build.
- Health check backend: `/health`.
- Migrations production dùng `prisma migrate deploy`; không dùng `migrate reset` cho dữ liệu thật.
- Secret chỉ đặt trong biến môi trường hoặc secret manager, không đưa vào Git.

## 11. Giới hạn và hướng phát triển gần nhất

- Thanh toán chưa có đối soát chủ động (`querydr`, quét giao dịch `PENDING`) và chưa tích hợp hoàn tiền qua VNPay.
- Chưa đặt `Content-Security-Policy` cho web.
- Worker chạy trong API nên ngừng khi instance ngủ; cần gói trả phí hoặc dịch vụ giữ thức, hoặc tách worker ra dịch vụ riêng.
- Đo hiệu năng mobile bằng profile/release build thay vì debug build.
- Hoàn thiện cấu hình push và ký ứng dụng iOS.
- Theo dõi worker/queue, tỷ lệ push thất bại và slow request bằng hệ thống giám sát production.
- Chuẩn hóa OpenAPI/contract test để web, mobile và backend kiểm tra tương thích tự động.
- Tiếp tục chuyển client web sang API versioned khi cần, nhưng giữ alias cũ trong giai đoạn chuyển đổi để tránh phá luồng đang hoạt động.
