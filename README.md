# Hospital Booking

Hệ thống đặt lịch khám trực tuyến gồm **website cho bệnh nhân, ứng dụng mobile Flutter, dashboard vận hành cho nhân sự bệnh viện** và một backend dùng chung. Bệnh nhân đặt lịch, theo dõi lịch khám, xem kết quả, đơn thuốc, hóa đơn và thanh toán trực tuyến; nhân sự bệnh viện tiếp đón, khám, kê đơn, cấp thuốc và quản lý theo đúng vai trò của mình.

Đồ án tốt nghiệp: *Xây dựng website hệ thống đặt lịch khám trực tuyến tích hợp chatbot và app mobile Flutter*.

| Thành phần | Địa chỉ |
| --- | --- |
| Website | https://hospital.ngoloi.dev |
| Dashboard nhân sự | https://hospital.ngoloi.dev/dashboard (đăng nhập bằng tài khoản được cấp) |
| API | https://hospital-api.ngoloi.dev (liveness: `/health`, readiness: `/ready`) |

> API chạy trên gói miễn phí của Render nên có thể mất khoảng 50 giây ở lần gọi đầu sau thời gian không có truy cập.

## Chức năng theo vai trò

| Vai trò | Làm được gì |
| --- | --- |
| Bệnh nhân (web và mobile) | Xem chuyên khoa, bác sĩ, gói khám; đặt lịch có xác thực OTP qua email; xem và hủy lịch; đánh giá sau khám; xem kết quả khám, đơn thuốc, hóa đơn; thanh toán VNPay; quản lý hồ sơ người thân và đặt lịch cho người thân; nhận thông báo đẩy; hỏi chatbot |
| Nhân viên | Tiếp đón (xác nhận, check-in, đổi lịch, ghi vắng mặt), lập và thu hóa đơn, quản lý danh mục, lịch làm việc (sinh khung giờ, đóng lịch khi bác sĩ nghỉ, duyệt yêu cầu đổi lịch) và nội dung, gửi thông báo nội bộ |
| Bác sĩ | Xem lịch của mình, bắt đầu và kết thúc buổi khám, ghi bệnh án và kết quả xét nghiệm, kê đơn, gửi yêu cầu đổi lịch làm việc, đóng lịch khi nghỉ |
| Dược sĩ | Cấp thuốc theo đơn đã phát hành, nhập kho (theo lô và hạn dùng), điều chỉnh tồn, quản lý danh mục và giá bán thuốc, nhận cảnh báo thuốc sắp hết hoặc hết hạn |
| Quản trị | Quản lý tài khoản nhân sự và ma trận phân quyền, hoàn tiền, cấu hình hệ thống, xem nhật ký truy cập |

Luồng chính: **đặt lịch** (chọn dịch vụ, ngày, khung giờ, OTP) → **tiếp đón** (xác nhận, check-in) → **khám** (bệnh án, đơn thuốc) → **cấp thuốc** → **hóa đơn và thanh toán** → **đánh giá**. Mỗi bước phát sinh thông báo trong ứng dụng và push tới thiết bị. Hóa đơn gồm phí khám hoặc gói khám, phí dịch vụ và tiền thuốc đã cấp (theo giá bán trong danh mục thuốc). Nhân sự có hộp thư riêng ("Thông báo của tôi"): bác sĩ nhận lịch mới, hủy, đổi và check-in; nhân viên tiếp nhận nhận lịch chờ xác nhận, yêu cầu đổi lịch và lịch đã khám xong chờ lập hóa đơn; dược sĩ nhận đơn chờ cấp và cảnh báo kho.

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

- Web và mobile không truy cập cơ sở dữ liệu trực tiếp, chỉ gọi REST API. Mọi client dùng duy nhất namespace `/api/v1`; không duy trì route legacy song song.
- Backend quyết định quyền truy cập, trạng thái lịch khám và tính hợp lệ của dữ liệu; PostgreSQL là nguồn dữ liệu duy nhất.
- Cấu hình runtime của controller, service và worker được parse/default tập trung tại `backend/src/config/runtimeConfig.ts`; validation an toàn khi khởi động nằm trong các module `backend/src/config`.
- Hộp thư thông báo lưu trong PostgreSQL là dữ liệu chính, push chỉ là kênh chuyển phát.
- `/health` chỉ xác nhận tiến trình API còn sống; `/ready` báo riêng PostgreSQL và Redis. PostgreSQL lỗi luôn trả `503`; Redis lỗi mặc định trả trạng thái `degraded` để hệ thống tiếp tục bằng policy dự phòng, hoặc trả `503` khi bật `REDIS_REQUIRED_FOR_READINESS=true`.
- Các việc nền (gửi OTP, nhắc lịch, hết hạn giữ chỗ, đối soát thanh toán, nhắc thanh toán hóa đơn, tự sinh khung giờ) chạy qua hàng đợi hoặc worker, có thể chạy ngay trong tiến trình API (`INLINE_WORKERS`). Chu kỳ mặc định được kéo dài để tiết kiệm lượt truy vấn trên gói miễn phí và chỉnh được bằng biến môi trường. Khi hàng đợi Redis lỗi hoặc hết hạn mức, OTP được gửi trực tiếp thay vì qua hàng đợi.
- Production **bắt buộc** cấu hình Redis an toàn, nếu không API từ chối khởi động: tách `REDIS_URL` (rate limit, RBAC, readiness) và `QUEUE_REDIS_URL` (BullMQ) bằng hai ACL user khác nhau; dùng `rediss://` có credential qua mạng công khai hoặc khai báo `REDIS_PRIVATE_NETWORK=true` cho endpoint nội bộ; `REDIS_SECURITY_MODE` mặc định là `strict` (không được đặt `warn`). Production cũng yêu cầu `INLINE_WORKERS` đúng bốn worker, bật giới hạn tần suất, bỏ `DEMO_OTP_PHONES` và tắt `OTP_DEBUG_ENABLED`.
- Khung giờ khám được tự sinh từ lịch mẫu theo tuần cho 14 ngày tới; đổi, tắt hoặc xóa lịch mẫu gỡ khung giờ còn trống và báo nhân viên về các lịch đã đặt bị ảnh hưởng (lịch đã đặt không bị hủy tự động).

