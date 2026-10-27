# Checklist kiểm thử production trên thiết bị thật

**Trạng thái hiện tại: Android local/demo đã nghiệm thu; staging/production và
iOS chưa đánh dấu hoàn thành.**

Mốc này được giữ lại để thực hiện sau khi môi trường deploy ổn định. Không dùng
`TEST_DATABASE_URL`; Web và mobile kiểm thử thao tác thật phải dùng `DATABASE_URL`
demo hoặc database staging được chỉ định rõ.

## Điều kiện trước khi chạy

- Backend production/staging health check đạt và mobile dùng đúng HTTPS API URL.
- Firebase Admin credential, notification worker và Redis hoạt động.
- Android release/profile có `google-services.json` đúng project.
- Có tài khoản bệnh nhân demo, lịch hẹn demo và dashboard role phù hợp.
- Nếu nghiệm thu thanh toán: chỉ dùng MoMo sandbox cho đến khi có credential
  production, IPN HTTPS và biên bản đối soát. Tuyệt đối không dùng mock trên production.

## Cảnh báo vận hành đã ghi nhận

- Redis hiện phát cảnh báo eviction policy `optimistic-volatile`; instance dành
  cho BullMQ cần chuyển sang `noeviction` trước production để tránh mất job.
- PostgreSQL driver cảnh báo `sslmode=require` sẽ đổi semantics ở pg 9; khi nâng
  dependency cần chốt rõ `sslmode=verify-full` nếu muốn giữ xác minh hiện tại.
- Android dev đã có luồng FCM; iOS vẫn cần `GoogleService-Info.plist`, APNs và
  kiểm thử trên thiết bị thật nếu đưa iOS vào phạm vi phát hành.

## Luồng cần xác minh

- Cold start, warm start, đăng nhập OTP, refresh token và đăng xuất.
- Mạng Wi-Fi/4G, mất mạng, mạng chậm, backend khởi động lại.
- Đặt lịch, OTP, lịch hẹn list/detail/cancel và back navigation.
- Dashboard chuyển trạng thái: confirm, reschedule, check-in, in-progress,
  complete, no-show/cancel.
- Inbox và push ở foreground/background/terminated; deep link đúng màn hình.
- Hồ sơ khám publish, đơn thuốc issue và hóa đơn xuất hiện đúng quyền sở hữu.
- Thanh toán sandbox: mở provider, quay lại app, IPN cập nhật hóa đơn; kiểm tra
  thêm thất bại, hết hạn, callback lặp và số tiền/chữ ký không hợp lệ.
- Làm mới dữ liệu khi app resume, đổi tab và nhận notification.
- Không lộ token, OTP, số điện thoại hay dữ liệu y tế trong log.

## Điều kiện hoàn thành

Chỉ chuyển trạng thái sang hoàn thành khi có biên bản thiết bị/phiên bản build,
kết quả từng luồng, lỗi còn lại và bằng chứng push/background trên máy thật.

## Kết quả Android local/demo ngày 22/10/2026

- Xiaomi 23129RAA4G, Android 15/API 35 nhận đúng API qua `adb reverse`.
- Cold/warm app, khôi phục phiên, trang chủ, hộp thư và deep link thông báo hoạt
  động trên `DATABASE_URL` demo.
- Push thông báo bệnh viện đã kích hoạt làm mới hộp thư khi bật preference.
- Khi tắt preference, delivery chuyển `CANCELLED`, không phát push nhưng dữ liệu
  vẫn xuất hiện sau thao tác kéo làm mới; preference đã được bật lại sau test.
- Backend integration đạt 37/37 và Flutter test đạt 151/151 tại thời điểm nghiệm
  thu.
- Chưa dùng kết quả local này để thay thế nghiệm thu HTTPS staging, background/
  terminated push trên bản release, iOS hoặc chính sách Redis production.
