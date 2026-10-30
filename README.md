# Hospital Booking

Hệ thống đặt lịch khám bệnh trực tuyến gồm site người dùng, dashboard quản trị bệnh viện và backend API. Dự án được xây dựng cho môn Tiểu Luận Chuyên Ngành, tập trung vào luồng đặt lịch, xác thực OTP, vận hành khám bệnh, hóa đơn, thanh toán, chatbot hỗ trợ và tìm kiếm nội dung y tế.

website đã deploy: https://web-hospital-booking.vercel.app
Dashboard: https://web-hospital-booking.vercel.app/dashboard

## Thông Tin Author

- Developer: ``Ngô Quang Lợi``
- Email: ``kamado.nql2109@gmail.com``
- Môn học: ``Tiểu Luận Chuyên Ngành CNTT``
- Trường: ``Đại Học Công Nghệ Kỹ Thuật TP HCM - HCMUTE``
- GVHD: ``GV, TS. Phan Thị Thể``

## Mục Tiêu

- Giúp người bệnh xem chuyên khoa, bác sĩ, gói khám và đặt lịch khám trực tuyến.
- Hỗ trợ tra cứu lịch hẹn, xác thực OTP, hủy lịch, xem hóa đơn và kết quả khám.
- Cung cấp dashboard cho quản trị viên, nhân viên và bác sĩ quản lý nghiệp vụ khám bệnh.
- Tích hợp các thành phần triển khai thực tế như Redis queue, gửi email OTP, upload ảnh, tìm kiếm Elasticsearch và theo dõi hiệu năng trên Vercel.

## Công Nghệ Sử Dụng

| Phần | Công nghệ |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| State/Data | TanStack Query, Zustand |
| UI | Lucide Icons, Embla Carousel, Recharts |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Queue | Redis, BullMQ, ioredis |
| Email OTP | Resend, Nodemailer fallback |
| Upload | Cloudinary, MediaAsset tracking |
| Search | Elasticsearch, PostgreSQL fallback |
| Deploy | Vercel frontend, Render backend và worker |
| Analytics | Vercel Analytics, Vercel Speed Insights |

## Kiến Trúc Tổng Quan

```txt
Người dùng / Dashboard
        |
        v
Next.js Frontend
        |
        v
Express Backend API
        |
        +--> PostgreSQL + Prisma
        +--> Redis + BullMQ OTP Worker
        +--> Resend / Nodemailer
        +--> Cloudinary
        +--> Elasticsearch
```

PostgreSQL là nguồn dữ liệu chính. Elasticsearch chỉ là lớp tăng tốc và cải thiện trải nghiệm tìm kiếm public; nếu Elasticsearch lỗi, API search có thể fallback về PostgreSQL. OTP được tạo ở backend, lưu vào database và đưa vào hàng đợi Redis để worker gửi nền.

## Cấu Trúc Thư Mục

```txt
|-->backend/       # Express API, Prisma schema, services, workers
|-->frontend/      # Next.js app, dashboard, public website, UI components
```

## Tính Năng Chính

### Site Người Dùng

- Trang chủ lấy cấu hình động từ dashboard: logo, favicon, banner, FAQ, thông tin bệnh viện.
- Banner hero dạng carousel bằng Embla.
- Danh sách và chi tiết chuyên khoa, bác sĩ, gói khám.
- Trang chi tiết có skeleton loading, cache server và tải song song dữ liệu độc lập để điều hướng mượt hơn.
- Form đặt lịch gồm thông tin bắt buộc và thông tin bổ sung.
- Chọn chuyên khoa, bác sĩ, ngày khám, slot khám và gói khám.
- Xác thực OTP khi đặt lịch.
- Hiển thị mã đặt lịch, nút copy mã, box OTP test khi bật debug.
- Giao diện tra cứu lịch hẹn bằng mã lịch và số điện thoại theo luồng xác thực OTP trước khi hiển thị chi tiết.
- Quên mã lịch bằng OTP.
- Hủy lịch public có xác thực OTP.
- Đánh giá trải nghiệm khám sau khi lịch hoàn thành, xác thực OTP theo số điện thoại.
- Xem hóa đơn, thanh toán online/mock payment.
- Xem kết quả khám, kết quả lâm sàng và đơn thuốc đã phát hành.
- Chatbot hỗ trợ đặt lịch, tra cứu, FAQ và điều hướng nhanh.
- Tìm kiếm public bằng Elasticsearch: chuyên khoa, bác sĩ, gói khám, FAQ, chatbot FAQ.
- Social widgets, nút cuộn lên đầu, form tư vấn nổi.

