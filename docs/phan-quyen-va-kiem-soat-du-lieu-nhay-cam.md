# Phân quyền và kiểm soát dữ liệu nhạy cảm

Tài liệu mô tả cách hệ thống tách quyền giữa các vai trò để không ai can thiệp vào công việc nhạy cảm của vai trò khác (bệnh án, đơn thuốc, cấp thuốc, tiền), và các điểm đã được siết lại trong đợt rà soát 11/2026.

## 1. Nguyên tắc

1. **Quyền tối thiểu:** mỗi vai trò chỉ có quyền cần cho công việc của mình. Quản trị viên không mặc định có mọi quyền.
2. **Giới hạn cứng trong mã:** mỗi mã quyền (`backend/src/config/permissions.ts`) khai báo `eligibleRoles` (vai trò được phép nhận), `fixedRoles` (luôn có, không gỡ được) và `defaultRoles`. Ma trận lưu trong dữ liệu (`rbac.matrix`) chỉ bật tắt trong tập đủ điều kiện, nên dù ai chỉnh sai ma trận cũng không thể cấp "admin sửa đơn thuốc" hay "nhân viên đọc bệnh án".
3. **Phạm vi dữ liệu theo người dùng:** bác sĩ chỉ thấy bệnh án, đơn thuốc, lịch hẹn và khung giờ của chính mình. Lịch hẹn che dị ứng, tiền sử nếu thiếu quyền xem bệnh án. Dược sĩ chỉ thấy dữ liệu tối thiểu để cấp thuốc (tên, số điện thoại, dị ứng, danh sách thuốc), không thấy chẩn đoán.
4. **Tách người làm và người xác nhận:** kết thúc buổi khám (mở khâu hóa đơn) là bác sĩ; thu tiền là nhân viên; hoàn tiền là quản trị; cấp thuốc và điều chỉnh kho là dược sĩ.
5. **Mọi thao tác nhạy cảm để lại dấu vết**, nhật ký chỉ thêm dòng và không chứa nội dung y tế.

## 2. Ai làm được gì (mặc định)

| Công việc | Quản trị | Nhân viên | Bác sĩ | Dược sĩ |
|---|---|---|---|---|
| Tiếp đón (xác nhận, check-in, đổi lịch) | có | có | không | không |
| Bắt đầu buổi khám | không | có | có | không |
| **Kết thúc buổi khám** | không | không (cấp thêm được) | **có** | không |
| Xem nội dung bệnh án | không (cấp thêm được, có ghi vết) | không | có (của mình) | không |
| Ghi, sửa, công bố bệnh án | không | không | **chỉ bác sĩ** | không |
| Xem đơn thuốc | không (cấp thêm được, có ghi vết) | không | có (của mình) | có (dữ liệu tối thiểu) |
| Kê, phát hành, hủy đơn thuốc | không | không | **chỉ bác sĩ** | không |
| Cấp thuốc, nhập kho, chỉnh tồn | không | không | không | **chỉ dược sĩ** |
| Tạo, chỉnh, thu tiền hóa đơn | có (xem) | có | không | không |
| Hoàn tiền (thủ công và qua VNPay) | **chỉ quản trị** | không | không | không |
| Quản lý tài khoản và phân quyền | **chỉ quản trị** | không | không | không |
| Xem nhật ký truy cập | **chỉ quản trị** | không | không | không |
| Xem nhật ký chatbot | có | không (cấp thêm được) | không | không |

Ba cột "cấp thêm được" nghĩa là quản trị có thể bật trong trang Phân quyền; ma trận ở `/dashboard/permissions` luôn là nguồn đúng.

## 3. Những điểm đã siết (11/2026)

