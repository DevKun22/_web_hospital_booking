# Bản đồ nghiệp vụ và chỉ dẫn UI/UX cho Hospital Booking {#hospital-booking-uiux-brief}

AI thiết kế phải xem **backend là nguồn sự thật duy nhất**. Web công khai, Dashboard và Mobile là ba bề mặt của cùng một hệ thống. Giao diện mới cần làm rõ việc tiếp theo, không sao chép luật trạng thái hoặc tự tạo dữ liệu ngoài API.

- Người bệnh đi từ khám phá dịch vụ đến đặt lịch, khám, nhận kết quả và thanh toán trong một hành trình liên tục.[](source:system-report)
- Nhân viên, bác sĩ và quản trị viên dùng cùng dữ liệu nhưng có quyền, mục tiêu và mật độ thao tác khác nhau.[](source:dashboard-nav)
- Mọi lịch hẹn, hồ sơ khám, đơn thuốc, hóa đơn và thông báo đều có trạng thái nghiệp vụ cụ thể.[](source:prisma-schema)
- Thiết kế cần thống nhất ngôn ngữ Calm Care, nhưng vẫn phân biệt rõ thông tin y tế, hành động vận hành và cảnh báo khẩn cấp.[](source:design-tokens)

@answer scope="Worktree ngày 26/10/2026 · source-first · chưa kiểm thử runtime"
@meta quality_profile=showcase style=product

@source readme title="Tổng quan hệ thống" path=README.md
@source system-report title="Báo cáo nâng cấp backend đến mobile" path=docs/bao-cao-nang-cap-backend-den-mobile.md
@source uiux-study title="Nghiên cứu UI/UX và đề xuất áp dụng" path=docs/nghien-cuu-uiux-vinmec-va-de-xuat-ap-dung.md
@source notification-ops title="Vận hành hệ thống thông báo" path=docs/van-hanh-thong-bao.md
@source prisma-schema title="Mô hình dữ liệu và trạng thái nghiệp vụ" path=backend/prisma/schema.prisma
@source api-routes title="API versioned dùng chung cho mobile" path=backend/src/routes/v1.route.ts
@source appointment-service title="Luật vòng đời lịch hẹn" path=backend/src/services/appointment.service.ts
@source dashboard-nav title="Điều hướng và phân quyền Dashboard" path=frontend/lib/dashboard-navigation.ts
@source public-home title="Trang chủ Web công khai" path=frontend/components/public/public-home-view.tsx
@source public-booking title="Luồng đặt lịch Web" path=frontend/components/public/public-booking-widget.tsx
@source mobile-router title="Điều hướng Mobile" path=mobile/lib/app/router/app_router.dart
@source mobile-nav title="Bottom navigation Mobile" path=mobile/lib/app/navigation/main_navigation_shell.dart
@source design-tokens title="Design token Calm Care" path=mobile/lib/core/design/app_design_tokens.dart

## Hệ thống gồm những bề mặt và dịch vụ nào? {#system-map}

@architecture id=system-architecture title="Một domain, ba bề mặt trải nghiệm"
| public-web | Web công khai | frontend | source:public-home |
| patient-mobile | Mobile bệnh nhân | frontend | source:mobile-router |
| hospital-dashboard | Dashboard bệnh viện | frontend | source:dashboard-nav |
| express-api | Express API | backend | source:api-routes |
| domain-core | Dịch vụ nghiệp vụ | backend | source:appointment-service |
| postgres | PostgreSQL + Prisma | database | source:prisma-schema |
| queue-workers | Redis + BullMQ | messagebus | source:notification-ops |
| delivery | Email + Firebase FCM | cloud | source:notification-ops |
| content-services | Search + Cloudinary | cloud | source:readme |
| payment-provider | Cổng thanh toán | external | source:system-report |
| public-web > express-api | API công khai | emphasis |
| patient-mobile > express-api | `/api/v1` | emphasis |
| hospital-dashboard > express-api | API theo vai trò | security |
| express-api > domain-core | xác thực + điều phối | security |
| domain-core > postgres | đọc và ghi | emphasis |
| domain-core > queue-workers | việc nền | default |
| queue-workers > delivery | gửi thông báo | default |
| domain-core > content-services | tìm kiếm + media | dashed |
| domain-core > payment-provider | adapter provider | dashed |

