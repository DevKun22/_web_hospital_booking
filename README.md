# Hospital Booking

Hệ thống đặt lịch khám trực tuyến gồm **website cho bệnh nhân, ứng dụng mobile Flutter, dashboard vận hành cho nhân sự bệnh viện** và một backend dùng chung. Bệnh nhân đặt lịch, theo dõi lịch khám, xem kết quả, đơn thuốc, hóa đơn và thanh toán trực tuyến; nhân sự bệnh viện tiếp đón, khám, kê đơn, cấp thuốc và quản lý theo đúng vai trò của mình.

Đồ án tốt nghiệp: *Xây dựng website hệ thống đặt lịch khám trực tuyến tích hợp chatbot và app mobile Flutter*.

| Thành phần | Địa chỉ |
| --- | --- |
| Website | https://hospital.ngoloi.dev |
| Dashboard nhân sự | https://hospital.ngoloi.dev/dashboard (đăng nhập bằng tài khoản được cấp) |
| API | https://hospital-api.ngoloi.dev (kiểm tra sống: `/health`) |

> API chạy trên gói miễn phí của Render nên có thể mất khoảng 50 giây ở lần gọi đầu sau thời gian không có truy cập.

## Chức năng theo vai trò

| Vai trò | Làm được gì |
| --- | --- |
| Bệnh nhân (web và mobile) | Xem chuyên khoa, bác sĩ, gói khám; đặt lịch có xác thực OTP qua email; xem và hủy lịch; đánh giá sau khám; xem kết quả khám, đơn thuốc, hóa đơn; thanh toán VNPay; quản lý hồ sơ người thân và đặt lịch cho người thân; nhận thông báo đẩy; hỏi chatbot |
| Nhân viên | Tiếp đón (xác nhận, check-in, đổi lịch, ghi vắng mặt), lập và thu hóa đơn, quản lý danh mục, lịch làm việc và nội dung |
| Bác sĩ | Xem lịch của mình, bắt đầu và kết thúc buổi khám, ghi bệnh án và kết quả xét nghiệm, kê đơn, gửi yêu cầu đổi lịch làm việc |
| Dược sĩ | Cấp thuốc theo đơn đã phát hành, nhập kho, điều chỉnh tồn, quản lý danh mục thuốc |
| Quản trị | Quản lý tài khoản nhân sự và ma trận phân quyền, hoàn tiền, cấu hình hệ thống, xem nhật ký truy cập |

Luồng chính: **đặt lịch** (chọn dịch vụ, ngày, khung giờ, OTP) → **tiếp đón** (xác nhận, check-in) → **khám** (bệnh án, đơn thuốc) → **cấp thuốc** → **hóa đơn và thanh toán** → **đánh giá**. Mỗi bước phát sinh thông báo trong ứng dụng và push tới thiết bị.

## Kiến trúc

```text
Web công khai / Dashboard (Next.js) ─┐
                                     ├── REST API (Express + TypeScript) ── PostgreSQL (Prisma)
Ứng dụng bệnh nhân (Flutter) ────────┘                │
                                                      ├── Redis + BullMQ (OTP, nhắc lịch, thông báo)
                                                      ├── Firebase Cloud Messaging (push)
                                                      ├── Resend (email OTP)
                                                      ├── Cloudinary (ảnh, tệp kết quả)
                                                      ├── Gemini (chatbot)
                                                      └── VNPay (thanh toán, IPN)
```

- Web và mobile không truy cập cơ sở dữ liệu trực tiếp, chỉ gọi REST API. Web công khai và dashboard dùng các route `/api`; cổng bệnh nhân (web và mobile) dùng `/api/v1`; tất cả cùng một lớp nghiệp vụ.
- Backend quyết định quyền truy cập, trạng thái lịch khám và tính hợp lệ của dữ liệu; PostgreSQL là nguồn dữ liệu duy nhất.
- Hộp thư thông báo lưu trong PostgreSQL là dữ liệu chính, push chỉ là kênh chuyển phát.
- Các việc nền (gửi OTP, nhắc lịch, hết hạn giữ chỗ, đối soát thanh toán) chạy qua hàng đợi hoặc worker, có thể chạy ngay trong tiến trình API (`INLINE_WORKERS`).

## Công nghệ

| Phần | Công nghệ |
| --- | --- |
| Web | Next.js 16, React 19, TypeScript, Tailwind CSS, TanStack Query, Zustand |
| Mobile | Flutter 3.38, Riverpod, GoRouter, Dio, Firebase Messaging, flutter_secure_storage |
| Backend | Node.js 20 trở lên, Express 5, TypeScript, Prisma, PostgreSQL |
| Hàng đợi | Redis, BullMQ |
| Dịch vụ ngoài | Resend, Cloudinary, Firebase Cloud Messaging, Gemini, VNPay |
| Triển khai | Vercel (web), Render (API), Upstash (Redis) |
| Chất lượng | GitHub Actions, kiểm thử tích hợp trên PostgreSQL riêng, `flutter analyze` |

