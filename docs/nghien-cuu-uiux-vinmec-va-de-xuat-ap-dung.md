# NGHIÊN CỨU UI/UX MYVINMEC VÀ ĐỀ XUẤT ÁP DỤNG CHO HOSPITAL BOOKING MOBILE

**Ứng dụng tham khảo:** MyVinmec `v3.0.3.0`
**Thiết bị khảo sát:** Android 15, điện thoại thật
**Ngày khảo sát:** 14/10/2026
**Mục tiêu:** Học pattern UI/UX và ý tưởng tính năng, không sao chép nhận diện thương hiệu hoặc thiết kế nguyên bản

---

## 1. Phạm vi khảo sát

Các màn và trạng thái đã được kiểm tra trực tiếp:

- Trang chủ ở trạng thái đầu trang và sau khi cuộn.
- Hero/banner, ưu đãi, tìm kiếm và danh sách dịch vụ nhanh.
- Bottom navigation và nút đặt lịch trung tâm.
- Form đặt lịch ban đầu.
- Danh sách lịch hẹn ở trạng thái rỗng.
- Hồ sơ sức khỏe ở trạng thái chưa liên kết.
- Thông báo ở trạng thái rỗng.
- Tài khoản, cài đặt và điều khoản.
- Kho ưu đãi ở trạng thái rỗng.
- Danh sách dịch vụ y tế và trang chi tiết dịch vụ.
- Các tiện ích trong mục “Tất cả dịch vụ”.
- Bottom sheet Liên hệ và danh bạ gọi từng cơ sở.
- Đơn thuốc, nhắc uống thuốc, tạm ứng viện phí và theo dõi nội trú ở trạng thái chưa liên kết hồ sơ.
- Danh mục giá & quyền lợi, sổ tiêm và tham vấn tâm lý từ xa ở bước đầu.
- Cộng đồng hỏi đáp, bài viết công khai và CTA cố định ở trang nội dung.
- Quyền truy cập dữ liệu và tài liệu hỏi đáp trong khu vực Tài khoản.
- Trợ lý sức khỏe AI MIA, toàn bộ onboarding lần đầu và màn tổng quan sau onboarding.

Không thực hiện đặt lịch, gửi yêu cầu tư vấn, tạo hồ sơ, thay đổi tài khoản, thanh toán hoặc giao dịch khác. Các dữ liệu định danh nhìn thấy trong quá trình khảo sát không được lưu vào báo cáo.

Kết quả này chỉ phản ánh các trạng thái có thể truy cập trên tài khoản/thiết bị tại thời điểm khảo sát. Chưa đánh giá được UI của lịch hẹn, hồ sơ y tế và thông báo khi có dữ liệu thực tế.

---

## 2. Tóm tắt nhận định

MyVinmec xây dựng trải nghiệm theo mô hình **health-service super app**: Trang chủ vừa là dashboard y tế, vừa là cửa ngõ dịch vụ, nội dung sức khỏe, ưu đãi, hỗ trợ và thương mại dịch vụ. Điểm mạnh nhất không nằm ở từng màn riêng lẻ mà ở cách đưa nhiều chức năng đến gần người dùng bằng service hub, CTA rõ và bottom navigation có hành động đặt lịch nổi bật.

Khảo sát sâu cho thấy sản phẩm thực tế được tổ chức thành ba lớp:

1. **Công khai:** nội dung, danh bạ liên hệ, tìm kiếm, dịch vụ và hỏi đáp cộng đồng.
2. **Giao dịch:** đặt lịch, tư vấn từ xa, yêu cầu hỗ trợ và thanh toán.
3. **Dữ liệu y tế:** đơn thuốc, nhắc thuốc, viện phí, nội trú và sổ tiêm; phần lớn chỉ có giá trị sau khi tài khoản được liên kết với hồ sơ bệnh viện.

Phân lớp này quan trọng hơn số lượng icon. Với Hospital Booking, mỗi tính năng mới phải được đặt đúng lớp để xác định yêu cầu đăng nhập, quyền dữ liệu, consent, trạng thái loading/error và backend ownership trước khi làm UI.

App Hospital Booking hiện tại đã có nền tảng tốt hơn ở một số điểm quan trọng: luồng đặt lịch nhiều bước rõ ràng, dữ liệu bác sĩ/chuyên khoa/gói khám đồng bộ trực tiếp từ backend, chatbot dùng chung domain, navigation stack đã xử lý Back đúng, thông báo phân biệt lịch sử với trạng thái hiện tại, và không phải mở WebView cho các chức năng cốt lõi.

Hướng phù hợp không phải biến app hiện tại thành bản sao MyVinmec. Nên học ba nhóm pattern:

