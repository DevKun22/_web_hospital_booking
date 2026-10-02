# Hospital Booking Mobile

Ứng dụng Flutter dành cho bệnh nhân, dùng chung API `/api/v1` với hệ thống web.

## Phạm vi Phase 2

- Khung ứng dụng Android/iOS theo feature, Riverpod và GoRouter.
- Đăng nhập bệnh nhân bằng OTP theo contract của backend Phase 1.
- Access token chỉ giữ trong RAM; refresh token và mã thiết bị lưu bằng secure storage.
- Tự refresh khi API trả `401`, chỉ cho phép một refresh chạy tại cùng thời điểm và thử lại request đúng một lần.
- Phân biệt lỗi xác thực, validation, rate limit, mạng và timeout; giữ `requestId` để hỗ trợ tra log.
- Có profile chạy development/production và quality gate trong CI.

Các màn nghiệp vụ đặt lịch, hồ sơ khám, hóa đơn và thông báo thuộc các phase sau; màn Home hiện chỉ thể hiện khung điều hướng.

## Cấu hình

Ứng dụng nhận cấu hình lúc build bằng `--dart-define-from-file`. Không đặt secret, JWT hay OTP trong các file cấu hình.

Sao chép file mẫu phù hợp:

```powershell
Copy-Item config/dev.json.example config/dev.json
Copy-Item config/prod.json.example config/prod.json
```

- Android Emulator truy cập backend trên máy Windows qua `10.0.2.2`.
- Thiết bị Android/iPhone thật phải dùng IP LAN của máy chạy backend, ví dụ `http://192.168.1.20:4000/api/v1`.
- Production bắt buộc dùng URL HTTPS và kết thúc bằng `/api/v1`.
- Khung deep link dùng dạng `hospitalbooking://app/profile`; universal/app link theo domain thật sẽ cấu hình ở phase phát hành.

## Chạy local

Khởi động backend ở cổng `4000`, sau đó:

```powershell
cd mobile
flutter pub get
flutter run -t lib/main_dev.dart --dart-define-from-file=config/dev.json
```

Để kiểm thử OTP local, backend cần `OTP_DEBUG_ENABLED=true`. Mã OTP debug backend trả về chỉ được hiển thị khi app đang chạy debug.

## Kiểm tra chất lượng

```powershell
flutter analyze
flutter test
```

## Build production

Điền URL thật trong `config/prod.json` rồi chạy:

```powershell
flutter build appbundle -t lib/main_prod.dart --dart-define-from-file=config/prod.json
flutter build ipa -t lib/main_prod.dart --dart-define-from-file=config/prod.json
```

Build iOS cần macOS, Xcode và tài khoản ký ứng dụng.
