# Nhật ký minh chứng công việc tháng 11 và tháng 12 năm 2026

Tài liệu này theo dõi các đầu việc, bằng chứng và kết quả cần chuẩn bị cho các mốc báo cáo cuối kỳ. Nội dung được cập nhật trong quá trình phát triển; không chứa secret, token, dữ liệu bệnh nhân thật hoặc thông tin người tham gia có thể nhận diện.

## 1. Danh sách đầu việc và thời hạn

| Hạn nộp | Hạng mục | Kết quả cần chuẩn bị | Trạng thái |
|---|---|---|---|
| 16:44 20/11/2026 | Mục tiêu đề tài | Mục tiêu chính rõ ràng, có tính thực tiễn và tiêu chí đánh giá | Chưa tổng hợp |
| 16:49 23/11/2026 | Cam kết sản phẩm và metric | Phạm vi sản phẩm cuối cùng và bộ metric đo được | Chưa tổng hợp |
| 16:46 27/11/2026 | Phạm vi đề tài | Phạm vi nghiệp vụ, kỹ thuật, nền tảng và giới hạn triển khai | Chưa tổng hợp |
| 16:48 30/11/2026 | Phân công công việc | Trách nhiệm từng thành viên và liên kết kết quả | Chưa tổng hợp |
| 22:33 01/12/2026 | SRS và SDD | Đặc tả yêu cầu, thiết kế và các sơ đồ có bằng chứng từ code | Đang chuẩn bị nền tảng |
| 16:50 07/12/2026 | Repository Git | Repository công khai, lịch sử commit xuyên suốt và quyền truy cập | Cần kiểm chứng trước hạn |
| 22:34 07/12/2026 | Kiểm thử | Kế hoạch, test case, test tự động, độ phủ, defect và trạng thái | Đang tích lũy bằng chứng |
| 22:35 07/12/2026 | CI/CD và triển khai | Pipeline, lịch sử chạy, triển khai và liên kết môi trường | Cần tổng hợp |
| 22:32 08/12/2026 | Nhật ký sử dụng AI | Prompt, công cụ/model, đầu ra AI, phần kiểm chứng và phần chỉnh sửa | Đang ghi nhận |
| 22:34 08/12/2026 | Chất lượng mã nguồn | Phân tích tĩnh, quét secret và coding convention | Cần chạy và tổng hợp |
| 22:35 08/12/2026 | Thực nghiệm người dùng | Kịch bản, người tham gia ẩn danh, chỉ số, phản hồi và cải tiến | Chưa thực hiện |
| 22:36 08/12/2026 | Luận văn và tài liệu tham khảo | Báo cáo trùng lặp và danh mục tài liệu, đánh dấu tài liệu ngoại ngữ | Chưa tổng hợp |
| 22:36 08/12/2026 | Kết quả nổi bật | Bài báo, giải thưởng, xác nhận đơn vị hoặc sở hữu trí tuệ nếu có | Chưa xác minh |

## 2. Quy tắc ghi nhận sau mỗi mốc phát triển

Sau mỗi mốc công việc, ghi lại tối thiểu:

- Ngày thực hiện, nhánh Git và mã commit sau khi người phụ trách commit.
- Mục tiêu và hiện trạng trước thay đổi.
- Phạm vi file và nghiệp vụ bị ảnh hưởng.
- Giải pháp đã áp dụng và lý do lựa chọn.
- Lệnh kiểm thử, phạm vi kiểm thử và kết quả thực tế.
- Defect phát hiện, mức ưu tiên, cách xử lý và trạng thái.
- Metric trước và sau nếu có thể đo.
- Ảnh chụp, video, log CI/CD hoặc liên kết triển khai liên quan.
- Công cụ AI/model, prompt đã dùng, nội dung AI hỗ trợ và phần con người sửa hoặc xác minh.
- Rủi ro, giới hạn và công việc còn lại.

## 3. Mẫu nhật ký công việc

### Mốc YYYY MM DD Tên công việc