1. **Khả năng khám phá:** service hub, tìm kiếm toàn cục và CTA theo ngữ cảnh.
2. **Trạng thái rỗng có hành động:** không chỉ báo “chưa có dữ liệu” mà hướng dẫn bước tiếp theo.
3. **Tổ chức tính năng:** nhóm chức năng theo nhu cầu bệnh nhân và ưu tiên hành động thường dùng.

Các tính năng như sổ tiêm, người thân, nhắc uống thuốc, hỗ trợ yêu cầu và thanh toán viện phí chỉ nên thêm khi domain/backend tương ứng đã được thiết kế, không dựng UI giả hoặc nhồi toàn bộ vào MVP.

---

## 3. Phân tích Trang chủ

### 3.1 Cấu trúc quan sát được

Trang chủ MyVinmec có thứ tự thị giác:

1. Header màu thương hiệu với tên app và tagline.
2. Shortcut ưu đãi và tìm kiếm ở góc phải.
3. Hero/banner quảng cáo khổ lớn.
4. Service hub 12 tiện ích nằm trong card trắng nổi trên nền header.
5. Khu “Dịch vụ mới”.
6. Câu hỏi sàng lọc sức khỏe.
7. Thông báo quan trọng.
8. Danh mục tin tức và danh sách tin mới nhất.
9. Bottom navigation cố định.

Khi cuộn, service hub được rút thành một dải icon ngang bám phía trên. Cách này giữ shortcut luôn trong tầm tay nhưng cũng làm màn hình dày thông tin hơn.

### 3.2 Điểm tốt

- Người dùng nhìn thấy ngay hành động chính và hệ sinh thái dịch vụ.
- Hero có vai trò truyền thông rõ, không lẫn với dữ liệu cá nhân.
- Icon đồng nhất giúp quét nhanh.
- Nhãn “Mới” dùng màu cam tạo điểm nhấn trên nền xanh.
- Nội dung phía dưới chia section bằng tiêu đề lớn, dễ nhận diện khi cuộn.
- Bottom navigation vẫn hiển thị trong hầu hết màn thuộc shell.

### 3.3 Hạn chế

- 12 shortcut cùng lúc tạo tải nhận thức cao; một số nhãn dài phải xuống nhiều dòng.
- Nhiều chức năng chuyên biệt cạnh tranh sự chú ý với hành động cốt lõi.
- Dải shortcut sticky sau khi cuộn chỉ còn icon, làm giảm khả năng hiểu đối với người dùng mới.
- Banner và service hub chiếm phần lớn màn đầu; thông tin lịch sắp tới không được ưu tiên nếu người dùng đã có lịch.

### 3.4 Đề xuất cho app hiện tại

Giữ hero carousel hiện có nhưng tổ chức Trang chủ theo ưu tiên bệnh nhân:

```text
App bar: thương hiệu + thông báo + hồ sơ
Tìm kiếm toàn cục
Hero/banner
Lịch khám sắp tới (nếu có)
Service hub 6–8 mục chính + “Tất cả”
Trợ lý đặt lịch/chatbot
Gói khám nổi bật
Chuyên khoa phổ biến
Bác sĩ tiêu biểu
FAQ/hướng dẫn
Hotline/cấp cứu
Bottom navigation
```

Không nên đưa 12–16 tiện ích lên màn đầu. Service hub chỉ nên gồm chức năng có tần suất cao: đặt lịch, lịch khám, hồ sơ, đơn thuốc, hóa đơn, gói khám, trợ lý và “Tất cả”.

---

## 4. Bottom navigation và điều hướng

### 4.1 Pattern của MyVinmec

Thanh điều hướng gồm năm mục:

- Trang chủ.
- Hồ sơ.
- Đặt lịch.
- Thông báo.
- Tài khoản.

“Đặt lịch” nằm giữa, có vòng tròn màu xanh lớn nổi khỏi thanh. Đây là primary action ở cấp ứng dụng.

### 4.2 So sánh với app hiện tại

App Hospital Booking đang dùng:

- Trang chủ.
- Lịch khám.
- Đặt khám.
- Trợ lý.
- Tài khoản.

Cấu trúc hiện tại phù hợp domain hơn vì chatbot là chức năng đã có, còn hồ sơ y tế có thể đi từ Tài khoản/Trang chủ. Nút Đặt khám đã được nhấn mạnh ở trung tâm nên không cần đổi cấu trúc chỉ để giống MyVinmec.

### 4.3 Điều nên áp dụng

- Giữ nút Đặt khám trung tâm là primary action.
- Badge thông báo nên xuất hiện ở icon phù hợp nhưng không dùng animation liên tục.
- Mỗi tab phải giữ state và vị trí cuộn khi chuyển tab.
- Màn chi tiết phải được push lên stack; Back trở về đúng màn nguồn.
- Không đưa quá nhiều màn con thành bottom tab.