## Công nghệ

| Phần | Công nghệ |
| --- | --- |
| Web | Next.js 16, React 19, TypeScript, Tailwind CSS, TanStack Query, Zustand |
| Mobile | Flutter 3.38, Riverpod, GoRouter, Dio, Firebase Messaging, flutter_secure_storage |
| Backend | Node.js 20 trở lên, Express 5, TypeScript, Prisma, PostgreSQL |
| Hàng đợi | Redis, BullMQ |
| Dịch vụ ngoài | Resend, Cloudinary, Firebase Cloud Messaging, Gemini, VNPay |
| Triển khai | Vercel (web), Render (API), Supabase (PostgreSQL), Upstash (Redis) |
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
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
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

cd frontend && npx tsc --noEmit && npm run lint && npm test && npm run build
cd mobile   && flutter analyze && flutter test
```

- Kiểm thử tích hợp chạy trên cơ sở dữ liệu **riêng** (`TEST_DATABASE_URL`, tên hoặc schema phải chứa `test` và khác `DATABASE_URL`); bộ chạy từ chối khởi động nếu không đúng để không xóa nhầm dữ liệu thật.
- Tại 11/11/2026: 101 kiểm thử tích hợp được chia theo 5 bounded context và chạy tuần tự trên schema riêng; các kiểm thử backend còn lại, frontend và Flutter được CI kiểm đếm khi chạy.
- CI (`.github/workflows/phase0.yml`): các job `guard` (chặn tệp bí mật), `backend`, `frontend`, `mobile` chạy song song và chỉ chạy khi pull request có đổi phần tương ứng (đổi workflow hoặc chạy trên `main` thì chạy đủ); build APK chỉ khi đổi mobile hoặc trên `main`. Job `verify` gom kết quả: phần bị bỏ qua tính là đạt, phần lỗi thì lỗi. Backend: kiểm tra schema Prisma, kiểu, smoke, đơn vị, tích hợp, build. Frontend: kiểm tra kiểu, lint, kiểm thử đơn vị, build. Mobile: phân tích, kiểm thử Flutter, cảnh báo tệp Dart trên 800 dòng.

## Triển khai

| Thành phần | Nền tảng | Ghi chú |
| --- | --- | --- |
| Web | Vercel, thư mục gốc `frontend` | Đặt `NEXT_PUBLIC_API_URL` (kết thúc bằng `/api/v1`, ví dụ `https://hospital-api.ngoloi.dev/api/v1`) và `NEXT_PUBLIC_SITE_URL` |
| API | Render Web Service, thư mục gốc `backend` | Build `npm install && npm run render:build` (chạy migration rồi build), start `npm run start` |
| Redis | Upstash | Dùng cho hàng đợi, bộ đếm giới hạn tần suất và phát tín hiệu thu hồi quyền; nên đặt chính sách `noeviction`. Production cần hai ACL user khác nhau (xem phần kiến trúc) |
| Cơ sở dữ liệu | Supabase (PostgreSQL) | `DATABASE_URL` là chuỗi **Session pooler** (cổng 5432; mã hóa `@`, `#` trong mật khẩu thành `%40`, `%23`). Migration áp dụng khi build API. Nên tắt Data API (backend kết nối thẳng, không dùng) và bật RLS cho mọi bảng; có thể bật trigger tự bật RLS cho bảng mới |

**Hạn mức gói miễn phí:** mỗi dịch vụ giới hạn theo cách riêng (Upstash giới hạn số lệnh Redis mỗi tháng, Supabase tự tạm dừng khi lâu không hoạt động, Render tự ngủ khi không có truy cập), nên các việc nền được giữ ở mức thưa. Đổi nhà cung cấp cơ sở dữ liệu chỉ cần đổi `DATABASE_URL` (dự án chỉ yêu cầu PostgreSQL; schema có trigger, ràng buộc CHECK và SQL thô đặc thù PostgreSQL); dùng `npx prisma migrate deploy` để dựng cấu trúc, rồi `npm run seed:demo-full` và `npm run seed:chatbot-faq` trong `backend` nếu cần dữ liệu demo (tài khoản demo dùng mật khẩu cố định trong mã nguồn, chỉ dành cho môi trường thử).