- **Mục tiêu:**
- **Hiện trạng trước thay đổi:**
- **Giải pháp:**
- **Phạm vi Web:**
- **Phạm vi Flutter:**
- **Phạm vi Backend hoặc Database:**
- **File chính:**
- **API và nghiệp vụ liên quan:**
- **Kiểm thử đã chạy:**
- **Kết quả:**
- **Metric:**
- **Defect và trạng thái:**
- **Bằng chứng:**
- **Nhánh hoặc commit:**
- **Công việc còn lại:**

## 4. Mẫu nhật ký sử dụng AI

### AI YYYY MM DD Tên tác vụ

- **Công cụ AI:** Codex
- **Model hoặc phiên bản:** Ghi theo thông tin hiển thị tại thời điểm sử dụng
- **Mục tiêu sử dụng:**
- **Prompt đã dùng:**
- **Nội dung AI tạo ra:**
- **Phần người thực hiện đã kiểm tra:**
- **Phần người thực hiện đã sửa hoặc hoàn thiện:**
- **Lệnh test hoặc bằng chứng xác minh:**
- **Kết luận chấp nhận hoặc loại bỏ:**

Không ghi secret, API key, token, mật khẩu, OTP, URL chứa credential hoặc dữ liệu bệnh nhân thật vào nhật ký AI.

## 5. Metric cần thu thập

### Sản phẩm và nghiệp vụ

- Tỷ lệ hoàn thành các luồng chính trên Web và Flutter.
- Số nghiệp vụ có đầy đủ loading, empty, error và offline state.
- Số API đã được tích hợp vào Web và Flutter.
- Tỷ lệ parity giữa Web và Flutter theo phạm vi đã cam kết.
- Số trạng thái lịch hẹn được kiểm thử end to end.

### Chất lượng phần mềm

- Số test tự động và tỷ lệ test đạt.
- Độ phủ test nếu pipeline hiện tại đo được.
- Số lỗi lint, type check và static analysis.
- Số secret hoặc dependency vulnerability được phát hiện.
- Số defect P0, P1, P2 và số đã đóng.
- Kết quả build production của backend, frontend và Flutter.

### Hiệu suất và trải nghiệm

- Thời gian phản hồi của các API quan trọng.
- Thời gian tải hoặc hiển thị dữ liệu của các màn hình chính.
- Tỷ lệ hoàn thành tác vụ đặt lịch trong thực nghiệm người dùng.
- Thời gian hoàn thành tác vụ, số lỗi thao tác và mức hài lòng.
- Số cải tiến được thực hiện từ phản hồi người dùng.

## 6. Bằng chứng cần lưu theo nhóm báo cáo

### SRS và SDD

- Kiến trúc Web, Flutter, Backend và Database.
- Role và permission matrix.
- Screen inventory và screen to API mapping.
- Appointment lifecycle, sequence OTP và luồng thông báo.
- ERD và API inventory có dẫn chứng source.

### Kiểm thử

- Test plan và ma trận nghiệp vụ.
- Test case thủ công và tự động.
- Log lệnh test, kết quả CI và báo cáo coverage.
- Danh sách defect, mức ưu tiên, trạng thái và bằng chứng sửa lỗi.

### CI CD và triển khai

- File workflow và cấu hình deploy không chứa secret.
- Lịch sử workflow thành công hoặc thất bại và nguyên nhân.
- Liên kết môi trường triển khai và checklist vận hành.

### Thực nghiệm người dùng

- Kịch bản tác vụ có mục tiêu đo rõ ràng.
- Người tham gia được mã hóa và ẩn danh.
- Dữ liệu thời gian, tỷ lệ hoàn thành, lỗi thao tác và phản hồi.
- Danh sách cải tiến trước và sau thực nghiệm.

## 7. Nhật ký tích lũy

Các mục mới được thêm theo thứ tự thời gian. Chỉ ghi kết quả đã kiểm chứng; nội dung dự kiến phải được đánh dấu rõ là chưa thực hiện hoặc chưa xác minh.