### Dashboard Quản Trị

- Đăng nhập dashboard bằng mật khẩu + OTP, cookie httpOnly.
- Tự đăng xuất hoặc refresh token khi phiên hết hạn.
- Quản lý người dùng, role, trạng thái tài khoản, đổi mật khẩu.
- Quản lý chuyên khoa, bác sĩ, lịch làm việc, slot khám.
- Quản lý gói khám và hạng mục gói khám.
- Quản lý lịch hẹn: xác nhận, check-in, bắt đầu khám, hoàn thành, hủy, no-show.
- Cập nhật thông tin bệnh nhân sau check-in.
- Tạo hồ sơ khám, kết quả lâm sàng, file kết quả, đơn thuốc.
- Tạo hóa đơn từ lịch đã hoàn thành, thanh toán, hoàn tiền.
- Quản lý media assets: ảnh chưa dùng, xóa ảnh, cleanup ảnh không dùng.
- Quản lý cấu hình site: site settings, banner, FAQ.
- Dashboard thống kê bằng card và chart.
- Quản lý chatbot, FAQ chatbot, cấu hình bật/tắt AI.
- Theo dõi Search Analytics.
- Duyệt/ẩn đánh giá của người bệnh; bác sĩ chỉ xem phản hồi ẩn danh thuộc phạm vi của mình.

## Luồng Nghiệp Vụ Chính

### 1. Đặt Lịch Và OTP

```txt
Người bệnh chọn lịch
        |
Frontend gửi POST /api/appointments
        |
Backend validate bác sĩ, slot, ngày khám, thông tin bệnh nhân
        |
Tạo Appointment trạng thái PENDING_OTP
        |
Tạo OTP record trong database
        |
Đưa job OTP vào Redis/BullMQ
        |
API trả response nhanh cho frontend
        |
Worker gửi email/SMS/debug OTP và cập nhật trạng thái gửi
```

Nếu chọn `EMAIL`, bệnh nhân phải nhập email và OTP được gửi qua email. Nếu chọn `SMS`, hệ thống dùng số điện thoại; khi chưa có nhà cung cấp SMS thật, có thể bật `OTP_DEBUG_ENABLED=true` để hiển thị/log OTP phục vụ demo.

### 2. Gửi Lại OTP

- Dùng lại kênh OTP ban đầu của lịch.
- Lịch đặt bằng email thì gửi lại email.
- Lịch đặt bằng SMS thì gửi lại SMS hoặc debug SMS.
- Có kiểm tra cooldown và giới hạn gửi OTP.

### 3. Tra Cứu, Quên Mã Và Đánh Giá

- Giao diện tra cứu bằng `bookingCode + phone` yêu cầu OTP trước khi hiển thị chi tiết lịch.
- Nếu quên mã lịch, người bệnh nhập số điện thoại.
- Backend tìm lịch gần nhất theo số điện thoại.
- Nếu lịch gần nhất có email và dùng kênh email, OTP tra cứu sẽ gửi qua email.
- Nếu không có email, hệ thống fallback về SMS/debug SMS.
- Lịch đã hoàn thành có thể nhận đánh giá qua OTP; đánh giá chỉ công khai khi được ADMIN/STAFF duyệt hiển thị.

### 4. Hủy Lịch

- Chỉ cho hủy các lịch đang chờ xác nhận hoặc đã xác nhận.
- Người bệnh nhập mã lịch, số điện thoại và lý do hủy.
- Backend gửi OTP theo kênh của lịch.
- Xác thực OTP thành công thì cập nhật trạng thái `CANCELLED_BY_PATIENT` và mở lại slot.

### 5. Khám Bệnh Và Hồ Sơ

```txt
Lịch đã xác nhận
    -> Check-in
    -> Bác sĩ bắt đầu khám
    -> Tạo/cập nhật hồ sơ bệnh án
    -> Tạo kết quả lâm sàng, upload file nếu có
    -> Tạo đơn thuốc
    -> Phát hành hồ sơ/kết quả/đơn thuốc
    -> Hoàn thành lịch khám
```

### 6. Hóa Đơn Và Thanh Toán