PostgreSQL giữ dữ liệu chuẩn. Redis, Elasticsearch, Cloudinary, email, FCM và cổng thanh toán là dịch vụ hỗ trợ; chúng không được trở thành nguồn quyết định trạng thái nghiệp vụ.

| Bề mặt | Người dùng chính | Mục tiêu ưu tiên | Mật độ giao diện |
| --- | --- | --- | --- |
| Web công khai | Khách, người chưa cài app | Tìm dịch vụ, đặt lịch, tra cứu bằng OTP | Thoáng, giàu nội dung, ưu tiên chuyển đổi |
| Mobile | Người bệnh đã hoặc chưa đăng nhập | Việc cần làm hôm nay, QR lịch, hồ sơ, thông báo | Cá nhân hóa, thao tác một tay, trạng thái rõ |
| Dashboard | Admin, nhân viên, bác sĩ | Tiếp nhận, khám, ghi nhận, đối soát, cấu hình | Nhiều dữ liệu, lọc nhanh, thao tác theo vai trò |

## Ai được làm gì? {#roles-and-boundaries}

| Vai trò | Được xem và thao tác | Hành động chính | Ranh giới thiết kế |
| --- | --- | --- | --- |
| Khách | Chuyên khoa, bác sĩ, gói khám, FAQ, chatbot, slot công khai | Đặt lịch cho bản thân, nhận OTP, tra cứu lịch | Không hiển thị dữ liệu bệnh nhân khác; không giả lập trạng thái đăng nhập |
| Bệnh nhân | Hồ sơ cá nhân, người thân thuộc tài khoản, lịch, kết quả, đơn thuốc, hóa đơn, thông báo | Đặt hoặc hủy lịch, thanh toán khi khả dụng, quản lý tùy chọn push | Luôn chỉ rõ người được khám; hành động nhạy cảm cần xác thực |
| Nhân viên | Lịch hẹn, tiếp nhận, lịch bác sĩ, yêu cầu tư vấn, hóa đơn, danh mục | Xác nhận, đổi lịch, check-in, thu tiền, vận hành nội dung | Không trộn thao tác lâm sàng với thao tác tài chính |
| Bác sĩ | Lịch được phân công, hồ sơ khám, kết quả, đơn thuốc, đánh giá liên quan | Bắt đầu khám, hoàn tất khám, ghi kết quả và kê đơn | Chỉ mở công cụ theo ca và quyền được cấp |
| Quản trị viên | Toàn bộ Dashboard, nhân sự, cấu hình, thông báo hệ thống | Phân quyền, kiểm soát vận hành, cấu hình kênh | Hành động phá hủy cần xác nhận và ghi nhận hậu quả |

@callout level=warning title="Bất biến quyền sở hữu"
| Chủ tài khoản quản lý phiên, OTP và thông báo. Người được khám có thể là chính họ hoặc một hồ sơ người thân thuộc tài khoản. UI phải hiển thị hai khái niệm này riêng khi cần. |

## Hành trình bệnh nhân phải liền mạch ra sao? {#patient-journey}

