# Phase 1 — Backend Mobile Readiness

## Contract và compatibility

- API patient mới nằm dưới `/api/v1`; các route Web hiện tại dưới `/api` được giữ nguyên.
- Dashboard tiếp tục dùng access/refresh token trong cookie `HttpOnly`.
- Patient/mobile nhận access token ngắn hạn và refresh token xoay vòng trong response body để client lưu refresh token trong secure storage.
- Response v1 thành công dùng `{ success, data, meta? }`; lỗi dùng `{ success: false, code, message, requestId, errors }`.
- Pagination v1 mặc định 20, tối đa 50 và trả `page`, `limit`, `total`, `totalPages`, `hasNextPage`, `hasPreviousPage`.

## API v1 inventory

- Auth: `POST /api/v1/auth/patient/request-otp`, `POST /api/v1/auth/patient/verify-otp`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`.
- Session: `GET /api/v1/auth/sessions`, `DELETE /api/v1/auth/sessions/:id`.
- Profile: `GET /api/v1/me`, `PATCH /api/v1/me`.
- Appointment: `GET /api/v1/me/appointments`, `GET /api/v1/me/appointments/:id`, `POST /api/v1/me/appointments/:id/cancel`.
- Clinical: list/detail medical records and prescriptions dưới `/api/v1/me`; file kết quả dùng endpoint download có Bearer auth.
- Billing: list/detail invoice dưới `/api/v1/me/invoices`; online payment không nằm trong MVP.
- Capability discovery: `GET /api/v1/capabilities`.

## Session policy

- Một lần xác thực OTP tạo một session riêng, có metadata thiết bị ngay trên session; chưa cần model `Device` vì Phase 1 chưa bật push notification.
- Refresh token chỉ dùng một lần. Mỗi lần refresh tạo token kế nhiệm và lưu lịch sử hash.
- Nếu token cũ bị dùng lại hoặc hai request dùng cùng token đồng thời, toàn bộ token family bị thu hồi.
- Patient có thể xem và thu hồi từng session khác. Logout phiên hiện tại dùng refresh token.

## Patient ownership policy

- `patientId` luôn lấy từ access token, không nhận từ query/body.
- Detail không đúng chủ sở hữu trả `404` để không tiết lộ tài nguyên tồn tại.
- Medical record chỉ hiển thị khi `PUBLISHED`; prescription chỉ hiển thị khi `ISSUED`.
- DTO không trả `resultPdfUrl`, `fileUrl`, invoice barcode hay trường nội bộ của Prisma.

## Secure file policy

- Client chỉ nhận URL API có Bearer auth; backend kiểm tra ownership rồi proxy nội dung file.
- Backend chỉ fetch HTTPS từ host trong `MEDICAL_FILE_ALLOWED_HOSTS`, không follow redirect, giới hạn thời gian và kích thước.
- Khi chuyển dữ liệu y tế sang Cloudinary `authenticated` asset, có thể thay proxy bằng signed delivery mà không đổi DTO client.

## Payment decision

Online payment chính thức nằm ngoài Patient MVP. `/api/v1/capabilities` trả `payment.enabled=false` và không quảng bá mock/MoMo/VNPAY cho mobile. Chỉ bật lại sau khi có provider thật, verified webhook, idempotency và reconciliation.

## Schedule reconciliation policy

- Weekly schedule chỉ là template; thay đổi template chỉ áp dụng cho slot tạo mới. Không tự động xóa/di chuyển slot đã sinh vì có thể phá lịch hẹn hiện hữu.
- Slot đã gắn appointment đang hoạt động là immutable và phải ở `BOOKED`.
- Reconciliation tự sửa ba trường hợp an toàn: slot `BOOKED` mồ côi, linked slot không `BOOKED`, appointment terminal vẫn còn gắn slot.
- Sai lệch doctor/date/time giữa appointment và slot chỉ được báo cáo, không tự sửa vì không thể suy ra dữ liệu nào đúng.
- Worker lifecycle chạy đối soát định kỳ; Admin có thể chạy thủ công qua `POST /api/dashboard/doctor-time-slots/reconcile`.

## Verification

- `npm run test:phase1` chạy Prisma generate, TypeScript test compile, smoke test và integration test trên `TEST_DATABASE_URL`.
- Integration suite hiện có 22 contract, gồm backward compatibility Phase 0, patient ownership, refresh-token reuse, multi-session revoke và slot reconciliation.
