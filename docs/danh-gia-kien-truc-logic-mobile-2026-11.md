# Đánh giá kiến trúc logic ứng dụng mobile (11/2026)

**Phạm vi:** `mobile/` (Flutter) tại `main` ngày 08/11/2026: 148 tệp mã, 29.151 dòng, 70 tệp test.
**Cách làm:** đọc mã các thành phần cốt lõi (mạng, phiên, định tuyến, đồng bộ, bộ điều khiển), đo cấu trúc bằng lệnh, và **dựng thí nghiệm** để kiểm chứng những điểm nghi ngờ thay vì suy luận. Mức độ chắc chắn của từng phát hiện được ghi rõ.

## 1. Kết luận

Kiến trúc nền tảng đúng hướng (Riverpod, phân lớp theo tính năng, phiên được bảo vệ cẩn thận). Vấn đề nghiêm trọng duy nhất nằm ở **bộ chặn làm mới phiên 401**: đã tái hiện được lỗi treo vĩnh viễn và làm mới thừa, và đã sửa cùng test. Phần còn lại là nợ kỹ thuật về cấu trúc (phụ thuộc ngược, tệp quá lớn) và thiếu lớp bắt lỗi toàn cục; đây là việc nên làm dần, không có rủi ro khẩn cấp.

## 2. Điểm mạnh đã xác nhận (để cân bằng phản biện)

- **Làm mới phiên gộp một lần chạy** (`SessionRefreshCoordinator.refresh`): nhiều yêu cầu cùng cần làm mới thì chia sẻ một lần gọi.
- **Không lẫn dữ liệu giữa hai người dùng:** mọi bộ điều khiển dữ liệu theo dõi `user.id` và đánh số phiên bản yêu cầu, nên yêu cầu của người cũ không ghi đè dữ liệu người mới.
- **Lưu token đúng chỗ:** refresh token trong secure storage, access token chỉ trong bộ nhớ; nhật ký mạng chỉ ghi đường dẫn, không ghi token.
- **Định tuyến là hàm thuần** (`resolveAppRedirect`) nên dễ kiểm thử; đích mở từ thông báo đẩy nằm trong danh sách cho phép.
- **Phụ thuộc được tiêm qua provider**, nên test thay thế được kho lưu token, adapter mạng.

## 3. Phát hiện, phản biện và giải pháp

| # | Phát hiện | Mức độ | Bằng chứng | Trạng thái |
|---|---|---|---|---|
| 1 | Yêu cầu gọi lại sau khi làm mới phiên mà thất bại (404, 409, 422...) **treo vĩnh viễn** | Cao | Thí nghiệm: hết thời gian sau 5 giây | **Đã sửa** |
| 2 | N yêu cầu cùng bị 401 gây **N lần làm mới** (mỗi lần xoay refresh token) | Trung bình | Thí nghiệm: 3 yêu cầu thành 3 lần làm mới | **Đã sửa** |
| 3 | Lỗi thật của lần gọi lại bị **thay bằng 401 cũ** (`catch (_)`) | Trung bình | Đọc mã; test sau sửa đòi lỗi 404 gốc | **Đã sửa** |
| 4 | Không có bắt lỗi toàn cục và không báo cáo sự cố; 40 chỗ `catch (_)` nuốt lỗi | Trung bình | Tìm kiếm mã: không có `FlutterError.onError` hay `PlatformDispatcher` | **Đã làm bộ bắt lỗi toàn cục tối thiểu** và rà 38 chỗ `catch (_)`: giữ hành vi, thêm `logSwallowedError` (chỉ chế độ phát triển, chỉ ghi nơi phát sinh và loại lỗi) |
| 5 | `core/` phụ thuộc ngược vào `features/` (3 tệp) | Trung bình | `session_refresh_coordinator`, `app_providers`, `patient_data_sync_coordinator` | **Đã sửa** |
| 6 | Tệp trình bày quá lớn: 9 tệp trên 600 dòng, lớn nhất 2.010; trình bày chiếm 59% mã | Trung bình (bảo trì) | Đếm dòng | **Đã sửa một phần**: `home_screen` 2.010 → 259 dòng, `booking_start_screen` 1.088 → 331 dòng; CI cảnh báo tệp trên 800 dòng ; `appointment_detail_screen` 865 → 189, `booking_patient_screen` 887 → 786, hiện không còn tệp nào trên 800 dòng |
| 7 | Lớp `domain` phụ thuộc Flutter (`material.dart`) ở 4 tệp | Thấp | Tìm kiếm mã | **Đã sửa** |
| 8 | Màn hình gọi thẳng lớp `data` (3 chỗ), bỏ qua `application` | Thấp | Tìm kiếm mã | **Đã sửa** phần tham chiếu kiểu (`PushPermissionStatus` sang domain); còn lại chỉ là kiểu dữ liệu, chấp nhận |
| 9 | URL thanh toán chỉ kiểm tra `https`, không kiểm tra tên miền | Thấp | `invoice_detail_screen.dart` | Chấp nhận |
| 10 | Lớp mạng và phiên (cốt lõi) trước đó **không có test** | Trung bình | Không test nào gọi `createAuthenticatedDio` | **Đã bổ sung 5 test** |