Production dùng duy nhất một topology: API và toàn bộ worker chạy trong cùng Web Service với `INLINE_WORKERS=otp,appointments,notifications,payments`. Các lệnh `worker:*:dev` chỉ dùng để chẩn đoán cục bộ, không phải đường triển khai production.

### Năng lực tải backend

- Pool PostgreSQL được tính theo `DATABASE_TOTAL_CONNECTION_BUDGET`, phần dự phòng và tổng số replica API/worker. Inline worker dùng chung process/pool với API nên không tính vào `DATABASE_WORKER_REPLICA_COUNT`; worker chạy thành service riêng phải được tính.
- Production mặc định ghi `[RUNTIME_METRICS]` mỗi 60 giây gồm memory, pool PostgreSQL, request/DB query và backlog BullMQ. Bật `DATABASE_QUERY_METRICS_ENABLED=true` trong một khoảng quan sát có kiểm soát khi cần số liệu query chi tiết; không bật `PERFORMANCE_HEADERS_ENABLED` ở production.
- Không thêm index dựa trên phỏng đoán. Trước mỗi migration index, chạy truy vấn đại diện trên staging/test bằng `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`, lưu kế hoạch trong ticket/PR (không commit file export), so sánh rows estimated/actual, scan type và thời gian trước/sau. Không chạy `ANALYZE` với câu lệnh ghi dữ liệu production.

## Thanh toán VNPay

VNPay là cổng thanh toán trực tuyến duy nhất. Return URL và IPN dùng chung một xử lý không ghi nhận hai lần; có đối soát giao dịch bị lỡ bằng API `querydr` (worker và khi người dùng mở lại giao dịch) và hoàn tiền toàn phần qua API cho quản trị. Hiện chạy ở môi trường sandbox; đối soát và hoàn tiền mới được kiểm thử bằng phản hồi giả ký đúng đặc tả, chưa thử với sandbox thật.

Cấu hình (chỉ ở backend, biến mẫu trong `backend/.env.example`): `PAYMENT_VNPAY_ENABLED`, `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL`, `VNPAY_RETURN_URL` (HTTPS, trỏ về `/api/v1/payments/vnpay/return`), `PAYMENT_RESULT_URL`. Địa chỉ IPN `/api/v1/payments/vnpay/ipn` được đăng ký trong cổng quản trị merchant của VNPay. Thiếu khóa thì VNPay tự ẩn khỏi ứng dụng.

## Phân quyền và bảo vệ dữ liệu y tế

- **Ma trận quyền động:** 43 mã quyền, 4 vai trò nhân sự. Mỗi quyền khai báo vai trò đủ điều kiện, vai trò cố định và mặc định; quản trị chỉ bật tắt trong tập đủ điều kiện. Quản trị không mặc định có mọi quyền và không đọc nội dung bệnh án, đơn thuốc.
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
- Máy chủ gói miễn phí có độ trễ khi khởi động lại; các việc nền chạy trong tiến trình API nên tạm dừng khi máy chủ ngủ.
- Hạn mức gói miễn phí của Redis (Upstash) và cơ sở dữ liệu có thể làm hàng đợi hoặc truy vấn bị chặn khi dùng nhiều; OTP đã có đường gửi trực tiếp dự phòng, các việc nền khác chưa có.
- Production kiểm tra cấu hình khi khởi động và từ chối chạy nếu Redis hoặc worker sai quy định (hai ACL user, `rediss://`, `INLINE_WORKERS` đủ bốn worker). Gói miễn phí chỉ có một người dùng Redis và giới hạn số lệnh có thể không đáp ứng, nên có thể cần Redis trả phí hoặc hai cơ sở dữ liệu Redis riêng.
- Mọi client chỉ dùng `/api/v1`; đường dẫn cũ `/api/*` trả 404, nên khi đổi biến môi trường trên Vercel, Render và cổng VNPay phải dùng đường dẫn mới.
- Dữ liệu trên môi trường triển khai hiện là bộ dữ liệu demo; tài khoản demo có email giả nên không nhận được OTP, cần đặt email thật cho tài khoản dùng để đăng nhập.
- Tiền thuốc tính theo thực cấp, thêm vào hóa đơn chưa thanh toán khi cấp thuốc; hóa đơn đã thanh toán hoặc đã hủy không tự đổi (nhân viên được báo xử lý); chưa có hoàn tiền một phần.

**Hướng phát triển:** tích hợp SMS, chuyển VNPay sang production, quyền xem khẩn cấp có lý do bắt buộc cho quản trị, cho bác sĩ xem lịch sử khám khi có lịch hẹn hiện hành, báo cáo độ phủ kiểm thử, thông báo thời gian thực cho dashboard, khám từ xa qua video.

## Tác giả

- Sinh viên: Ngô Quang Lợi (24810036)
- Giảng viên hướng dẫn: TS. Phan Thị Thể
- Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCMUTE)