- Hóa đơn được tạo từ lịch hẹn đã hoàn thành.
- Có hỗ trợ giảm trừ BHYT theo thông tin bệnh nhân và thông tin hóa đơn.
- Có thể hủy hóa đơn để tạo lại khi nhập sai.
- Public site hiển thị hóa đơn và hỗ trợ tạo giao dịch thanh toán.
- Mock payment hỗ trợ demo luồng thành công/thất bại.

### 7. Tìm Kiếm

```txt
Next.js Search UI
        |
Debounce input
        |
Node.js Search API
        |
Elasticsearch nếu bật
        |
PostgreSQL fallback nếu Elasticsearch lỗi
        |
SearchAnalyticsLog ghi nhận từ khóa
```

Các loại dữ liệu được index: `department`, `doctor`, `package`, `faq`, `chatbot_faq`.

## API Chính

### Public API

```txt
GET  /api/site-settings
GET  /api/banners
GET  /api/faqs
GET  /api/departments
GET  /api/departments/:slug
GET  /api/doctors
GET  /api/doctors/:id
GET  /api/doctors/:id/available-slots?date=YYYY-MM-DD
GET  /api/packages
GET  /api/packages/:slug
POST /api/appointments
POST /api/appointments/:id/resend-otp
POST /api/appointments/:id/verify-otp
GET  /api/appointments/lookup/result
POST /api/appointments/lookup/request-otp
POST /api/appointments/lookup/verify-otp
POST /api/appointments/lookup/cancel/request-otp
POST /api/appointments/lookup/cancel/verify
GET  /api/appointments/:id/review
POST /api/appointments/:id/review/request-otp
POST /api/appointments/:id/review
GET  /api/search
GET  /api/search/suggestions
POST /api/search/analytics
```

### Dashboard API

```txt
POST  /api/auth/dashboard/login
POST  /api/auth/dashboard/verify-otp
POST  /api/auth/dashboard/refresh
GET   /api/auth/dashboard/me
POST  /api/auth/dashboard/logout

GET/PATCH          /api/dashboard/site-settings
GET/POST/PATCH/DELETE /api/dashboard/banners
GET/POST/PATCH/DELETE /api/dashboard/faqs
GET/POST/PATCH/DELETE /api/dashboard/departments
GET/POST/PATCH/DELETE /api/dashboard/doctors
GET/POST/PATCH/DELETE /api/dashboard/doctor-schedules
GET/POST/PATCH/DELETE /api/dashboard/doctor-time-slots
GET/POST/PATCH/DELETE /api/dashboard/packages
GET/PATCH          /api/dashboard/appointments
GET/POST/PATCH     /api/dashboard/medical-records
GET/POST/PATCH     /api/dashboard/prescriptions
GET/POST/PATCH     /api/dashboard/invoices
GET                /api/dashboard/statistics
GET/POST/PATCH     /api/dashboard/users
GET/POST/PATCH     /api/dashboard/chatbot
GET                /api/dashboard/reviews
PATCH              /api/dashboard/reviews/:id/visibility
POST               /api/uploads/images
GET                /api/uploads/images
DELETE             /api/uploads/images/:id
POST               /api/uploads/images/cleanup-unused
```

## Cài Đặt Local

### Hạ tầng Docker (khuyến nghị)

Docker có thể cấp PostgreSQL, Redis, backend API và các worker bằng một quy trình có health check và migration gate. Xem [tài liệu kiến trúc Docker](docs/docker-architecture.md) để chọn chế độ chỉ chạy hạ tầng hoặc chạy đầy đủ backend.

### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run seed:demo-full
npm run dev
```

Server mặc định:

```txt
http://localhost:4000/api
```

Chạy OTP worker ở terminal khác:

```bash
cd backend
npm run worker:otp:dev
```

Reindex Elasticsearch nếu có cấu hình:

```bash
cd backend
npm run search:reindex
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend mặc định:

```txt
http://localhost:3000
```

## Biến Môi Trường Quan Trọng

### Backend

```env
PORT=4000
NODE_ENV=production
DATABASE_URL=

FRONTEND_URL=
FRONTEND_URLS=

JWT_SECRET=
OTP_SECRET=
DASHBOARD_COOKIE_SAME_SITE=none

CLOUDINARY_URL=

RESEND_API_KEY=
RESEND_FROM="Hospital Booking <onboarding@resend.dev>"

REDIS_URL=
OTP_WORKER_CONCURRENCY=5
OTP_DEBUG_ENABLED=true
OTP_ENQUEUE_TIMEOUT_MS=500

ELASTICSEARCH_ENABLED=false
ELASTICSEARCH_NODE=
ELASTICSEARCH_API_KEY=
ELASTICSEARCH_INDEX=hospital_public_search
```