---

## 5. Service hub và inventory tính năng

Mục “Tất cả dịch vụ” của MyVinmec mở bằng bottom sheet lớn, giữ ngữ cảnh Trang chủ ở nền. Các chức năng quan sát được:

| Nhóm | Tính năng MyVinmec | App hiện tại | Khuyến nghị |
|---|---|---|---|
| Khám chữa bệnh | Lịch hẹn | Đã có | Giữ và cải thiện empty state |
| Hỗ trợ | Liên hệ | Chưa có màn riêng | Dùng site settings/hotline, ưu tiên sớm |
| Dịch vụ | Dịch vụ y tế | Có gói khám/chuyên khoa | Gom thành catalog rõ hơn |
| Tiêm chủng | Sổ tiêm | Chưa có domain | Không thêm trong MVP |
| Điều trị | Đơn thuốc | Đã có | Giữ; có thể mở rộng nhắc uống thuốc |
| Chi phí | Danh mục giá & quyền lợi | Có gói/hóa đơn/BHYT rời rạc | Tạo trang hướng dẫn chi phí/BHYT |
| Doanh nghiệp | Quyền lợi CBNV | Không có | Không phù hợp phạm vi hiện tại |
| Tư vấn | Cộng đồng hỏi đáp bác sĩ | Có chatbot + FAQ | Ưu tiên chatbot, không dựng cộng đồng mới |
| Mẹ và bé | Cẩm nang làm mẹ | Chưa có content domain riêng | Có thể dùng CMS/news về sau |
| Tuân thủ điều trị | Nhắc lịch uống thuốc | Chưa có | Tính năng mobile riêng tiềm năng |
| Thanh toán | Tạm ứng viện phí | Payment mobile đang tắt | Chưa triển khai trước provider production |
| Telehealth | Tham vấn tâm lý từ xa | Chưa có | Ngoài phạm vi hiện tại |
| Nội trú | Theo dõi nội trú | Chưa có inpatient domain | Không triển khai lúc này |
| Ưu đãi | Mã ưu đãi | Chưa có | Chỉ thêm khi có campaign/promotion domain |

Bottom sheet “Tất cả” là pattern có thể áp dụng ngay cho các tính năng đã tồn tại. Nó cho phép Trang chủ gọn hơn mà không làm người dùng mất khả năng khám phá.

Khảo sát sâu cũng cho thấy các tiện ích không độc lập hoàn toàn:

- Đơn thuốc, nhắc uống thuốc, tạm ứng viện phí và theo dõi nội trú cùng bị chặn ở trạng thái chưa có hồ sơ sức khỏe liên kết.
- Nhắc uống thuốc không cho tạo thủ công ngay từ empty state mà dẫn người dùng về nguồn dữ liệu đơn thuốc.
- Sổ tiêm có onboarding riêng nhưng xuất hiện khoảng trắng vài giây trước khi nội dung tải xong; thiếu loading indicator làm người dùng dễ hiểu nhầm là lỗi.
- Tham vấn tâm lý từ xa dùng flow ba bước `Chọn khách hàng -> Chọn bác sĩ -> Thanh toán`, nhưng đưa nhiều thông tin định danh lên ngay màn đầu.
- Danh mục giá & quyền lợi là một form kiểm tra theo khách hàng/cơ sở, không chỉ là bảng giá công khai.

Điều nên học là **dependency-aware UX**: nếu một tiện ích cần hồ sơ y tế, empty state phải giải thích điều kiện, lợi ích và đường đi liên kết hồ sơ. Không nên nhân bản bốn màn “không có dữ liệu” gần như giống nhau; app hiện tại có thể dùng một component chuẩn với nội dung/CTA theo domain.

---

## 6. Luồng đặt lịch

### 6.1 Cấu trúc MyVinmec

Màn đặt lịch bắt đầu bằng:

- Chọn khách hàng: bản thân hoặc thêm người khác.
- Họ tên, ngày sinh, số điện thoại và giới tính.
- Tùy chọn quyền lợi nhân viên/người thân.
- Tùy chọn người nước ngoài.
- Chọn cơ sở y tế.
- CTA đặt hẹn chỉ được bật khi thông tin hợp lệ.

### 6.2 Điểm tốt

- Hỗ trợ nhiều người được khám ngay từ đầu.
- Chọn “Tôi” giúp giảm nhập lại dữ liệu.
- Trạng thái selected rõ bằng viền, check mark và nhãn.
- CTA disabled cho biết form chưa đủ điều kiện.
- Có các nhánh dành cho nhóm người dùng đặc biệt.

### 6.3 Hạn chế