### 3.1 Bộ chặn 401 (phát hiện 1 đến 3, 10): đã sửa

**Nguyên nhân gốc.** Bộ chặn dùng `QueuedInterceptorsWrapper` (xử lý lỗi lần lượt từng cái) nhưng gọi lại yêu cầu qua chính `dio`. Khi yêu cầu gọi lại trả lỗi, lỗi đó phải chờ hàng đợi đang bị lần xử lý 401 đầu giữ, trong khi lần đầu đang chờ chính yêu cầu gọi lại: hai bên chờ nhau. Hậu quả thực tế: sau khi access token hết hạn (15 phút), yêu cầu đầu tiên mà máy chủ trả lỗi nghiệp vụ (ví dụ mở lịch đã hủy, hủy lịch 409) sẽ quay vô hạn.

**Phản biện các hướng sửa.**

| Hướng | Ưu | Nhược | Chọn |
|---|---|---|---|
| Giữ hàng đợi, gọi lại bằng Dio riêng | Sửa nhỏ | Vẫn tuần tự hóa mọi xử lý lỗi; thêm một Dio phải đồng bộ cấu hình | Không |
| **Bỏ hàng đợi, giữ làm mới gộp một lần; dùng token hiện tại nếu phiên đã được làm mới** | Hết treo, không làm mới thừa, ít mã | Yêu cầu gửi trong lúc làm mới vẫn mang token cũ và nhận 401 rồi được gọi lại | **Chọn** |
| Làm mới chủ động trước khi hết hạn (đọc `exp` của token) | Bớt một vòng 401 | Phụ thuộc đồng hồ máy, phải giải mã token; thêm trường hợp biên | Làm sau nếu đo thấy đáng giá |

**Kết quả.** Thay bằng `InterceptorsWrapper`; yêu cầu bị 401 vì mang token cũ khi phiên đã làm mới thì dùng luôn token hiện tại; lỗi của lần gọi lại được trả nguyên; nếu làm mới thất bại thì trả 401 gốc. 5 test mới trong `mobile/test/authenticated_dio_refresh_test.dart`, trong đó 2 test đã **thất bại trên mã cũ** và đạt trên mã mới.

### 3.2 Bắt lỗi toàn cục (phát hiện 4): đã làm phần tối thiểu

Lỗi bất đồng bộ không bắt được (ví dụ `unawaited(handleAppResumed())`, `microtask(load)` gặp lỗi phân tích dữ liệu không phải `ApiException`) hiện không có nơi nhận, nên ở bản phát hành chúng im lặng và không ai biết.

- **Đã làm:** `installGlobalErrorHandlers` (`mobile/lib/core/errors/global_error_handler.dart`, gắn ở `bootstrap`) chặn `FlutterError.onError` và `PlatformDispatcher.instance.onError`; chỉ ghi loại lỗi và nơi phát sinh, không ghi thông điệp lỗi nên không lộ dữ liệu cá nhân; lỗi bất đồng bộ không còn làm thoát ứng dụng ở bản phát hành. Có 2 test, trong đó kiểm tra thông điệp chứa số điện thoại không xuất hiện trong nhật ký.
- **Phản biện về Crashlytics:** dự án đã có `firebase_core`, nên thêm báo cáo sự cố là dễ, nhưng đây là ứng dụng y tế: stack trace và thông điệp lỗi có thể chứa dữ liệu cá nhân. Nếu thêm phải tắt mặc định, lọc nội dung, và nêu trong chính sách quyền riêng tư. Với đồ án, bản nhật ký cục bộ là đủ; Crashlytics để sau.
- **Rà `catch (_)`:** đã rà toàn bộ. Tất cả đều là bỏ qua có chủ ý (lưu cục bộ hỏng, nền tảng không hỗ trợ, tác vụ phụ như đánh dấu đã đọc), nên giữ nguyên hành vi và chỉ thêm `logSwallowedError` (`core/errors/swallowed_error.dart`) để lỗi bị nuốt còn dấu vết khi gỡ lỗi. Còn đúng một chỗ không ghi: nhánh làm mới phiên thất bại trong `dio_factory`, vì lỗi đó đã được `SessionRefreshCoordinator` xử lý và trả 401 gốc.

### 3.3 Phụ thuộc ngược (phát hiện 5): đã sửa

`core/` đáng lẽ là hạ tầng không biết gì về tính năng, nhưng 3 tệp import `features/`.