@workflow id=patient-booking-journey title="Từ khám phá đến chăm sóc sau khám"
| lane discover | Khám phá |
| lane booking | Đặt lịch |
| lane care | Đi khám |
| lane aftercare | Sau khám |
| discover | Tìm dịch vụ | frontend | discover | source:public-home |
| choose | Chọn khoa, bác sĩ hoặc gói | frontend | discover | source:public-booking |
| identity | Chọn người được khám | security | booking | source:mobile-router |
| slot | Chọn ngày và khung giờ | frontend | booking | source:appointment-service |
| verify | Xác thực OTP | security | booking | source:appointment-service |
| waiting | Chờ bệnh viện xác nhận | backend | booking | source:prisma-schema |
| confirmed | Lịch đã xác nhận | backend | care | source:appointment-service |
| checkin | Đến viện và check-in | backend | care | source:appointment-service |
| examination | Đang khám | backend | care | source:appointment-service |
| completed | Hoàn tất khám | backend | care | source:appointment-service |
| clinical | Kết quả và đơn thuốc | frontend | aftercare | source:system-report |
| billing | Hóa đơn và thanh toán | frontend | aftercare | source:system-report |
| discover > choose | phù hợp |
| choose > identity | tiếp tục |
| identity > slot | đúng người |
| slot > verify | giữ chỗ |
| verify > waiting | hợp lệ | security |
| waiting > confirmed | bệnh viện duyệt | emphasis |
| confirmed > checkin | đến khám |
| checkin > examination | tiếp nhận |
| examination > completed | bác sĩ hoàn tất | emphasis |
| completed > clinical | công bố |
| completed > billing | lập hóa đơn |

@steps id=journey-rules
| choose-step | Chọn khoa, bác sĩ hoặc gói | Một ý định đặt lịch có thể bắt đầu từ nhiều điểm, nhưng phải hội tụ về cùng booking draft. | patient-booking-journey | choose |
| identity-step | Chọn người được khám | Khách chỉ đặt cho bản thân; người thân yêu cầu đăng nhập và kiểm tra ownership. | patient-booking-journey | identity |
| verify-step | Xác thực OTP | Chưa xác thực là `PENDING_OTP`; xác thực xong mới chuyển sang chờ xác nhận. | patient-booking-journey | verify |
| care-step | Đi khám | Dashboard điều khiển check-in, đang khám và hoàn tất; client chỉ phản ánh trạng thái từ API. | patient-booking-journey | examination |
| aftercare-step | Sau khám | Kết quả, đơn thuốc và hóa đơn là các nhánh sau khám, không phải một màn hình duy nhất. | patient-booking-journey | completed |

## Trạng thái nào quyết định nội dung và hành động? {#state-model}

| Trạng thái lịch | Ý nghĩa cho người bệnh | CTA hợp lệ | Màu ngữ nghĩa |
| --- | --- | --- | --- |
| `PENDING_OTP` | Lịch mới chưa xác thực | Nhập hoặc gửi lại OTP | Cảnh báo nhẹ |
| `PENDING_CONFIRM` | Bệnh viện chưa duyệt | Xem chi tiết, chờ phản hồi | Thông tin |
| `CONFIRMED` | Lịch đã được giữ chính thức | Xem QR, chuẩn bị, chỉ đường, hủy theo chính sách | Thành công |
| `RESCHEDULED` | Thời gian đã đổi | Xem thay đổi, xác nhận đã đọc | Cảnh báo |
| `CHECKED_IN` | Đã đến cơ sở | Xem phòng và thứ tự tiếp nhận | Thông tin đậm |
| `IN_PROGRESS` | Bác sĩ đang khám | Xem thông tin buổi khám | Đang hoạt động |
| `COMPLETED` | Buổi khám đã kết thúc | Xem kết quả, đơn thuốc, hóa đơn | Hoàn tất |
| `NO_SHOW` | Không đến theo lịch | Xem lý do, đặt lại | Trung tính cảnh báo |
| `CANCELLED_BY_*` | Lịch đã hủy và không thể tiếp tục | Xem lý do, đặt lịch mới | Nguy hiểm |

| Trạng thái hóa đơn | Điều hệ thống cần thể hiện | Không được gây hiểu nhầm |
| --- | --- | --- |
| `UNPAID` | Tổng tiền, khoản mục, phương thức đang khả dụng | Không ghi “đã thanh toán” khi giao dịch còn chờ |
| `PAID` | Biên nhận, phương thức, mã tham chiếu, thời điểm | Không tiếp tục hiển thị CTA trả tiền |
| `CANCELLED` | Lý do hủy và lịch sử | Không cho thao tác thu tiền |
| `REFUNDED` | Số tiền hoàn, lý do, mã tham chiếu | Phân biệt hoàn tiền với hủy hóa đơn |