- Form dài trên một màn, người dùng khó biết còn bao nhiêu bước.
- Thông tin người đặt và thông tin lịch hẹn xuất hiện cùng trang tạo cảm giác nặng.
- Nếu app chỉ có một cơ sở, bắt chọn địa điểm là thao tác dư.

### 6.4 Áp dụng cho app hiện tại

Không đổi flow nhiều bước hiện tại thành một form dài. Nên giữ flow hiện tại vì rõ hơn:

```text
Chọn dịch vụ/bác sĩ/gói
-> chọn ngày và slot
-> chọn người khám/nhập thông tin
-> kiểm tra lại
-> OTP
-> thành công
```

Điểm nên bổ sung sau:

- Card “Tôi” để tự điền từ Patient Profile.
- “Thêm người thân” chỉ sau khi có domain dependent profile và ownership rõ.
- Step indicator ngắn gọn.
- Review summary trước khi gửi OTP.
- Chỉ hiển thị field theo ngữ cảnh; không đưa field không liên quan vào mọi booking.

---

## 7. Lịch hẹn và empty state

Màn lịch hẹn rỗng của MyVinmec không dừng ở thông báo “chưa có lịch”. Nó gồm:

- Illustration.
- CTA “Đặt hẹn”.
- Nút `+` trên app bar.
- Hướng dẫn xử lý khi người dùng đã nhận SMS nhưng chưa thấy lịch.
- Link kiểm tra liên kết hồ sơ, thông tin cá nhân và hotline.

Đây là pattern rất đáng áp dụng. Empty state của app hiện tại nên tùy theo nguyên nhân:

| Trạng thái | Nội dung nên hiển thị | CTA |
|---|---|---|
| Chưa có lịch | Giải thích ngắn và lợi ích đặt lịch | Đặt lịch ngay |
| Chưa đăng nhập | Dữ liệu lịch cần phiên bệnh nhân | Đăng nhập |
| Lỗi mạng | Không kết nối được backend | Thử lại |
| Có lịch trên Web nhưng chưa thấy | Hướng dẫn kiểm tra số điện thoại/tài khoản | Làm mới / Liên hệ |
| Filter không có kết quả | Không có lịch trong nhóm trạng thái này | Xóa bộ lọc |

Không nên dùng cùng một empty state cho mọi nguyên nhân.

---

## 8. Hồ sơ sức khỏe

Khi chưa có hồ sơ, MyVinmec chia người dùng thành hai nhánh:

- Đã từng khám: kết nối hồ sơ có sẵn.
- Chưa từng khám: tạo hồ sơ mới.

Đây là cách biến empty state thành onboarding theo ngữ cảnh. Với hệ thống hiện tại, hồ sơ bệnh nhân được tạo và liên kết qua patient account/session nên không nên sao chép nguyên luồng. Có thể học cách diễn đạt:

- Nếu chưa có medical record: giải thích hồ sơ sẽ xuất hiện sau khi bệnh viện publish kết quả.
- Nếu thông tin cá nhân chưa đầy đủ: CTA hoàn thiện hồ sơ.
- Nếu người dùng cho rằng thiếu dữ liệu: CTA làm mới và hướng dẫn liên hệ.

Không nên cho người dùng tự “tạo medical record”; medical record phải tiếp tục do nghiệp vụ khám tạo và backend kiểm soát.

---

## 9. Thông báo

### 9.1 Pattern quan sát được

- Tiêu đề lớn và subtitle giải thích phạm vi: lịch hẹn, ưu đãi và nội dung khác.
- Menu ba chấm cho hành động phụ.
- Empty illustration ở trung tâm màn hình.
- Bottom navigation giữ nguyên.

### 9.2 So sánh với app hiện tại

App hiện tại đã mạnh hơn ở lớp nghiệp vụ:

- Inbox là nguồn dữ liệu chính.
- Có unread/read-all.
- Có FCM push và đăng ký token theo session.
- Deep link theo allowlist.
- Phân biệt nội dung thông báo lịch sử với trạng thái entity mới nhất.

### 9.3 Cải thiện đề xuất

- Empty state nên có CTA “Xem lịch khám” hoặc “Kiểm tra quyền thông báo”, không chỉ có illustration.
- Khi push bị tắt, hiển thị card hướng dẫn ngay trong inbox nhưng không che danh sách.
- Cho filter nhẹ theo “Tất cả / Lịch khám / Kết quả & đơn thuốc / Hóa đơn” khi số lượng tăng.
- Menu ba chấm chỉ nên chứa hành động thật sự có ích như “Đánh dấu tất cả đã đọc” và “Cài đặt thông báo”.
- Không trộn tin marketing vào notification nghiệp vụ nếu chưa có preference/consent.

---

## 10. Tài khoản và cài đặt