## Cấu trúc thư mục

```text
backend/    API Express, schema và migration Prisma, worker, kiểm thử
frontend/   Website công khai, cổng bệnh nhân và dashboard (Next.js)
mobile/     Ứng dụng Flutter cho bệnh nhân
.github/    Quy trình kiểm tra chất lượng (CI)
```

## Chạy ở máy cục bộ

Yêu cầu: Node.js 20 trở lên, PostgreSQL 16, Redis 7 (cài trực tiếp hoặc dùng dịch vụ đám mây), Flutter 3.38 cho ứng dụng mobile.

### Chạy backend và frontend

```bash
# Backend (cổng 4000)
cd backend
cp .env.example .env        # điền DATABASE_URL, JWT_SECRET, OTP_SECRET, REDIS_URL...
npm install
npx prisma migrate deploy
npm run seed:demo-full      # dữ liệu mẫu (xem lưu ý bên dưới)
npm run dev

# Frontend (cổng 3000)
cd frontend
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:4000/api
npm install
npm run dev
```

Khi chạy local, đặt `OTP_DEBUG_ENABLED=true` để API trả mã OTP trong phản hồi (production bắt buộc `false`).

### Ứng dụng mobile

```powershell
cd mobile
Copy-Item config/dev.json.example config/dev.json   # chỉnh API_BASE_URL nếu cần
flutter pub get
.\tool\run_android_device.ps1                        # điện thoại Android kết nối USB
```

Hướng dẫn chi tiết (thiết bị thật, emulator, đóng gói): [mobile/README.md](mobile/README.md). Ứng dụng đã được kiểm thử trên Android; chưa có bằng chứng kiểm thử trên iOS.

### Dữ liệu mẫu

`npm run seed:demo-full` tạo chuyên khoa, bác sĩ, gói khám, khung giờ, tài khoản mẫu cho các vai trò và thuốc mẫu. Script **có thể xóa dữ liệu hiện có**, chỉ chạy trên cơ sở dữ liệu cục bộ.

## Cấu hình

Biến môi trường backend được giải thích đầy đủ trong [backend/.env.example](backend/.env.example); frontend trong [frontend/.env.example](frontend/.env.example). Những điểm quan trọng khi chạy thật:

- `NODE_ENV=production` bật kiểm tra cấu hình lúc khởi động: mỗi bí mật (`JWT_SECRET`, `OTP_SECRET`) tối thiểu 32 ký tự, `FRONTEND_URLS` phải là HTTPS, `OTP_DEBUG_ENABLED` phải `false`.
- Web và API cùng site `ngoloi.dev` nên cookie dashboard dùng `SameSite=Lax`.
- Khóa bí mật (VNPay, Firebase, Resend, Cloudinary) chỉ nằm ở backend hoặc dịch vụ triển khai, không đưa vào Flutter, biến công khai của Next.js hay Git.
- Không nhập nguyên tệp `.env` local lên môi trường triển khai (giá trị `localhost` làm hỏng cookie, CORS và địa chỉ quay về thanh toán).

## Kiểm thử và CI

```bash
cd backend
npm run test:all            # kiểu, smoke, unit, tích hợp
npm run test:unit           # chỉ unit, không cần cơ sở dữ liệu
npm run test:integration    # cần TEST_DATABASE_URL (xem bên dưới)

cd frontend && npx tsc --noEmit && npm run lint && npm run build
cd mobile   && flutter analyze && flutter test
```

- Kiểm thử tích hợp chạy trên cơ sở dữ liệu **riêng** (`TEST_DATABASE_URL`, tên hoặc schema phải chứa `test` và khác `DATABASE_URL`); bộ chạy từ chối khởi động nếu không đúng để không xóa nhầm dữ liệu thật.
- Tại 08/11/2026: 80 kiểm thử tích hợp và 39 kiểm thử đơn vị ở backend, 21 smoke test, 188 kiểm thử Flutter.
- CI (`.github/workflows/phase0.yml`) chạy trên mỗi pull request: chặn tệp bí mật bị đưa vào Git, kiểm tra schema Prisma, toàn bộ kiểm thử backend, build backend, kiểm tra kiểu, lint và build frontend, phân tích và kiểm thử Flutter, build APK, cảnh báo tệp Dart trên 800 dòng.

## Triển khai