## Dữ liệu đổi trạng thái đến Mobile như thế nào? {#sync-sequence}

@sequence id=status-notification-flow title="Dashboard cập nhật, Mobile nhận và làm mới"
| actor operator | Nhân viên hoặc bác sĩ | frontend | source:dashboard-nav |
| actor api | Backend API | backend | source:appointment-service |
| actor db | PostgreSQL | database | source:prisma-schema |
| actor worker | Notification worker | messagebus | source:notification-ops |
| actor fcm | Firebase FCM | cloud | source:notification-ops |
| actor app | Mobile bệnh nhân | frontend | source:mobile-router |
| operator | api | Cập nhật trạng thái theo quyền | security |
| api | db | Transaction: trạng thái + log + notification | emphasis |
| db | api | Kết quả đã ghi | return |
| api | worker | Đưa delivery vào queue |
| worker | fcm | Gửi push theo tùy chọn |
| fcm | app | Thông báo và deep link | return |
| app | api | Tải lại màn đích từ API | emphasis |
| api | app | Read model mới nhất | return |

Push chỉ báo cho người dùng rằng có thay đổi. Khi mở thông báo hoặc quay lại ứng dụng, Mobile phải tải trạng thái mới nhất thay vì tin dữ liệu nằm trong payload.

## Kiến trúc thông tin nào phù hợp cho từng bề mặt? {#information-architecture}

| Bề mặt | Cấu trúc ưu tiên | Nội dung phía trên nếp gấp | Điều hướng chính |
| --- | --- | --- | --- |
| Web công khai | Khám phá → tin cậy → chuyển đổi → hỗ trợ | Tìm kiếm, lời hứa giá trị, CTA đặt lịch, điểm tin cậy | Header đầy đủ, tìm kiếm, chuyên khoa, bác sĩ, gói khám, tra cứu |
| Mobile chưa đăng nhập | Nhận diện → khám phá → đặt nhanh | Cơ sở đang chọn, tìm kiếm, hero gọn, lối tắt đặt khám | Bottom nav ổn định; chức năng cần tài khoản chuyển qua OTP rồi quay lại đúng nơi |
| Mobile đã đăng nhập | Việc cần làm → lịch gần nhất → sức khỏe → dịch vụ | Lịch sắp tới, QR, trạng thái, chuẩn bị, thông báo quan trọng | Trang chủ, Hồ sơ, Đặt khám, Thông báo, Tài khoản; chatbot nổi |
| Dashboard | Hàng đợi công việc → ngoại lệ → chi tiết → thao tác | KPI trong ngày, việc cần xử lý, cảnh báo, bộ lọc | Sidebar theo nhóm nghiệp vụ và quyền; workspace đóng mở được |

## Danh sách màn hình tối thiểu cho AI thiết kế {#screen-inventory}