MyVinmec dùng header minh họa màu thương hiệu, avatar lớn và danh sách theo nhóm:

- Quản lý yêu cầu và ưu đãi.
- Cài đặt: mật khẩu, ngôn ngữ, bảo mật.
- Điều khoản và chính sách dữ liệu.
- Quyền truy cập dữ liệu, hỏi đáp, chia sẻ ứng dụng.
- Đăng xuất và phiên bản app.

Điểm nên áp dụng:

- Chia Profile thành các section có tiêu đề thay vì một danh sách dài.
- Hiển thị trạng thái hiện tại ở bên phải: ngôn ngữ, quyền thông báo, mức hoàn thiện hồ sơ.
- Đưa phiên bản app xuống cuối trang để hỗ trợ debug/support.
- Tách “Thông tin bệnh nhân” khỏi “Cài đặt ứng dụng” và “Pháp lý & hỗ trợ”.
- Đăng xuất vẫn cần confirmation và cleanup session như hiện tại.

Không nên dùng email/số điện thoại làm tiêu đề nổi bật duy nhất; ưu tiên tên hiển thị và che/mask dữ liệu định danh phụ.

Màn “Quyền truy cập dữ liệu” là một điểm tham khảo quan trọng: ứng dụng giải thích mục đích xử lý dữ liệu y tế và liệt kê từng nhóm consent. Tuy nhiên, trạng thái checkbox bắt buộc/tùy chọn chưa thật dễ phân biệt và nút chỉnh sửa dạng icon không có nhãn. Nếu áp dụng cho Hospital Booking:

- Phân biệt rõ consent bắt buộc để cung cấp dịch vụ và consent tùy chọn.
- Ghi thời điểm, phiên bản chính sách và nguồn thay đổi ở backend.
- Không dùng một toggle chung cho dữ liệu y tế, marketing và analytics.
- Hành động sửa quyền phải có nhãn, màn xác nhận và giải thích hệ quả.

Mục “Hỏi đáp về ứng dụng” tải một tài liệu PDF cũ ngay trong app. Nó mất vài giây với màn trắng, nội dung mang số phiên bản khác app đang chạy và khó tìm kiếm trên điện thoại. Hospital Booking nên dùng FAQ có cấu trúc từ backend/CMS, search được và cập nhật độc lập; PDF chỉ nên là tài liệu pháp lý hoặc bản tải xuống.

---

## 11. Dịch vụ y tế, gói khám và tư vấn

Danh sách Dịch vụ y tế của MyVinmec gồm:

- Search field.
- Card danh mục có icon, tiêu đề và mô tả rút gọn.
- CTA phụ “Nhận tư vấn”.
- CTA chính “Xem chi tiết”.
- Shortcut “Đơn hàng”.

Pattern hai CTA phù hợp với app hiện tại:

- `Xem chi tiết` → trang gói khám/chuyên khoa.
- `Hỏi trợ lý` → chatbot với context gói/chuyên khoa đã chọn.
- `Đặt khám` → chỉ xuất hiện khi đã đủ dữ liệu để đi thẳng vào booking.

Không nên đặt cả ba CTA lớn trên mọi card. Có thể để hai CTA trên card và CTA đặt lịch ở trang chi tiết.

Điểm không nên sao chép là mở trang dịch vụ quan trọng bằng WebView. Trong lần khảo sát, WebView hiển thị đồng thời bottom sheet chọn cơ sở và cookie banner, tạo hai lớp modal cạnh tranh. App hiện tại nên tiếp tục dùng màn Flutter native và backend API cho luồng cốt lõi.

### 11.1 Contact hub

Mục Liên hệ mở bằng bottom sheet trên Trang chủ, gồm ba lớp hành động: đặt hẹn, gửi yêu cầu hỗ trợ và gọi trực tiếp từng cơ sở. Pattern giữ ngữ cảnh này phù hợp với Hospital Booking, nhưng cần:

- Hiện tên cơ sở, trạng thái đang mở/đóng và giờ làm việc.
- Xác nhận trước khi gọi để tránh chạm nhầm.
- Phân biệt hotline thường và cấp cứu bằng màu/ngôn từ, không dùng chung CTA.
- Không đưa “Gửi yêu cầu” vào cùng luồng nếu backend chưa có support-ticket lifecycle.

### 11.2 Cộng đồng và nội dung sức khỏe

Màn cộng đồng dùng search, chỉ số social proof, chủ đề nổi bật và danh sách câu hỏi đã được bác sĩ giải đáp. Trang nội dung có bookmark, đánh giá “hữu ích”, bài liên quan và hai CTA cố định “Tư vấn với bác sĩ / Đặt lịch khám”. Đây là một content-to-conversion funnel rõ ràng.

