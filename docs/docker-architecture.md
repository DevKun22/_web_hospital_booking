# Kiến trúc Docker cục bộ

## Kết luận

Docker được dùng làm lớp hạ tầng phát triển có thể tái tạo, không thay thế Render và không ép frontend/mobile chạy trong container. Mặc định chỉ khởi động PostgreSQL và Redis; backend cùng các worker dùng cùng một image nhưng chạy thành các tiến trình độc lập. Notification worker là profile tùy chọn.

## Thành phần

| Thành phần | Vai trò | Cổng máy host | Khởi động mặc định |
| --- | --- | --- | --- |
| PostgreSQL 16 | Database local và database test tách biệt | `5433` | Có |
| Redis 7 | Hàng đợi OTP, lịch hẹn và thông báo | `6380` | Có |
| Backend API | REST API và health check | `4000` | Khi dùng file backend |
| OTP worker | Xử lý hàng đợi gửi OTP | Không công khai | Khi dùng file backend |
| Appointment worker | Xử lý hết hạn và vòng đời lịch | Không công khai | Khi dùng file backend |
| Notification worker | Đồng bộ push FCM; inbox vẫn hoạt động khi thiếu Firebase | Không công khai | Profile `notifications` |

Database được tạo tự động:

- `hospital_booking_dev`: dùng khi chạy app local bằng Docker.
- `hospital_booking_test`: chỉ dùng cho kiểm thử tích hợp có tính phá hủy dữ liệu.

## Luồng khởi động có kiểm soát

1. PostgreSQL và Redis phải qua health check.
2. `backend-migrate` chạy `prisma migrate deploy` đúng một lần.
3. Chỉ khi migration thoát thành công, API và các worker mới được khởi động.
4. API được xem là sẵn sàng khi `/health` trả về thành công.
5. Dữ liệu PostgreSQL và Redis nằm trong named volume nên không mất khi container được tạo lại.

## Lệnh vận hành

Chỉ chạy hạ tầng:

```powershell
docker compose up -d
```

Chạy API và các worker nền chính:

```powershell
docker compose -f compose.yaml -f compose.backend.yaml up -d --build
```

Bật notification worker và truyền khóa Firebase dạng Base64 từ môi trường máy:

```powershell
$env:FIREBASE_SERVICE_ACCOUNT_BASE64="<base64>"
docker compose -f compose.yaml -f compose.backend.yaml --profile notifications up -d notification-worker
```

Xem trạng thái và log:

```powershell
docker compose -f compose.yaml -f compose.backend.yaml ps --all
docker compose -f compose.yaml -f compose.backend.yaml logs -f backend-api
```

Dừng container nhưng giữ dữ liệu:

```powershell
docker compose -f compose.yaml -f compose.backend.yaml --profile notifications down
```

Không thêm `--volumes` trừ khi chủ động muốn xóa toàn bộ dữ liệu local trong named volume.

## Kiểm thử tích hợp

Khi backend chạy trực tiếp trên Windows, dùng cổng PostgreSQL của host:

```powershell
$env:TEST_DATABASE_URL="postgresql://hospital_booking:hospital_booking_dev@127.0.0.1:5433/hospital_booking_test?schema=public"
npm --prefix backend run test:integration
```

`TEST_DATABASE_URL` chỉ dành cho test. Web, mobile và thao tác demo thực tế vẫn dùng `DATABASE_URL`.

## Biến cấu hình và an toàn

- Các secret trong `compose.backend.yaml` là giá trị local cố ý không dùng được ở production.
- `CLOUDINARY_URL` local chỉ giúp backend khởi động; upload thật cần cấu hình Cloudinary hợp lệ ngoài file được commit.
- `FIREBASE_SERVICE_ACCOUNT_BASE64` được truyền từ môi trường host và không được ghi vào repository.
- Không mount `backend/.env` hoặc file Firebase key vào image.
- Container runtime chạy bằng user `node`, không chạy bằng root.
- Production trên Render tiếp tục dùng database/Redis được quản lý và các biến secret của Render; không sao chép các giá trị local trong Compose lên production.

## Phạm vi CI

Workflow kiểm tra:

- không có `.env`, Firebase private key hoặc cấu hình mobile local bị theo dõi bởi Git;
- Prisma schema, type checking, smoke test và integration test;
- cấu hình Compose hợp lệ;
- image backend production build thành công.

## Giới hạn đã chủ động giữ lại

- Firebase push thật không được kiểm tra nếu chưa truyền credential; notification inbox vẫn hoạt động và delivery push ở trạng thái chờ.
- Frontend và Flutter tiếp tục chạy bằng quy trình hiện có để giữ hot reload và kết nối điện thoại thật thuận tiện.