| Nhóm | Màn hình | Mục tiêu duy nhất của màn hình |
| --- | --- | --- |
| Public Web {#screen-public-discovery} | Trang chủ, tìm kiếm, danh sách và chi tiết khoa, bác sĩ, gói khám | Khám phá và chuyển sang ý định đặt lịch |
| Public Web {#screen-public-service} | Booking, xác thực OTP, tra cứu lịch, hướng dẫn, FAQ | Hoàn tất hoặc tự phục vụ sau đặt lịch |
| Mobile {#screen-mobile-entry} | Splash động, Welcome, đăng nhập OTP | Vào app nhanh, giải thích giá trị, xác thực có ngữ cảnh |
| Mobile {#screen-mobile-discovery} | Home, danh mục bác sĩ và gói khám, chi tiết | Hiển thị việc cần làm và hỗ trợ khám phá |
| Mobile {#screen-mobile-booking} | Booking theo bước, chọn bản thân hoặc người thân, thành công | Giảm sai sót và giữ người dùng biết đang ở bước nào |
| Mobile {#screen-mobile-care} | Lịch hẹn, QR, chuẩn bị, hồ sơ khám, đơn thuốc, hóa đơn | Theo dõi toàn bộ hành trình chăm sóc |
| Mobile {#screen-mobile-account} | Inbox thông báo, tùy chọn push, profile, người thân, hỗ trợ | Kiểm soát dữ liệu và kênh liên hệ |
| Mobile {#screen-mobile-chatbot} | Chatbot nổi | Tư vấn thông tin và chuyển sang hành động có kiểm tra lại |
| Dashboard {#screen-dashboard-operations} | Tổng quan, lịch hẹn, lịch bác sĩ, tư vấn | Vận hành hàng ngày theo hàng đợi |
| Dashboard {#screen-dashboard-clinical} | Hồ sơ khám, đơn thuốc, hóa đơn | Tách luồng lâm sàng và tài chính nhưng liên kết theo lịch |
| Dashboard {#screen-dashboard-admin} | Danh mục, thông báo, chatbot, nhân sự, cấu hình | Quản trị nội dung, tương tác và hệ thống |

## Ngôn ngữ thiết kế thống nhất nên ra sao? {#visual-system}

| Lớp thiết kế | Quy chuẩn mục tiêu | Token hiện có |
| --- | --- | --- |
| Thương hiệu | Y tế tin cậy, hiện đại, nhẹ và không lạnh lẽo | Teal `#087A73`, teal đậm `#075B58`, mint `#2E9F82` |
| Nền và chữ | Nền sáng dịu, tương phản rõ, tránh trắng xanh chói toàn màn | Ink `#173033`, canvas `#F7F9FC`, border `#DCE8E5` |
| Điểm nhấn | Dùng tiết chế cho ưu đãi, bước quan trọng và badge | Warm signal `#F2B66D` |
| Trạng thái | Màu luôn đi cùng nhãn và biểu tượng | Success, warning, danger, info từ `AppPalette` |
| Khoảng cách | Nhịp 4–8–12–16–20–24–32; card dùng khoảng thở nhất quán | `AppSpacing` |
| Hình khối | Card bo 18, hero bo 24, pill chỉ dành cho chip và trạng thái | `AppRadius` |
| Chạm | Mọi nút và vùng chạm tối thiểu 48; CTA chính cao 56 | `AppSize` |
| Chuyển động | 160–350 ms, phục vụ phản hồi và định hướng | `AppMotion`; tôn trọng reduced motion |

Thiết kế Web nên hấp thụ hệ token này thay vì tiếp tục dùng nhiều mã màu rời rạc. Dashboard có thể trung tính và dày hơn Mobile, nhưng phải giữ cùng hệ trạng thái và cách gọi nghiệp vụ.

## Trạng thái UI nào phải được thiết kế, không chỉ màn hình “đẹp”? {#ui-states}

| Trạng thái | Cách thể hiện bắt buộc | Hành động phục hồi |
| --- | --- | --- |
| Loading lần đầu | Skeleton cùng hình dạng nội dung | Không làm nhảy bố cục |
| Làm mới nền | Giữ nội dung cũ và báo tiến trình nhỏ | Không khóa toàn màn |
| Empty | Giải thích vì sao trống theo ngữ cảnh | CTA phù hợp như “Đặt lịch” hoặc “Đổi bộ lọc” |
| Mạng yếu hoặc mất mạng | Giữ dữ liệu còn dùng được, báo rõ dữ liệu có thể cũ | Thử lại; không tự đăng xuất |
| Lỗi validation | Đặt thông báo cạnh trường và tóm tắt ở bước | Giữ dữ liệu người dùng đã nhập |
| Phiên hết hạn | Giải thích ngắn, chuyển OTP, giữ `returnTo` | Quay lại đúng tác vụ sau đăng nhập |
| Xung đột slot | Nêu slot vừa hết, không đổ lỗi người dùng | Tải lại slot và đề xuất lựa chọn gần nhất |
| Thành công | Xác nhận kết quả, mã tham chiếu và bước tiếp theo | Xem chi tiết hoặc về đúng hub |

@callout level=warning title="Thông tin y tế và lỗi hệ thống"
| Không đưa OTP, token, số điện thoại đầy đủ hoặc dữ liệu khám vào log, toast kỹ thuật hay analytics. UI chỉ hiển thị `requestId` khi người dùng cần cung cấp cho hỗ trợ. |

## Những điểm cần ưu tiên khi tái thiết kế {#design-priorities}

| Ưu tiên | Hiện trạng quan sát từ mã nguồn | Hướng thiết kế |
| --- | --- | --- |
| P0 {#priority-public-shell} | Các trang Public bên trong dùng header rút gọn, khác Trang chủ | Tạo một public shell thống nhất: header, search, footer, chatbot và dock hỗ trợ |
| P0 {#priority-floating-actions} | Nhiều nút nổi có thể chồng form hoặc nội dung | Gom tư vấn, gọi điện, chatbot và lên đầu trang vào một dock có breakpoint |
| P0 {#priority-booking-wizard} | Booking Web dài và chưa thể hiện rõ từng bước | Dùng wizard thực: dịch vụ → người khám → thời gian → OTP → kết quả |
| P0 {#priority-accessibility} | Hai select booking chưa có nhãn hỗ trợ đầy đủ | Mọi input có label, description, error và focus state |
| P1 {#priority-home-length} | Trang chủ Web rất dài, nhiều section cạnh tranh chú ý | Cá nhân hóa thứ tự; giảm section mặc định; dùng “Xem tất cả” cho danh mục |
| P1 {#priority-upcoming-appointment} | Mobile cần nêu bật lịch gần nhất và QR | Sau đăng nhập, ưu tiên appointment card có trạng thái và việc tiếp theo |
| P1 {#priority-doctor-grid} | Lưới bác sĩ ở breakpoint hẹp dễ chật | Dùng một cột đến khi card đủ rộng; CTA không ép chữ |
| P1 {#priority-shared-tokens} | Màu Web và Mobile chưa hoàn toàn cùng token | Dùng semantic token chung, không đồng bộ bằng sao chép mã màu rời |
| P2 {#priority-web-portal} | Web chưa có patient portal tương đương Mobile | Không vẽ tính năng này như đã tồn tại; chỉ đề xuất như phase mở rộng |
| P2 {#priority-release-capabilities} | Payment thật và push iOS còn phụ thuộc cấu hình phát hành | Thiết kế capability-aware; ẩn CTA chưa khả dụng thay vì tạo dead end |

## AI thiết kế phải bàn giao những gì? {#designer-output}

- [ ] Sitemap riêng cho Web công khai, Mobile và Dashboard; chỉ rõ route dùng chung dữ liệu.
- [ ] User flow cho khách đặt lịch, bệnh nhân đặt cho người thân và nhân viên tiếp nhận.
- [ ] Wireframe low-fidelity trước khi làm visual high-fidelity.
- [ ] Component inventory dùng chung: card lịch, doctor card, package card, status badge, filter, form field, empty state và confirmation.
- [ ] Ma trận trạng thái cho mỗi màn: loading, refreshing, empty, error, offline, unauthorized, success và conflict.
- [ ] Thiết kế responsive cho mobile, tablet và desktop; không thu nhỏ desktop thành mobile.
- [ ] Kiểm tra tương phản, focus keyboard, screen reader label, touch target và reduced motion.
- [ ] Prototype cho ba luồng quan trọng: đặt lịch, hành trình khám và hóa đơn thanh toán.
- [ ] Developer handoff gồm token, spacing, component variant, nội dung tiếng Việt và mapping sang trạng thái API.

@callout level=note title="Giới hạn của tài liệu"
| Đây là bản chụp kiến trúc và nghiệp vụ từ worktree hiện tại. Tài liệu không xác nhận môi trường production, cấu hình provider thật hoặc chất lượng hình ảnh sau triển khai. |