Hospital Booking chưa cần xây social community. Có thể đạt phần lớn giá trị bằng FAQ/bài viết đã kiểm duyệt, liên kết chuyên khoa/bác sĩ liên quan và CTA đặt khám theo context. Cần tránh để CTA cố định, mascot AI và nút hỗ trợ cùng chồng lên vùng đọc như MyVinmec.

---

## 12. Search và discovery

MyVinmec mở search như một overlay trên Trang chủ: nền bị dim, search box được focus ngay và có nút đóng. Cảm giác chuyển ngữ cảnh nhẹ và nhanh.

Tuy nhiên, lần tìm thử từ khóa chung không hiển thị loading, kết quả hoặc empty-state rõ ràng. Đây là khoảng trống UX cần tránh.

Đề xuất search toàn cục của app hiện tại:

- Mở bằng overlay/full-screen search có autofocus.
- Tìm đồng thời bác sĩ, chuyên khoa, gói khám và FAQ.
- Debounce 300–500 ms; hủy request cũ khi query đổi.
- Hiển thị nhóm kết quả và số lượng.
- Có recent searches cục bộ và nút xóa.
- Có loading skeleton, no-result gợi ý và retry khi lỗi.
- Không gửi query rỗng; không log dữ liệu sức khỏe nhạy cảm nguyên văn nếu analytics chưa có policy.

Backend hiện đã có search và PostgreSQL fallback, vì vậy đây là cải tiến có thể tái sử dụng năng lực sẵn có thay vì xây một hệ search mới.

---

## 13. Trợ lý sức khỏe AI MIA

### 13.1 Cấu trúc quan sát được

MIA không chỉ là một màn chat. MyVinmec đặt mascot nổi trên nhiều màn để mở một “mini health hub” gồm:

- Kiểm tra triệu chứng.
- Phân tích dinh dưỡng từ ảnh bữa ăn.
- Đặt lịch.
- Liên kết ứng dụng/dữ liệu sức khỏe.
- Composer hỏi đáp, đính kèm kết quả khám/xét nghiệm, lịch sử hội thoại và khu ứng dụng.

Lần mở đầu có onboarding spotlight bảy bước, lần lượt giới thiệu dashboard, composer, tệp đính kèm, lịch sử và kết nối dữ liệu. Sau onboarding, ứng dụng hiển thị pre-permission giải thích lý do cần vị trí, có lựa chọn “Bỏ qua” trước khi xin quyền hệ điều hành.

### 13.2 Điểm nên học

- AI có các lối vào theo nhu cầu thay vì bắt người dùng tự nghĩ prompt.
- CTA đặt lịch có thể nhận context từ cuộc trò chuyện.
- Pre-permission nêu lợi ích và cho phép bỏ qua là pattern tốt về quyền riêng tư.
- Onboarding bám trực tiếp vào thành phần thật giúp người dùng hiểu chức năng.
- Lịch sử hội thoại tách khỏi màn chính, tránh làm dashboard quá nặng.

### 13.3 Điểm không nên sao chép nguyên trạng

- Bảy bước onboarding là dài; với chatbot hiện tại chỉ cần 2–3 bước hoặc coach mark theo thời điểm.
- Không dùng email thô làm lời chào lớn. Dùng tên hiển thị; nếu không có thì chào trung tính.
- Mascot nổi đồng thời với nút Zalo, CTA cố định hoặc nội dung dài dễ che thông tin và tạo cạnh tranh hành động.
- Đính kèm kết quả khám là luồng dữ liệu sức khỏe nhạy cảm, cần consent, phân quyền, giới hạn định dạng/dung lượng, quét tệp, mã hóa, retention và audit trước khi bật.
- Kết nối Health Connect/HealthKit cần scope tối thiểu, giải thích mục đích từng loại dữ liệu và cơ chế thu hồi quyền.
- Symptom checker và phân tích dinh dưỡng là sản phẩm AI có rủi ro y khoa; không nên coi là mở rộng nhỏ của chatbot FAQ.

### 13.4 Áp dụng phù hợp cho chatbot hiện tại

Giai đoạn gần nên giữ chatbot text-first và bổ sung:

1. Ba shortcut theo context: tìm bác sĩ, tìm gói khám và xem lịch của tôi.
2. Disclaimer ngắn về phạm vi hỗ trợ, cảnh báo cấp cứu và đường dây nóng.
3. CTA mở đúng màn native với context đã chọn; không để AI tự tạo giao dịch.
4. Lịch sử hội thoại chỉ khi có chính sách lưu trữ/xóa rõ ràng.
5. Onboarding tối đa ba bước, có “Bỏ qua” và không lặp lại sau khi hoàn tất.

Chưa triển khai upload hồ sơ, symptom checker, nutrition vision hoặc đồng bộ health platform trong mốc tối ưu UI/UX hiện tại.