| Vấn đề phát hiện | Cách xử lý |
|---|---|
| Quản trị đặt lại mật khẩu (hoặc đổi email, số điện thoại) của bác sĩ hay dược sĩ rồi đăng nhập thay, vượt mọi lớp tách quyền. | Đặt lại mật khẩu cho người khác thì `User.mustChangePassword = true`: người đó chỉ đổi được mật khẩu cho tới khi tự đặt mật khẩu mới, mọi phiên đang mở bị thu hồi. Tạo tài khoản cũng buộc đổi. Đổi vai trò, email, số điện thoại, khóa tài khoản, đặt lại mật khẩu đều ghi nhật ký. |
| Không có nhật ký truy cập; đổi ma trận quyền không để lại lịch sử. | Bảng `AuditLog` (chỉ thêm dòng, trigger chặn sửa và xóa) và trang `/dashboard/audit-logs` cho quản trị. |
| Quản trị đọc được toàn bộ nội dung bệnh án và đơn thuốc dù không cần cho vận hành. | `record.view` và `prescription.view` bỏ quản trị khỏi mặc định (vẫn đủ điều kiện để được cấp). Mỗi lần người không phải bác sĩ điều trị xem chi tiết đều ghi `MEDICAL_RECORD_VIEWED` hoặc `PRESCRIPTION_VIEWED`. |
| Nhân viên tự bắt đầu, kết thúc khám, tạo hóa đơn, giảm giá và thu tiền mặt không cần bác sĩ nào. | `appointment.exam` tách thành `appointment.exam_start` (nhân viên và bác sĩ) và `appointment.exam_finish` (mặc định chỉ bác sĩ). |
| Chỉnh giảm hóa đơn không lưu giá trị trước và sau. | `INVOICE_ADJUSTED` ghi giảm trừ và số tiền trước, sau; hoàn tiền ghi `INVOICE_REFUNDED` (thủ công hoặc qua API). |
| Nhật ký chatbot có thể chứa triệu chứng người dùng gõ vào mà nhân viên xem được. | `chatbot.view` mặc định chỉ quản trị. |

## 4. Nhật ký truy cập

- Mỗi dòng: thời điểm, người thực hiện (tên và vai trò lúc đó), hành động, đối tượng, IP, chi tiết nhỏ (ví dụ vai trò cũ và mới, số tiền trước và sau). Không có nội dung y tế.
- Hành động ghi: tạo và sửa tài khoản, khóa hoặc mở, đặt lại hoặc tự đổi mật khẩu, đổi hoặc khôi phục ma trận quyền (kèm quyền nào đổi từ vai trò nào sang vai trò nào), xem chi tiết bệnh án hoặc đơn thuốc bởi người không phải bác sĩ điều trị, chỉnh giảm hóa đơn, hoàn tiền (kể cả trường hợp VNPay chưa xác nhận kết quả).
- Không ghi: bác sĩ điều trị xem bệnh án của chính mình (công việc hằng ngày), thao tác kho (đã có sổ kho chỉ thêm dòng), nhật ký lâm sàng gắn lịch hẹn (đã có `AppointmentLog`).

## 5. Vận hành và lưu ý khi nâng cấp

- Migration `20261108150000_add_audit_log_and_force_password_change`: thêm cột `User.mustChangePassword` (mặc định `false`) và bảng `AuditLog`. Không ảnh hưởng dữ liệu cũ; Render áp dụng khi build.
- **Mặc định mới chỉ có hiệu lực khi chưa có ma trận lưu.** Nếu quản trị từng lưu ma trận ở `/dashboard/permissions`, giá trị cũ vẫn giữ (quản trị còn quyền xem bệnh án, nhân viên còn xem chatbot). Muốn áp mặc định mới: bấm "Khôi phục mặc định" ở trang Phân quyền (việc này cũng được ghi nhật ký), hoặc tự bỏ các quyền tương ứng.
- Mã quyền `appointment.exam` bị thay bằng `appointment.exam_start` và `appointment.exam_finish`. Mã cũ trong ma trận đã lưu bị bỏ qua. Nếu nhân viên đang kết thúc buổi khám, quản trị cần bật lại `appointment.exam_finish` cho nhân viên.
- Mật khẩu tự đặt tối thiểu 8 ký tự. Mật khẩu tạm do quản trị đặt vẫn tối thiểu 6 ký tự vì người dùng buộc phải đổi.

## 6. Giới hạn hiện tại và hướng phát triển

- Quản trị vẫn có thể đổi email và số điện thoại đăng nhập của người khác (hai thông tin quyết định nơi nhận mã OTP). Việc này được ghi nhật ký và kèm buộc đổi mật khẩu khi đặt lại, nhưng chưa có xác nhận từ chính chủ tài khoản. Hướng phát triển: gửi thông báo tới email cũ của chủ tài khoản khi các thông tin này đổi.
- Chưa có quyền xem khẩn cấp (break-glass) với lý do bắt buộc; hiện quản trị phải được cấp quyền trong ma trận trước khi xem.
- Bác sĩ chỉ xem bệnh án do chính mình lập. Trường hợp bác sĩ khác cần xem lịch sử khám của cùng bệnh nhân (liên tục chăm sóc) chưa được hỗ trợ; nên cho phép khi có lịch hẹn hiện hành với bệnh nhân đó và ghi nhật ký.
- Liên kết tệp kết quả xét nghiệm (`LabResult.fileUrl`) là URL thường; cần kiểm tra chế độ công khai của kho lưu trữ tệp trên production.
- Chưa rà phân quyền phía cổng bệnh nhân (người thân, phiên đăng nhập) trong đợt này.