| Thành phần | Nền tảng | Ghi chú |
| --- | --- | --- |
| Web | Vercel, thư mục gốc `frontend` | Đặt `NEXT_PUBLIC_API_URL` và `NEXT_PUBLIC_SITE_URL` |
| API | Render Web Service, thư mục gốc `backend` | Build `npm install && npm run render:build` (chạy migration rồi build), start `npm run start` |
| Redis | Upstash | Dùng cho hàng đợi và bộ đếm giới hạn tần suất; nên đặt chính sách `noeviction` |
| Cơ sở dữ liệu | PostgreSQL | Migration áp dụng khi build API |

Gói miễn phí của Render chỉ có một Web Service, nên các worker chạy ngay trong tiến trình API bằng biến `INLINE_WORKERS=otp,appointments,notifications,payments`. Có thể tách ra tiến trình riêng bằng các lệnh `npm run worker:*`.

## Thanh toán VNPay

VNPay là cổng thanh toán trực tuyến duy nhất. Return URL và IPN dùng chung một xử lý không ghi nhận hai lần; có đối soát giao dịch bị lỡ bằng API `querydr` (worker và khi người dùng mở lại giao dịch) và hoàn tiền toàn phần qua API cho quản trị. Hiện chạy ở môi trường sandbox; đối soát và hoàn tiền mới được kiểm thử bằng phản hồi giả ký đúng đặc tả, chưa thử với sandbox thật.

Cấu hình (chỉ ở backend, biến mẫu trong `backend/.env.example`): `PAYMENT_VNPAY_ENABLED`, `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL`, `VNPAY_RETURN_URL` (HTTPS, trỏ về `/api/payments/vnpay/return`), `PAYMENT_RESULT_URL`. Địa chỉ IPN `/api/payments/vnpay/ipn` được đăng ký trong cổng quản trị merchant của VNPay. Thiếu khóa thì VNPay tự ẩn khỏi ứng dụng.

## Phân quyền và bảo vệ dữ liệu y tế

- **Ma trận quyền động:** 41 mã quyền, 4 vai trò nhân sự. Mỗi quyền khai báo vai trò đủ điều kiện, vai trò cố định và mặc định; quản trị chỉ bật tắt trong tập đủ điều kiện. Quản trị không mặc định có mọi quyền và không đọc nội dung bệnh án, đơn thuốc.
- **Phạm vi dữ liệu:** bác sĩ chỉ thấy lịch, bệnh án, đơn thuốc của mình; dược sĩ chỉ thấy dữ liệu tối thiểu để cấp thuốc; bệnh nhân chỉ thấy dữ liệu của mình và người thân do mình quản lý.
- **Tách người làm và người xác nhận:** bác sĩ kết thúc buổi khám, nhân viên thu tiền, quản trị hoàn tiền, dược sĩ cấp thuốc.
- **Nhật ký truy cập** chỉ thêm dòng (cơ sở dữ liệu chặn sửa, xóa); quản trị đặt lại mật khẩu thì người dùng phải tự đổi; cần ghi nhận đồng ý khi lưu thông tin sức khỏe.
- **Bảo vệ khác:** giới hạn tần suất endpoint công khai, OTP chỉ lưu dạng băm, token phiên xoay vòng và phát hiện dùng lại, access token mobile chỉ giữ trong bộ nhớ.

## Hạn chế và hướng phát triển

**Hạn chế hiện tại**

- Chưa tích hợp SMS thật; OTP gửi qua email. Số điện thoại vì vậy chưa được xác minh độc lập.
- Thanh toán mới ở sandbox VNPay; đối soát và hoàn tiền chưa thử với sandbox thật.
- Push trên iOS chưa được cấu hình và kiểm thử; mobile mới kiểm thử trên Android.
- Chatbot chỉ cung cấp thông tin và điều hướng, không chẩn đoán.
- Chính sách BHYT dừng ở mức nhập thông tin và tính giảm trừ, chưa thay quy trình giám định.
- Bác sĩ chỉ xem bệnh án do chính mình lập, chưa hỗ trợ xem lịch sử khám từ bác sĩ khác khi có lịch hiện hành.
- Máy chủ gói miễn phí có độ trễ khi khởi động lại.

**Hướng phát triển:** tích hợp SMS, chuyển VNPay sang production, quyền xem khẩn cấp có lý do bắt buộc cho quản trị, cho bác sĩ xem lịch sử khám khi có lịch hẹn hiện hành, báo cáo độ phủ kiểm thử, thông báo thời gian thực cho dashboard, khám từ xa qua video.

## Tác giả

- Sinh viên: Ngô Quang Lợi (24810036)
- Giảng viên hướng dẫn: TS. Phan Thị Thể
- Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCMUTE)
