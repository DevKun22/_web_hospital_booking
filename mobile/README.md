# Hospital Booking Mobile

Ứng dụng Flutter dành cho bệnh nhân, dùng chung API `/api/v1` với hệ thống web.

## Phạm vi Phase 2

- Khung ứng dụng Android/iOS theo feature, Riverpod và GoRouter.
- Đăng nhập bệnh nhân bằng OTP theo contract của backend Phase 1.
- Access token chỉ giữ trong RAM; refresh token và mã thiết bị lưu bằng secure storage.
- Tự refresh khi API trả `401`, chỉ cho phép một refresh chạy tại cùng thời điểm và thử lại request đúng một lần.
- Phân biệt lỗi xác thực, validation, rate limit, mạng và timeout; giữ `requestId` để hỗ trợ tra log.
- Design system Calm Care với màu teal, trạng thái dùng chung và các component nền.
- Màn Welcome chỉ xuất hiện ở lần mở đầu tiên; người dùng có thể đặt lịch hoặc khám phá dịch vụ mà chưa cần tài khoản.
- Router tách route công khai và route bệnh nhân; sau OTP quay lại đúng tính năng đã yêu cầu.
- Có profile chạy development/production và quality gate trong CI.

Home đã đồng bộ banner, danh mục công khai và cho phép từng phần tiếp tục hoạt động khi một API tạm lỗi. Luồng đặt lịch, lịch hẹn, hồ sơ bệnh nhân, kết quả khám, đơn thuốc, hóa đơn và chatbot đã dùng chung API v1 với web.

Thông báo trong ứng dụng theo dõi đầy đủ vòng đời lịch khám: xác nhận, đổi lịch,
nhắc lịch, check-in, đang khám, hoàn thành, hủy và không đến; ngoài ra còn có
kết quả khám, đơn thuốc, hóa đơn, thanh toán và hoàn tiền. Mỗi thông báo chỉ
điều hướng tới route nằm trong danh sách cho phép và màn đích luôn tải trạng
thái mới nhất từ backend.

Android đã cấu hình Firebase Messaging và notification channel. iOS vẫn cần
`GoogleService-Info.plist`, APNs key/certificate và signing trên macOS trước khi
có thể xác nhận push ở môi trường phát hành.

Người dùng có thể mở **Thông báo → Tùy chọn thông báo** để bật/tắt push theo
nhóm. Các tùy chọn được lưu theo tài khoản trên backend; việc tắt một nhóm chỉ
ngừng push ra thiết bị, không xóa hoặc ẩn sự kiện trong hộp thư ứng dụng.

Chi tiết lịch sắp tới có checklist chuẩn bị giấy tờ, mã lịch, hồ sơ liên quan và
thời gian đến. Mục thẻ BHYT chỉ xuất hiện khi lịch có dùng BHYT. Dấu tích được
lưu cục bộ theo tài khoản và lịch hẹn, không tải giấy tờ hay dữ liệu sức khỏe lên
thiết bị/backend.

## Hạng mục đặt lịch cho người thân

- Tài khoản đã đăng nhập có thể tạo, sửa và lưu trữ hồ sơ người thân tại **Tài khoản → Hồ sơ người thân**.
- Tạo hồ sơ mới bắt buộc xác nhận quyền quản lý/đặt lịch. Hồ sơ đã lưu trữ không dùng cho lịch mới nhưng các lịch và kết quả cũ vẫn được giữ; tạo lại cùng CCCD sẽ khôi phục đúng hồ sơ cũ.
- Khi đặt lịch, người dùng chọn **Bản thân** hoặc một hồ sơ người thân. Backend luôn lấy thông tin người được khám từ hồ sơ thuộc chính tài khoản, không tin dữ liệu định danh do client tự gửi.
- `patientId` tiếp tục là chủ tài khoản để quản lý quyền xem, OTP, thông báo và liên hệ; `dependentProfileId` tách người thực sự đến khám. Danh sách lịch, hồ sơ khám, đơn thuốc và hóa đơn đều hiển thị rõ người được khám.
- Khách chưa đăng nhập vẫn đặt được cho bản thân; đặt cho người thân yêu cầu đăng nhập để kiểm tra ownership.

