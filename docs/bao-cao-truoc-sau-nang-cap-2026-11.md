# Báo cáo trước và sau đợt nâng cấp tháng 11/2026

**Mốc "trước":** nhánh `main` ngày 30/10/2026, commit `b866c8b` (PR #37).
**Mốc "sau":** nhánh `main` ngày 08/11/2026, commit `2b33342` (PR #44).
**Phạm vi:** 47 commit, 367 tệp thay đổi trong `backend`, `frontend` và `mobile`.

Mục tiêu của đợt này: chỉ thêm hai tính năng mới (phân quyền linh động và kho thuốc gọn), phần còn lại là dọn dẹp, củng cố bảo mật và đưa hệ thống lên production chạy thật.

## 1. So sánh định lượng

Số liệu lấy trực tiếp từ git ở hai commit trên.

| Chỉ số | Trước | Sau | Nhận xét |
|---|---|---|---|
| Vai trò nhân sự | 3 (`ADMIN`, `STAFF`, `DOCTOR`) | 4 (thêm `PHARMACIST`) | |
| Cách phân quyền | `requireRole` gắn cứng vào route: 128 chỗ | `requirePermission` theo ma trận: 134 chỗ, `requireRole` còn 0 | 39 mã quyền, chỉnh được trong dashboard |
| Mô hình dữ liệu | 41 | 40 | Thêm `Medicine`, `StockMovement`; gộp FAQ thành `FAQ`; bỏ `ChatbotFAQ`, `PublicFAQ`, `ConsultationRequest`, `SearchAnalyticsLog` |
| Migration | 41 | 46 | |
| Nhà cung cấp thanh toán | 4 (`MOCK`, `VNPAY`, `MOMO`, `ZALOPAY`) | 1 (`VNPAY`) | Đã quy đổi dữ liệu cũ sang VNPAY trước khi áp migration |
| Dịch vụ backend (tệp) | 42 | 48 | |
| Mã nguồn backend (`backend/src`) | 32.042 dòng | 30.908 dòng | Giảm 1.134 dòng dù thêm tính năng nhờ gỡ mã không dùng |
| Trang frontend | 31 | 45 | Thêm phân quyền, cấp thuốc, kho thuốc, trang kết quả và các màn khác |
| Ca kiểm thử backend | 69 | 121 | Chia: unit 33, smoke 21, integration 67; đều đạt |
| Ca kiểm thử mobile (tệp test) | 70 | 70 | Có sửa các test lỗi thời |
| Lệnh kiểm thử | nhiều đường | một đường `npm run test:all` | CI chạy backend, frontend, mobile và build APK |

## 2. Thay đổi theo nhóm

**Dọn dẹp (một chức năng chỉ có một đường triển khai):**
- Gỡ Elasticsearch, các bảng tìm kiếm và tư vấn cũ, FAQ chatbot trùng lặp.
- Gỡ MoMo, ZaloPay và thanh toán giả lập; VNPay là cổng online duy nhất.
- OTP mặc định qua email; dọn OTP đã hết hạn bằng worker.

**Tính năng mới:**
- Phân quyền động: ma trận vai trò–quyền lưu ở cấu hình, trang `/dashboard/permissions`, giao diện ẩn hiện theo quyền, backend vẫn là nơi chặn thật. Quản trị viên không mặc định có mọi quyền.
- Kho thuốc gọn và cấp thuốc cho Dược sĩ: danh mục, nhập kho, điều chỉnh có lý do, sổ kho chỉ thêm, cấp thuốc nguyên đơn tất cả hoặc không, trừ kho nguyên tử, cảnh báo dị ứng, thông báo "thuốc đã được cấp" cho người khám.

**Chính sách và tuân thủ:**
- Chính sách đặt lịch cấu hình được (hạn hủy, tự đánh dấu vắng mặt).
- Nhật ký lâm sàng cho thao tác bệnh án và đơn thuốc.
- Đồng ý xử lý dữ liệu sức khỏe khi đặt lịch có dữ liệu sức khỏe.

**Bảo mật và độ bền khi vận hành:**
- Cookie đăng nhập theo môi trường thật (`Secure` khi chạy trên Render), danh sách CORS và thông báo lỗi 500 theo `isProductionLike()`.
- Header bảo mật cho web; chuẩn hóa IP gửi VNPay về IPv4.
- Build web không còn treo khi API ngủ nhờ thời hạn 12 giây cho lời gọi phía máy chủ.
- Worker chạy được ngay trong tiến trình API (`INLINE_WORKERS`) cho môi trường chỉ có một dịch vụ.

## 3. Nghiệm thu trên production ngày 08/11/2026

Thực hiện trên hệ thống thật (web Vercel, API Render, VNPay sandbox):

| Hạng mục | Kết quả |
|---|---|
| Đặt lịch của khách, OTP email, đăng nhập cổng người khám | Đạt |
| Đăng nhập dashboard (mật khẩu + OTP email) cho admin, bác sĩ, dược sĩ | Đạt |
| Vòng đời lịch: xác nhận, check-in, bắt đầu khám, hoàn thành | Đạt; admin bị chặn đúng ở bước khám (403) |
| Tạo hóa đơn từ lịch hoàn thành | Đạt (300.000 đ) |
| Thanh toán VNPay sandbox bằng thẻ test NCB | Đạt: Return URL 302, IPN `00`, hóa đơn `PAID` qua VNPAY, đủ 6 thông báo tới người khám |
| Bác sĩ kê và phát hành đơn thuốc | Đạt |
| Dược sĩ nhập kho và cấp thuốc | Đạt: tồn 100 → 90 → 84, sổ kho đủ `RECEIPT` và `DISPENSE`, đơn rời hàng đợi |
| Quét 15 trang dashboard và 26 API đọc bằng phiên admin | Tất cả 200, không có request lỗi; riêng quyền kho thuốc trả 403 cho admin đúng thiết kế |
| IPN và Return URL giả mạo | IPN trả `97`; Return URL chuyển trang kết quả với trạng thái lỗi, hóa đơn không đổi |
| Trang công khai (khoa, bác sĩ, gói khám, sitemap) | 200, tải dưới 2 giây |

## 4. Sự cố khi đưa lên production và bài học

| Sự cố | Nguyên nhân | Xử lý |
|---|---|---|
| API không khởi động | Import nguyên file `.env` local lên Render mang theo giá trị dev (`FRONTEND_URL`, `NODE_ENV`, URL VNPay là localhost, `OTP_SECRET` ngắn) | Sửa từng biến theo môi trường; bài học: không import `.env` local lên máy chủ |
| Migration production dừng giữa chừng | Còn dữ liệu thanh toán MOCK và MOMO cũ khiến bước kiểm tra chặn | Quy đổi sang VNPAY, đánh dấu migration lỗi là đã hoàn tác rồi áp lại |
| Đăng nhập bị đá ra sau khi nhập OTP | Cookie `SameSite=None` nhưng thiếu `Secure` vì `NODE_ENV=development` trên Render; web còn gọi API khác site | Dùng `isProductionLike()`; trỏ web về cùng domain gốc với API |
| Không nhận được email OTP | Chạy `npm start` chỉ có API, không có tiến trình worker OTP; email nằm kẹt trong hàng đợi | Thêm `INLINE_WORKERS`; dùng domain gửi đã xác minh |
| Build Vercel lỗi ba lần | Dựng tĩnh gọi API khi API đang ngủ, quá 60 giây | Thời hạn 12 giây, có giá trị dự phòng |
| Dược sĩ thấy lỗi 403 ở trang Đơn thuốc | Ô lọc bác sĩ tải mỗi khi không phải bác sĩ, trong khi Dược sĩ không có quyền xem danh mục bác sĩ | Chỉ tải khi có quyền `catalog.view` (4 trang) |
| API treo sau một đêm | Instance gói free ngủ rồi kẹt | Triển khai lại thủ công; cần gói trả phí hoặc dịch vụ giữ thức |

## 5. Tồn đọng

- Thanh toán chưa có đối soát chủ động (`querydr`) và chưa có hoàn tiền qua VNPay.
- Chưa có `Content-Security-Policy` cho web.
- Worker chạy trong API nên ngừng khi instance ngủ; Redis Upstash cần chuyển chính sách eviction sang `noeviction`.
- Thông báo đẩy tới thiết bị thật chưa nghiệm thu (cần app mobile và token thiết bị).
- SRS và SDD trên Claude Docs cần cập nhật theo hệ thống đã triển khai (mục tiếp theo).