| Tệp | Phụ thuộc | Cách gỡ |
|---|---|---|
| `core/network/session_refresh_coordinator.dart` | `AuthSession` | Chuyển `AuthSession` sang `core/network` hoặc để `refresh()` trả về cặp token thuần |
| `core/providers/app_providers.dart` | `AuthRepository` | Chuyển `authRepositoryProvider` về `features/auth/application` |
| `core/sync/patient_data_sync_coordinator.dart` | 8 bộ điều khiển | Chuyển sang `app/` (nơi ráp ứng dụng) |

**Kết quả:** `refresh()` trả `RefreshedSession` (token và dữ liệu thô) để hạ tầng không biết `AuthSession`; `authRepositoryProvider` về `features/auth/application/auth_providers.dart`; bộ đồng bộ về `app/sync/`; theme về `core/theme/`; biểu diễn giao diện (biểu tượng, màu, tông) của domain về các tiện ích mở rộng ở `presentation`. Test `architecture_boundaries_test.dart` giữ ranh giới này trong CI.

Phản biện: đây là refactor thuần, không đổi hành vi; rủi ro thấp vì chỉ đổi đường dẫn import và có 178 test bảo vệ. Lợi ích rõ nhất là chặn vòng phụ thuộc khi dự án lớn thêm.

### 3.4 Tệp trình bày quá lớn (phát hiện 6): đề xuất

`home_screen.dart` dài 2.010 dòng, `booking_start_screen.dart` 1.088 dòng.

- **Không nên** tách hàng loạt trong một lần: dễ gây lỗi giao diện khó phát hiện, và không có thước đo lợi ích tức thời.
- **Nên** tách dần khi đụng tới từng màn hình, mỗi lần một vùng thành widget riêng kèm widget test, và thêm kiểm tra tự động trong CI: cảnh báo tệp trên 800 dòng (bằng một script đếm dòng ngắn) để ngăn tệp mới phình ra.

### 3.5 Các điểm nhỏ (phát hiện 7 đến 9)

- **Domain dùng `material.dart`:** chuyển `IconData` và `Color` thành phần mở rộng ở lớp trình bày để domain thuần Dart. Ưu tiên thấp.
- **Màn hình gọi `data`:** ba chỗ qua provider/controller. Ưu tiên thấp.
- **URL thanh toán:** máy chủ là nguồn đáng tin và đã bắt buộc `https`. Thêm danh sách tên miền cho phép tăng phòng thủ nhưng phải sửa khi đổi từ sandbox sang production, nên **chấp nhận rủi ro** hiện tại, ghi nhận trong tài liệu.

## 4. Lộ trình đề xuất

| Thứ tự | Việc | Công sức | Ghi chú |
|---|---|---|---|
| 1 | Bộ chặn 401 và test | Xong | PR riêng |
| 2 | Bắt lỗi toàn cục tối thiểu | Xong | Không thêm thư viện |
| 3 | Gỡ phụ thuộc ngược `core` sang `features` | Xong | Có test ranh giới |
| 4 | Cảnh báo tệp lớn trong CI, tách `home_screen` dần | Xong: không còn tệp trên 800 dòng, CI cảnh báo khi vượt | Màn hình 600 đến 800 dòng tách dần khi đụng tới |
| 5 | Làm mới token chủ động trước khi hết hạn | Nhỏ | Chỉ khi đo thấy vòng 401 gây chậm |

## 5. Tái phân bổ cấu trúc (đợt 2)

- **Mô hình danh mục đặt sai chỗ:** `HomeDepartment`, `HomeDoctor`, `HomeDoctorSlot`, `HomeMedicalPackage` nằm trong `features/home/domain` nhưng được `catalog` và `support` dùng chéo. Đã chuyển sang `features/catalog/domain/catalog_entities.dart` và đổi tên thành `Catalog*`; `home` giờ phụ thuộc `catalog` (đúng chiều), không còn `catalog` phụ thuộc `home`.
- **Bộ đọc JSON chịu lỗi** (`_string`, `_map`, ...) chuyển thành `core/network/json_readers.dart` dùng chung.
- **Trùng lặp:** `_shortTime`, `_displayDate`, `_formatApiDate` lặp ở hai màn hình đặt lịch, gom vào `booking_date_format.dart`.
- **Tách màn hình lớn** theo vùng giao diện: `home/presentation/widgets/{home_chrome, home_search_sheet, home_hero_carousel, home_doctor_section, home_catalog_sections}.dart` và `booking/presentation/widgets/booking_selection_widgets.dart`.
- **Còn ba chiều phụ thuộc chéo chấp nhận được:** `chatbot_entry_context` (kiểu điểm vào chatbot) dùng từ đặt lịch và gói khám; `auth` gọi cổng push để hủy token khi đăng xuất; `home` dùng thẻ lịch hẹn của `appointments`.
