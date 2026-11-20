import { vary } from "./rules/variants.js";

export const chatbotReplies = {
  appointmentLookupGuide:
    "Bạn có thể tra cứu lịch hẹn bằng mã đặt lịch và số điện thoại. Nếu quên mã lịch, hãy dùng tab quên mã để nhận OTP và xem lịch gần đây.",

  paymentGuide:
    "Bạn có thể thanh toán theo hướng dẫn trên hóa đơn hoặc liên hệ nhân viên nếu cần kiểm tra giao dịch. Nếu đã có mã hóa đơn, hãy mở trang tra cứu lịch hẹn để xem thông tin thanh toán.",

  changeDatePrompt:
    "Bạn muốn đổi ngày khám. Hãy nhập ngày mong muốn, ví dụ: hôm nay, ngày mai hoặc 2026-06-10.",

  departmentSelected: (departmentName?: string) =>
    departmentName
      ? `${departmentName} đã được chọn. Bạn muốn chọn gói khám hay khám theo phí của bác sĩ?`
      : "Chuyên khoa đã được ghi nhận. Bạn muốn chọn gói khám hay khám theo phí của bác sĩ?",

  get departmentListGuide() {
    return vary([
      "Bạn đang gặp vấn đề gì? Cứ mô tả vài triệu chứng (ví dụ \"đau đầu, chóng mặt mấy ngày nay\"), mình sẽ gợi ý chuyên khoa phù hợp. Nếu đã biết mình cần khám gì, bạn chọn nhanh một chuyên khoa bên dưới.",
      "Bạn kể mình nghe triệu chứng đang gặp nhé, ví dụ \"ho kéo dài, hay mệt\", mình sẽ gợi ý chuyên khoa hợp lý. Còn nếu đã biết cần khám khoa nào thì bạn chọn ngay bên dưới.",
      "Mình có thể gợi ý chuyên khoa nếu bạn mô tả triệu chứng (bạn bị từ bao giờ, ở đâu càng rõ càng tốt). Hoặc bạn chọn thẳng một chuyên khoa dưới đây.",
    ]);
  },

  packageList: (hasPackages: boolean) =>
    hasPackages
      ? "Hệ thống tìm thấy một số gói khám đang hoạt động. Bạn chọn gói phù hợp để xem bác sĩ và lịch trống."
      : "Hiện chưa có gói khám phù hợp với chuyên khoa đã chọn. Bạn có thể chọn chuyên khoa khác hoặc liên hệ hỗ trợ.",

  packageSelected: (packageName?: string) =>
    packageName
      ? `${packageName} đã được chọn. Bạn chọn bác sĩ hoặc khung giờ trống để tiếp tục đặt lịch.`
      : "Gói khám đã được ghi nhận. Bạn chọn bác sĩ hoặc khung giờ trống để tiếp tục đặt lịch.",

  packageSelectedWithSlots: (packageName?: string) =>
    packageName
      ? `${packageName} đã được chọn. Đây là các khung giờ phù hợp gần nhất.`
      : "Gói khám đã được ghi nhận. Đây là các khung giờ phù hợp gần nhất.",
  doctorSlotFoundAfterDateMiss: (dateLabel: string, nearestDateLabel: string) =>
    `Bác sĩ này chưa có lịch trống ngày ${dateLabel}. Hệ thống tìm thấy lịch gần nhất vào ${nearestDateLabel}, bạn có thể chọn khung giờ phù hợp.`,

  doctorSelectedWithSlots: (doctorName?: string) =>
    doctorName
      ? vary([
          `Mình đã chọn ${doctorName} cho bạn. Đây là các khung giờ còn trống, bạn chọn giờ thuận tiện nhé.`,
          `${doctorName} đang còn lịch vào những giờ này, bạn chọn giờ phù hợp nhé.`,
          `Đã chọn ${doctorName}. Bạn xem các khung giờ còn trống bên dưới và chọn một giờ nhé.`,
        ])
      : "Bác sĩ đã được ghi nhận. Đây là các khung giờ còn trống phù hợp.",

  doctorSelectedNoSlots: (doctorName?: string) =>
    doctorName
      ? `${doctorName} đã được chọn. Hiện chưa có lịch trống phù hợp, bạn có thể chọn ngày khác hoặc đổi bác sĩ.`
      : "Bác sĩ đã được ghi nhận. Hiện chưa có lịch trống phù hợp, bạn có thể chọn ngày khác hoặc đổi bác sĩ.",

  get slotSelected() {
    return vary([
      "Mình đã giữ khung giờ này cho bạn xem. Bấm đặt lịch để nhập thông tin người khám và xác thực OTP nhé.",
      "Khung giờ này ổn rồi. Bạn bấm đặt lịch để điền thông tin người khám, rồi xác thực OTP là xong.",
    ]);
  },

  doctorChange: (hasDoctors: boolean) =>
    hasDoctors
      ? "Đây là một số bác sĩ phù hợp với chuyên khoa đã chọn."
      : "Hiện chưa tìm thấy bác sĩ phù hợp. Bạn có thể đổi chuyên khoa hoặc liên hệ nhân viên hỗ trợ.",

  triageMatched: (
    departmentName: string,
    triageDescription?: string | null,
  ) =>
    [
      `Dựa trên thông tin bạn cung cấp, ${departmentName} là chuyên khoa được gợi ý để thăm khám ban đầu.`,
      triageDescription || undefined,
      "Đây là gợi ý định hướng, không thay thế chẩn đoán của bác sĩ.",
    ]
      .filter(Boolean)
      .join(" "),

  triageFallback: (
    departmentName: string,
    triageDescription?: string | null,
  ) =>
    [
      "Hệ thống chưa có dữ liệu đủ phù hợp để gợi ý một chuyên khoa cụ thể.",
      `Bạn có thể bắt đầu tại ${departmentName} để được đánh giá ban đầu.`,
      triageDescription || undefined,
      "Đây là gợi ý định hướng, không thay thế chẩn đoán của bác sĩ.",
    ]
      .filter(Boolean)
      .join(" "),

  triageClarification: (question: string) =>
    `Mình cần thêm một chút thông tin để gợi ý phù hợp hơn. ${question}`,

  triageNoMatch:
    "Hiện dữ liệu cơ sở khám chưa đủ để gợi ý chuyên khoa an toàn. Bạn có thể xem danh sách chuyên khoa hoặc liên hệ nhân viên để được hỗ trợ.",

  departmentSuggestion: (departmentName?: string) =>
    departmentName
      ? `Dựa trên thông tin hiện có, bạn có thể bắt đầu với ${departmentName}. Bạn có thể xem khoa, chọn gói khám hoặc chọn bác sĩ để tiếp tục đặt lịch.`
      : "Bạn có thể chọn một chuyên khoa trước, sau đó hệ thống sẽ gợi ý gói khám, bác sĩ và lịch trống phù hợp.",

  packageSuggestion: (hasPackages: boolean) =>
    hasPackages
      ? "Hệ thống tìm thấy một số gói khám phù hợp. Bạn có thể mở chi tiết gói để xem hạng mục và chọn đặt lịch."
      : "Hiện chưa có gói khám phù hợp với thông tin đã chọn. Bạn có thể chọn chuyên khoa hoặc liên hệ nhân viên để được tư vấn.",

  get readyToBook() {
    return vary([
      "Đã đủ bác sĩ và khung giờ rồi. Bạn bấm đặt lịch để điền thông tin người khám và xác thực OTP nhé.",
      "Mọi thứ đã sẵn sàng. Bạn bấm đặt lịch để sang bước nhập thông tin và xác thực OTP.",
    ]);
  },

  slotLookupAfterDateMiss: (dateLabel: string, nearestDateLabel: string) =>
    vary([
      `Ngày ${dateLabel} đã hết lịch trống rồi. Lịch gần nhất là ngày ${nearestDateLabel}, bạn xem các giờ bên dưới nhé.`,
      `Tiếc là ngày ${dateLabel} chưa còn giờ phù hợp. Mình tìm được lịch sớm nhất vào ${nearestDateLabel}, bạn chọn giờ nhé.`,
    ]),

  get doctorSlotsFound() {
    return vary([
      "Bác sĩ này còn một số khung giờ trống, bạn chọn giờ thuận tiện để tiếp tục đặt lịch nhé.",
      "Đây là những giờ còn trống của bác sĩ, bạn chọn một giờ nhé.",
    ]);
  },

  get nearestSlotsFound() {
    return vary([
      "Đây là các lịch trống gần nhất, bạn chọn giờ phù hợp để tiếp tục đặt lịch nhé.",
      "Mình tìm được vài lịch còn trống sớm nhất, bạn xem và chọn giờ nhé.",
    ]);
  },

  noDoctorSlots: (hasDate: boolean) =>
    hasDate
      ? "Bác sĩ này chưa có lịch trống vào ngày đã chọn. Bạn có thể đổi ngày khám hoặc liên hệ nhân viên để được hỗ trợ sắp lịch."
      : "Bác sĩ này hiện chưa có lịch trống gần nhất. Bạn có thể chọn ngày khám khác hoặc liên hệ nhân viên để được hỗ trợ sắp lịch.",

  chooseDoctorForSlots: (hasDate: boolean) =>
    hasDate
      ? "Hiện chưa thấy lịch trống vào ngày đã chọn. Bạn có thể chọn một bác sĩ để kiểm tra kỹ hơn hoặc đổi ngày khám."
      : "Bạn có thể chọn một bác sĩ phù hợp trước, sau đó hệ thống sẽ hiển thị lịch trống để đặt khám.",

  noMatchingDoctorOrSlot:
    "Hiện chưa tìm thấy bác sĩ hoặc lịch trống phù hợp với thông tin đã chọn. Bạn có thể đổi chuyên khoa, đổi ngày hoặc liên hệ nhân viên hỗ trợ.",

};