---

## 14. Visual language

### 14.1 MyVinmec

- Màu chính: xanh ngọc/turquoise.
- Màu nhấn: cam cho ưu đãi, “Mới” và một số CTA phụ.
- Nền trắng/xám rất nhạt.
- Header thường có hình lá và đường cong mềm.
- Card trắng, bo góc lớn, shadow nhẹ.
- Icon dạng line-art cùng màu thương hiệu.
- Tiêu đề lớn, đậm; nội dung xám.

### 14.2 Hướng áp dụng

App Hospital Booking đã dùng teal và card bo góc nên không cần đổi theme lớn. Nên chuẩn hóa:

- Teal cho hành động y tế/chính.
- Xanh đậm cho chữ và thông tin đáng tin cậy.
- Cam chỉ cho khuyến mại, “Mới” hoặc cảnh báo nhẹ; không dùng cho trạng thái y tế.
- Đỏ chỉ cho lỗi, hủy hoặc hành động nguy hiểm.
- Tối thiểu độ tương phản đạt mức dễ đọc; tránh subtitle xám quá nhạt như một số màn MyVinmec.
- Một bộ icon thống nhất về stroke/size.
- Một hệ radius và elevation thay vì mỗi màn dùng một kiểu card.

Không sao chép illustration, logo, icon hoặc artwork của Vinmec. Chỉ học hierarchy và interaction pattern.

---

## 15. Điểm tốt nên học và điểm cần tránh

### Nên học

- Service hub và “Tất cả dịch vụ” dạng bottom sheet.
- Primary action đặt lịch ở vị trí trung tâm.
- Empty state có CTA và hướng dẫn xử lý.
- Chọn bản thân/người thân khi đặt lịch.
- Tổ chức Tài khoản theo section.
- Giá trị trạng thái hiển thị ngay trên dòng cài đặt.
- Search mở nhanh theo overlay.
- Hai lối đi từ dịch vụ: tìm hiểu và nhận tư vấn.
- Version app và legal/privacy dễ tìm.
- Pre-permission giải thích rõ lợi ích trước khi xin quyền hệ điều hành.
- AI shortcut theo mục tiêu thay vì chỉ có ô chat trống.
- Dependency-aware empty state cho tính năng cần hồ sơ y tế.

### Không nên sao chép nguyên trạng

- Quá nhiều shortcut trên màn đầu.
- Sticky icon không có label sau khi cuộn.
- Form đặt lịch dài trên một màn.
- WebView cho nghiệp vụ cốt lõi.
- Chồng nhiều modal/bottom sheet/cookie banner.
- Search không có trạng thái loading/no-result rõ.
- Nội dung xám nhạt làm giảm khả năng đọc.
- Thêm tính năng ngoài domain chỉ để tạo cảm giác “super app”.
- Màn trắng nhiều giây khi tải nội dung hoặc PDF.
- Hiển thị email/số điện thoại đầy đủ ở vùng nổi bật khi không cần thiết.
- Nhiều floating action cùng xuất hiện và che nội dung.
- Dùng PDF cũ làm trung tâm trợ giúp trong app.
- Xây symptom checker/upload hồ sơ AI khi chưa có clinical safety và data governance.

---

## 16. Roadmap áp dụng đề xuất

### Mốc A — Tối ưu UI/UX bằng năng lực đã có

Không cần migration hoặc domain mới:

1. Thêm “Tất cả dịch vụ” dạng bottom sheet và rút service hub Trang chủ còn 6–8 mục.
2. Nâng cấp empty state cho Lịch khám, Hồ sơ, Đơn thuốc, Hóa đơn và Thông báo.
3. Nhóm lại màn Tài khoản thành Hồ sơ / Dữ liệu y tế / Cài đặt / Hỗ trợ & pháp lý.
4. Thêm CTA “Hỏi trợ lý” theo context ở gói khám, bác sĩ và chuyên khoa.
5. Chuẩn hóa badge “Mới”, icon, radius, elevation và màu trạng thái.
6. Thêm version app và trạng thái quyền thông báo trong Tài khoản.
7. Chuẩn hóa loading/skeleton/retry, không để màn trắng khi tải nội dung.
8. Che dữ liệu định danh phụ và không dùng email thô làm lời chào chatbot.

**Mục tiêu:** tăng khả năng khám phá và giảm màn rỗng cụt mà không tăng tải backend đáng kể.

### Mốc B — Search và contact hub

Tận dụng backend/search/site settings hiện có:

1. Search toàn cục theo nhóm bác sĩ, chuyên khoa, gói khám và FAQ.
2. Recent search cục bộ, loading/error/empty state đầy đủ.
3. Màn Liên hệ gồm hotline, địa chỉ, giờ làm việc và CTA gọi điện.
4. Điều hướng từ kết quả search trực tiếp tới chi tiết hoặc booking.
5. Thêm xác nhận trước khi gọi số điện thoại hoặc chuyển sang ứng dụng ngoài.

**Mục tiêu:** giảm số bước tìm bác sĩ/dịch vụ và đưa hỗ trợ vào đúng ngữ cảnh.

### Mốc C — Tính năng riêng có giá trị cho mobile

Chỉ triển khai sau khi mốc A–B ổn định:

1. Nhắc uống thuốc dựa trên prescription item, ưu tiên local notification trước.
2. Hồ sơ người thân/dependent profile với ownership và consent rõ.
3. Notification preference theo nhóm nghiệp vụ.
4. Lưu nhanh giấy tờ/hồ sơ cần mang đi khám nếu có policy bảo mật phù hợp.
5. Lịch sử chatbot và consent lưu hội thoại sau khi có retention policy.

**Mục tiêu:** tạo giá trị riêng cho mobile thay vì chỉ sao chép Web.

### Mốc D — Chỉ khi product mở rộng domain

- Sổ tiêm.
- Support ticket/chat với nhân viên.
- Telehealth.
- Theo dõi nội trú.
- Ưu đãi/voucher.
- Thanh toán/tạm ứng viện phí production.

Các mục này cần schema, API, quyền truy cập, vận hành và policy riêng; không nên bắt đầu bằng UI mock.

---

## 17. Thứ tự ưu tiên khuyến nghị

| Ưu tiên | Hạng mục | Giá trị | Chi phí/rủi ro |
|---:|---|---|---|
| 1 | Empty state có hành động | Cao | Thấp |
| 2 | Tổ chức lại service hub + bottom sheet “Tất cả” | Cao | Thấp |
| 3 | Nhóm lại Tài khoản và trạng thái cài đặt | Trung bình–cao | Thấp |
| 4 | Loading/skeleton/retry chuẩn hóa | Cao | Thấp–trung bình |
| 5 | CTA chatbot theo context + safety copy | Cao | Thấp–trung bình |
| 6 | Search toàn cục | Cao | Trung bình |
| 7 | Contact/hotline hub có xác nhận | Trung bình | Thấp |
| 8 | Nhắc uống thuốc local từ đơn thuốc | Cao, đặc thù mobile | Trung bình |
| 9 | Hồ sơ người thân | Cao | Cao vì cần domain/ownership |
| 10 | Notification preference | Trung bình | Trung bình |
| 11 | Các domain mới như sổ tiêm/telehealth/inpatient | Chưa xác định | Cao |

---

## 18. Kết luận

MyVinmec là nguồn tham khảo tốt về cách tổ chức một hệ sinh thái dịch vụ y tế trên mobile, đặc biệt ở service hub, bottom navigation, CTA đặt lịch, empty state và nhóm chức năng Tài khoản. Điểm có giá trị nhất đối với Hospital Booking không phải là thêm thật nhiều tính năng, mà là giúp người dùng khám phá tốt hơn những chức năng hệ thống đã có.

Phiên bản app hiện tại nên ưu tiên mốc A: cải thiện empty state, service hub, Account information architecture, loading state và CTA chatbot theo ngữ cảnh. Đây là nhóm thay đổi cho hiệu quả UX cao nhất, ít rủi ro nghiệp vụ và tận dụng tối đa backend/mobile hiện có. Search và contact hub là bước tiếp theo. Các tính năng người thân, nhắc uống thuốc và notification preference mới là hướng tạo khác biệt mobile dài hạn; các domain sổ tiêm, telehealth, nội trú, payment hoặc AI y khoa chuyên sâu chỉ nên làm khi có yêu cầu sản phẩm, data governance và vận hành rõ ràng.

---

## 19. File app hiện tại liên quan khi triển khai

- `mobile/lib/features/home/presentation/home_screen.dart`
- `mobile/lib/app/navigation/main_navigation_shell.dart`
- `mobile/lib/app/router/app_router.dart`
- `mobile/lib/features/appointments/presentation/appointments_screen.dart`
- `mobile/lib/features/medical_records/presentation/medical_records_screen.dart`
- `mobile/lib/features/prescriptions/presentation/prescriptions_screen.dart`
- `mobile/lib/features/invoices/presentation/invoices_screen.dart`
- `mobile/lib/features/notifications/presentation/notifications_screen.dart`
- `mobile/lib/features/profile/presentation/profile_screen.dart`
- `mobile/lib/features/chatbot/presentation/chatbot_screen.dart`
- `mobile/lib/features/packages/presentation/package_detail_screen.dart`
- `mobile/lib/app/theme/app_theme.dart`
