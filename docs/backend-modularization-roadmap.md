# Lộ trình modular hóa backend Hospital Booking

## Mục tiêu

Chuyển backend từ cấu trúc phân lớp theo kỹ thuật sang modular monolith theo
nghiệp vụ, theo từng bước nhỏ và có thể kiểm chứng. Không đổi URL API, database
schema hoặc hành vi client chỉ vì thay đổi cấu trúc thư mục.

## Bất biến phải bảo toàn

1. Web legacy tiếp tục dùng `/api/*`; mobile tiếp tục dùng `/api/v1/*` cho đến
   khi có kế hoạch chuyển contract riêng.
2. Giữ nguyên response envelope, HTTP status, error code và thông báo validation.
3. Việc giữ slot và tạo lịch vẫn nằm trong cùng transaction.
4. Chuyển trạng thái lịch phải tiếp tục dùng compare-and-set và trả
   `APPOINTMENT_STATE_CONFLICT` khi có cạnh tranh.
5. OTP hold, giải phóng slot, audit log và notification không được tách khỏi
   transaction boundary hiện tại nếu chưa có test thay thế.
6. Dashboard role và doctor scope phải được kiểm tra ở cả route lẫn use case.
7. Không dùng `TEST_DATABASE_URL` cho thao tác kiểm thử thủ công trên web/app.

## Quy trình cho mỗi mốc

1. Dùng Graphify xác định dependency vào/ra và các consumer.
2. Chạy type-check và smoke test để khóa baseline.
3. Chỉ di chuyển hoặc trích xuất một trách nhiệm.
4. Giữ adapter/export tương thích tại vị trí cũ nếu consumer chưa chuyển hết.
5. Chạy unit, smoke và integration test phù hợp.
6. So sánh endpoint, trạng thái và side effect trước/sau.
7. Cập nhật knowledge graph sau khi code đạt kiểm thử.

## Thứ tự triển khai

### M0 — Baseline và shared kernel

- [x] Lập knowledge graph backend–frontend–mobile.
- [x] Xác nhận không có import cycle trong graph hiện tại.
- [x] Khóa baseline bằng TypeScript và smoke test.
- [x] Tạo parser dùng chung cho path/query mà không đổi semantics.
- [ ] Chuyển tuần tự các controller còn lại sang parser dùng chung.
- [ ] Chuẩn hóa request actor sau khi so sánh đầy đủ role/scope từng controller.

Điều kiện hoàn thành: type-check, unit test parser và smoke test đều xanh.

### M1 — Khung module Appointment và read side

- Tạo `modules/appointments` với public API nội bộ rõ ràng.
- Tách list/detail/read projection khỏi `AppointmentService`.
- Dùng repository đọc cho dashboard và patient portal.
- Giữ nguyên route/controller hiện tại làm adapter trong thời gian chuyển đổi.

Điều kiện hoàn thành: kết quả list/detail và phân trang không đổi; contract test
web/mobile đạt.

### M2 — Appointment lifecycle

- Tách transition guard, audit log và lifecycle policy.
- Tách confirm, check-in, start, complete, no-show, cancel và reschedule thành
  application service có transaction boundary rõ ràng.
- Giữ notification creation như side effect được điều phối sau transaction.

Điều kiện hoàn thành: test toàn bộ state machine, role scope và cạnh tranh 409.

### M3 — Booking creation và OTP verification

- Tách catalog validation, pricing snapshot và slot reservation.
- Tách pending OTP hold, verify, expiry và release.
- Giữ atomic `AVAILABLE → BOOKED` và cơ chế bồi hoàn khi gửi OTP thất bại.

Điều kiện hoàn thành: integration test đặt trùng slot, OTP sai/hết hạn, đặt cho
bản thân/người thân và giải phóng hold đạt.

### M4 — Doctor và Scheduling

- Tách Doctor catalog read khỏi Doctor administration.
- Gom DoctorSchedule, DoctorTimeSlot và ScheduleChangeRequest vào scheduling
  module, nhưng giữ Doctor identity ở doctors module.
- Chuẩn hóa deactivate/archive thay cho hard delete khi đã có dữ liệu lịch sử.

### M5 — Clinical, Billing và Notification

- Clinical: MedicalRecord, LabResult, Prescription.
- Billing: Invoice, InvoiceItem, PaymentTransaction và provider adapters.
- Notification: inbox, preference, campaign và delivery worker.
- Giao tiếp giữa module qua application port/event có kiểu rõ ràng.

### M6 — Hợp đồng API chung

- Chốt OpenAPI cho `/api/v1`.
- Sinh TypeScript/Dart models hoặc kiểm tra schema tự động.
- Chuyển web sang v1 theo từng endpoint; legacy giữ telemetry và thời hạn loại bỏ.

### M7 — Architecture guard

- Kiểm tra import cycle và dependency direction trong CI.
- Cấm module import controller/route của module khác.
- Shared chỉ chứa hạ tầng ổn định, không chứa nghiệp vụ cụ thể.
- Cập nhật Graphify sau mỗi mốc refactor.

## Cấu trúc đích

```text
src/
  modules/
    identity/
    patients/
    doctors/
    scheduling/
    appointments/
    clinical/
    billing/
    notifications/
    chatbot/
    public-content/
  shared/
    database/
    http/
    auth/
    errors/
    queue/
  app.ts
```

Đây là cấu trúc đích, không phải yêu cầu di chuyển toàn bộ file ngay lập tức.
Trong giai đoạn chuyển đổi, code mới đi vào module còn file cũ đóng vai trò
adapter tương thích cho đến khi consumer và test đã được chuyển hết.