## Chatbot mobile

- Chatbot là route công khai `/chatbot`, dùng chung `/chatbot/settings` và `/chatbot/message` với web.
- Kết quả chuyên khoa, bác sĩ, gói khám và khung giờ được hiển thị thành thẻ thao tác; lựa chọn được gửi lại backend để backend tiếp tục quản lý hội thoại và booking draft.
- Hành động đặt lịch chuyển các giá trị chuyên khoa, bác sĩ, ngày và slot còn hợp lệ sang luồng booking; dữ liệu luôn được backend kiểm tra lại.
- Tin nhắn và booking draft chỉ giữ trong bộ nhớ ứng dụng ở mốc này, không ghi transcript chứa thông tin sức khỏe vào bộ nhớ thiết bị.
- Chatbot chỉ hỗ trợ thông tin và điều hướng, không thay thế chẩn đoán. Giao diện nhắc người dùng không nhập OTP, mật khẩu hoặc dữ liệu quá nhạy cảm.

## Quy tắc hiển thị thông báo xác thực

- Không có refresh token là trạng thái khách bình thường, không hiển thị lỗi.
- Lỗi gửi OTP chỉ hiển thị ở màn đăng nhập; lỗi xác minh OTP chỉ hiển thị ở màn nhập OTP.
- Lỗi mạng khi khôi phục phiên là lỗi chặn luồng và hiển thị tại Splash kèm hành động thử lại.
- Lỗi gửi/xác minh OTP không xuất hiện trên Trang chủ. Phiên hết hạn hoặc bị thu hồi vẫn được thông báo tại Trang chủ hoặc màn đăng nhập và cho phép người dùng đóng.
- Khi rời luồng đăng nhập, lỗi thao tác cũ phải được xóa để không xuất hiện lại ở lần truy cập sau.

## Cấu hình

Ứng dụng nhận cấu hình lúc build bằng `--dart-define-from-file`. Không đặt secret, JWT hay OTP trong các file cấu hình.

Sao chép file mẫu phù hợp:

```powershell
Copy-Item config/dev.json.example config/dev.json
Copy-Item config/prod.json.example config/prod.json
```

- Android Emulator truy cập backend trên máy Windows qua `10.0.2.2`.
- Thiết bị Android kết nối USB nên dùng `127.0.0.1` cùng `adb reverse`; cách này không bị hỏng khi IP Wi-Fi thay đổi.
- Thiết bị thật chạy không dây phải dùng IP LAN của máy chạy backend, ví dụ `http://192.168.1.20:4000/api/v1`.
- Production bắt buộc dùng URL HTTPS và kết thúc bằng `/api/v1`.
- Khung deep link dùng dạng `hospitalbooking://app/profile`; universal/app link theo domain thật sẽ cấu hình ở phase phát hành.

## Chạy local

Khởi động backend ở cổng `4000`, sau đó:

```powershell
cd mobile
flutter pub get
.\tool\run_android_device.ps1
```

Script kiểm tra backend, tự chọn thiết bị USB duy nhất, tạo lại `adb reverse tcp:4000 tcp:4000`, xác nhận tunnel rồi mới khởi động app. Phải dùng lại script sau khi rút/cắm USB, khởi động lại điện thoại hoặc mở một phiên `flutter run` mới; không dùng lệnh `flutter run` trực tiếp với URL `127.0.0.1` vì lệnh đó không chuẩn bị tunnel.

Để đo hiệu năng gần production:

```powershell
.\tool\run_android_device.ps1 -Mode profile
```

Nếu có nhiều thiết bị, truyền thêm `-DeviceId <serial>`. Khi cần chạy không dây, đổi `API_BASE_URL` trong `config/dev.json` sang IP LAN rồi dùng trực tiếp `flutter run` thay vì script USB.

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