### Frontend

Tên biến có thể thay đổi theo cấu hình trong `frontend/lib`, nhưng cần tối thiểu:

```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api
NEXT_PUBLIC_SITE_URL=https://your-frontend.vercel.app
```

## Deploy

### Backend Render Web Service

```txt
Root Directory: backend
Build Command: npm install && npm run render:build
Start Command: npm run start
```

Lưu ý Render Free có thể cold start, request đầu tiên sau thời gian idle sẽ chậm hơn local.

### OTP Worker Render Background Worker

```txt
Root Directory: backend
Build Command: npm install && npm run build
Start Command: npm run worker:otp
```

Worker cần dùng chung `DATABASE_URL`, `REDIS_URL`, `RESEND_API_KEY`, `RESEND_FROM`, `OTP_SECRET`, `JWT_SECRET`.

### Frontend Vercel

```txt
Root Directory: frontend
Build Command: npm run build
Output: Next.js mặc định
```

Sau khi đổi backend URL, cần cập nhật `NEXT_PUBLIC_API_URL` trên Vercel và redeploy.

## Dữ Liệu Demo

Tạo dữ liệu demo đầy đủ:

```bash
cd backend
npm run seed:demo-full
```

Script demo có thể reset database và sinh chuyên khoa, bác sĩ, gói khám, slot lịch, tài khoản demo. Cần kiểm tra kỹ biến môi trường trước khi chạy trên database thật.

## Ghi Chú Kỹ Thuật

- `@default(uuid())` của Prisma sinh UUID v4.
- Dashboard dùng access token và refresh token qua httpOnly cookie.
- OTP không lưu plaintext trong database, chỉ lưu hash HMAC.
- OTP gửi nền qua BullMQ để giảm thời gian phản hồi của API đặt lịch.
- Nếu chưa có SMS provider thật, bật `OTP_DEBUG_ENABLED=true` để demo bằng OTP test.
- Media upload đánh dấu `isUsed` để dọn ảnh không còn được sử dụng.
- Site settings điều khiển logo, favicon, banner, FAQ và một số nội dung public.
- TanStack Query được dùng để cache/refetch dữ liệu frontend.
- Zustand được dùng để đồng bộ trạng thái đặt lịch giữa trang chi tiết và form đặt lịch.
- Các trang chi tiết public dùng `loading.tsx` để hiển thị skeleton ngay khi chuyển route; dữ liệu detail được cache theo ISR 5 phút và khử request trùng giữa metadata/nội dung.
- Review lưu điểm tổng quan và các điểm thành phần; dữ liệu công khai chỉ lấy review đã được duyệt, không lộ tên bệnh nhân hay mã lịch.
- Vercel Analytics và Speed Insights dùng để theo dõi traffic và hiệu năng frontend.
- Render Free có cold start; nên warm up backend trước khi demo.

## Kiểm Tra Trước Khi Commit

Backend:

```bash
cd backend
npx tsc --noEmit
```

Frontend:

```bash
cd frontend
npx tsc --noEmit
npm run lint
npm run build
```

## Hạn Chế Hiện Tại

- SMS thật chưa được tích hợp, hiện dùng debug OTP hoặc email OTP.
- Render Free có độ trễ do cold start và giới hạn tài nguyên.
- Thanh toán thật mới ở mức mô phỏng/mock hoặc cần cấu hình thêm provider.
- Một số chính sách BHYT mới dừng ở mức hỗ trợ nhập và tính giảm trừ theo dữ liệu hệ thống, chưa thay thế quy trình giám định bảo hiểm thực tế.
- Endpoint kết quả khám public hiện được UI gọi sau bước OTP; nên bổ sung lookup token ngắn hạn ở backend để buộc API thực thi cùng chính sách bảo mật.

## Hướng Phát Triển

- Tích hợp SMS provider thật.
- Hoàn thiện thanh toán thật qua MoMo/VNPAY/ZaloPay.
- Bổ sung notification real-time cho dashboard.
- Thêm audit log chi tiết hơn cho thao tác quản trị.
- Nâng cấp chatbot theo hướng hiểu ngữ cảnh và truy vấn dữ liệu linh hoạt hơn.
- Tối ưu Elasticsearch ranking và dashboard Search Analytics.
- Bổ sung test tự động cho service nghiệp vụ quan trọng.
- Call Video khám online trực tuyến với Bác sĩ
