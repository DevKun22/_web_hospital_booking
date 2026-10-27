# Phase 2 — Flutter Foundation

## Kết quả

Flutter patient client nằm tại `mobile/`, ngang cấp với `backend/` và `frontend/`. Phase này chỉ dựng nền dùng chung API v1, chưa sao chép business rule từ backend và chưa triển khai chi tiết booking/medical/payment.

## Kiến trúc đã chốt

- Flutter Android/iOS, cấu trúc theo feature.
- Riverpod quản lý dependency và state; GoRouter quản lý route guard/deep-link.
- Dio dùng contract `/api/v1`, timeout theo build config và log debug chỉ gồm HTTP method/path.
- Access token chỉ ở memory. Refresh token và installation device ID nằm trong Keychain/Android secure storage.
- Refresh token rotation dùng single-flight: nhiều request `401` cùng lúc chỉ gọi refresh một lần, sau đó mỗi request thử lại tối đa một lần.
- Khi refresh thất bại do mạng/timeout, token chưa bị xóa. Chỉ lỗi xác thực/revoke/expiry mới kết thúc phiên local.
- Lỗi client chuẩn hóa theo validation/auth/permission/not-found/conflict/rate-limit/network/timeout/server và giữ `requestId` để tra log backend.
- Profile development cho phép HTTP local trên Android debug. Profile production bắt buộc HTTPS.
- Custom deep-link skeleton: `hospitalbooking://app/<route>`. App/universal links theo domain thật sẽ thêm khi có domain phát hành.

## Ranh giới dữ liệu

- Không log token, OTP, request/response body, số điện thoại hoặc dữ liệu khám.
- Không đặt secret trong `dart-define`; file này chỉ chứa URL và timeout công khai.
- Không cache mutation đặt lịch/thanh toán và không tự quyết định lifecycle nghiệp vụ ở client.
- Persistent cache chưa được thêm ở foundation vì chưa có DTO/query Phase 3 và dữ liệu lịch hẹn cần chính sách mã hóa/TTL rõ ràng. Khi làm từng repository, chỉ cache read model có giới hạn; public catalog và dữ liệu bệnh nhân dùng policy riêng.
- Analytics/crash SDK bên thứ ba chưa được gắn khi chưa có quyết định consent, retention và redaction dữ liệu y tế. Đây là chủ đích an toàn, không phải thiếu sót runtime.

## Kiểm tra tự động

- `flutter analyze`: đạt, không có issue.
- `flutter test`: kiểm tra API contract, error mapping/requestId, rate limit, cấu hình production, error UI và concurrent single-flight refresh.
- GitHub Actions chạy `flutter pub get`, `flutter analyze`, `flutter test` cùng quality gate backend/frontend.

## Kiểm tra thủ công local

1. Backend chạy cổng 4000 với database test/local và `OTP_DEBUG_ENABLED=true`.
2. Trong `mobile/`, sao chép `config/dev.json.example` thành `config/dev.json`.
3. Android Emulator dùng URL `http://10.0.2.2:4000/api/v1`; thiết bị thật thay bằng IP LAN của máy backend.
4. Chạy `flutter run -t lib/main_dev.dart --dart-define-from-file=config/dev.json`.
5. Kiểm tra: mở app -> nhập số điện thoại -> nhận challenge/debug OTP -> xác thực -> Home -> Profile -> logout.
6. Đóng/mở lại app sau đăng nhập: phiên phải được khôi phục bằng refresh token.
7. Tắt backend rồi mở app: hiện trạng thái mất kết nối và nút thử lại, không tự xóa refresh token.

## Điều kiện trước khi build Android trên máy hiện tại

`flutter doctor -v` báo Android license chưa được xác nhận. Chạy `flutter doctor --android-licenses` trong terminal cá nhân và chấp nhận các license phù hợp. Trong môi trường thực thi Codex, Gradle còn bị chặn kết nối loopback nội bộ trước bước compile; Dart analyze/test vẫn chạy thành công. Cần chạy lại lệnh `flutter build apk --debug -t lib/main_dev.dart` trong terminal người dùng để xác nhận native build.

## Tiêu chí chuyển Phase 3

- CI mobile xanh.
- Đăng nhập/khôi phục phiên/logout chạy trên ít nhất một Android Emulator hoặc thiết bị thật.
- API local dùng đúng `/api/v1` và không xuất hiện token/OTP/body trong log.
- Chưa merge business rule booking vào Flutter; Phase 3 sẽ gọi endpoint/capability từ backend.
