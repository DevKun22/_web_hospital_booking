import { vary } from "./rules/variants.js";

// Mọi câu cố định của Kun nằm ở đây và dùng một giọng: xưng "mình", gọi người dùng là "bạn", nói chủ động ("mình tìm được…") thay vì
// bị động ("đã được ghi nhận") và không nhắc "hệ thống". Test `chatbotTone` giữ quy ước này. Số liệu, giờ trống, giá không nằm trong
// các câu này: chúng đến từ dữ liệu thật (thẻ kết quả) hoặc từ AI có kiểm nguồn.

export const chatbotReplies = {
  changeDatePrompt: "Bạn muốn khám ngày nào? Bạn cứ nói tự nhiên, ví dụ \"ngày mai\", \"sáng thứ hai tuần sau\" hoặc \"10/6\".",

  departmentSelected: (departmentName?: string) =>
    departmentName
      ? `Mình chọn ${departmentName} cho bạn rồi. Bạn muốn khám theo gói hay chọn thẳng một bác sĩ?`
      : "Mình ghi lại chuyên khoa bạn chọn rồi. Bạn muốn khám theo gói hay chọn thẳng một bác sĩ?",

  get departmentListGuide() {
    return vary([
      "Bạn đang gặp vấn đề gì? Cứ mô tả vài triệu chứng (ví dụ \"đau đầu, chóng mặt mấy ngày nay\"), mình sẽ gợi ý chuyên khoa phù hợp. Nếu đã biết mình cần khám gì, bạn chọn nhanh một chuyên khoa bên dưới.",
      "Bạn kể mình nghe triệu chứng đang gặp nhé, ví dụ \"ho kéo dài, hay mệt\", mình sẽ gợi ý chuyên khoa hợp lý. Còn nếu đã biết cần khám khoa nào thì bạn chọn ngay bên dưới.",
      "Mình có thể gợi ý chuyên khoa nếu bạn mô tả triệu chứng (bạn bị từ bao giờ, ở đâu càng rõ càng tốt). Hoặc bạn chọn thẳng một chuyên khoa dưới đây.",
    ]);
  },

  packageList: (hasPackages: boolean) =>
    hasPackages
      ? vary([
          "Mình tìm được một số gói khám đang mở. Bạn chọn gói phù hợp, mình sẽ cho bạn xem bác sĩ và lịch trống.",
          "Đây là các gói khám đang mở. Bạn chọn một gói để xem bác sĩ và lịch trống nhé.",
        ])
      : "Hiện chưa có gói khám phù hợp với chuyên khoa bạn chọn. Bạn thử chuyên khoa khác, hoặc nhờ nhân viên hỗ trợ nhé.",

  packageSelected: (packageName?: string) =>
    packageName
      ? `Mình chọn ${packageName} cho bạn rồi. Giờ bạn chọn bác sĩ hoặc một khung giờ trống để tiếp tục nhé.`
      : "Mình ghi lại gói khám bạn chọn rồi. Giờ bạn chọn bác sĩ hoặc một khung giờ trống để tiếp tục nhé.",

  packageSelectedWithSlots: (packageName?: string) =>
    packageName
      ? `Mình chọn ${packageName} cho bạn rồi. Đây là những khung giờ gần nhất phù hợp với gói này.`
      : "Mình ghi lại gói khám bạn chọn rồi. Đây là những khung giờ gần nhất phù hợp.",

  doctorSlotFoundAfterDateMiss: (dateLabel: string, nearestDateLabel: string) =>
    vary([
      `Bác sĩ này chưa có giờ trống ngày ${dateLabel}. Lịch gần nhất là ngày ${nearestDateLabel}, bạn xem các giờ bên dưới nhé.`,
      `Ngày ${dateLabel} bác sĩ chưa còn giờ trống, mình tìm được lịch sớm nhất vào ${nearestDateLabel}. Bạn chọn giờ phù hợp nhé.`,
    ]),

  doctorSelectedWithSlots: (doctorName?: string) =>
    doctorName
      ? vary([
          `Mình đã chọn ${doctorName} cho bạn. Đây là các khung giờ còn trống, bạn chọn giờ thuận tiện nhé.`,
          `${doctorName} đang còn lịch vào những giờ này, bạn chọn giờ phù hợp nhé.`,
          `Đã chọn ${doctorName}. Bạn xem các khung giờ còn trống bên dưới và chọn một giờ nhé.`,
        ])
      : "Mình ghi lại bác sĩ bạn chọn rồi. Đây là các khung giờ còn trống, bạn chọn một giờ nhé.",

  doctorSelectedNoSlots: (doctorName?: string) =>
    doctorName
      ? `Mình đã chọn ${doctorName}, nhưng bác sĩ chưa còn giờ trống phù hợp. Bạn thử chọn ngày khác hoặc đổi bác sĩ nhé.`
      : "Mình ghi lại bác sĩ bạn chọn rồi, nhưng chưa còn giờ trống phù hợp. Bạn thử chọn ngày khác hoặc đổi bác sĩ nhé.",

  get slotSelected() {
    return vary([
      "Bạn đã chọn khung giờ này. Khung giờ CHƯA được giữ chỗ: bạn bấm đặt lịch để nhập thông tin người khám và xác thực OTP, lịch chỉ được ghi nhận sau bước đó.",
      "Mình ghi lại khung giờ bạn chọn (chưa giữ chỗ). Bạn bấm đặt lịch, điền thông tin người khám rồi xác thực OTP là xong.",
    ]);
  },

  doctorChange: (hasDoctors: boolean) =>
    hasDoctors
      ? "Đây là các bác sĩ phù hợp với chuyên khoa bạn chọn, bạn chọn một người nhé."
      : "Mình chưa tìm thấy bác sĩ phù hợp. Bạn thử đổi chuyên khoa, hoặc nhờ nhân viên hỗ trợ nhé.",

  triageMatched: (departmentName: string, triageDescription?: string | null) =>
    [
      `Dựa trên điều bạn kể, bạn có thể bắt đầu với ${departmentName} để được thăm khám ban đầu.`,
      triageDescription || undefined,
      "Đây chỉ là gợi ý định hướng, không thay thế chẩn đoán của bác sĩ.",
    ]
      .filter(Boolean)
      .join(" "),

  triageFallback: (departmentName: string, triageDescription?: string | null) =>
    [
      "Mình chưa đủ thông tin để chọn một chuyên khoa cụ thể cho bạn.",
      `Bạn có thể bắt đầu tại ${departmentName} để được đánh giá ban đầu.`,
      triageDescription || undefined,
      "Đây chỉ là gợi ý định hướng, không thay thế chẩn đoán của bác sĩ.",
    ]
      .filter(Boolean)
      .join(" "),

  triageClarification: (question: string) => `Mình cần thêm một chút thông tin để gợi ý đúng hơn. ${question}`,

  triageNoMatch:
    "Mình chưa đủ thông tin để gợi ý chuyên khoa một cách an toàn. Bạn xem danh sách chuyên khoa, hoặc nhờ nhân viên hỗ trợ nhé.",

  departmentSuggestion: (departmentName?: string) =>
    departmentName
      ? `Bạn có thể bắt đầu với ${departmentName}. Bạn xem khoa, chọn gói khám hoặc chọn bác sĩ để tiếp tục đặt lịch nhé.`
      : "Bạn chọn một chuyên khoa trước nhé, mình sẽ gợi ý gói khám, bác sĩ và lịch trống phù hợp.",

  packageSuggestion: (hasPackages: boolean) =>
    hasPackages
      ? "Mình tìm được vài gói khám phù hợp. Bạn mở chi tiết gói để xem hạng mục và chọn đặt lịch nhé."
      : "Hiện chưa có gói khám phù hợp với điều bạn chọn. Bạn thử chuyên khoa khác, hoặc nhờ nhân viên tư vấn nhé.",

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
      ? "Bác sĩ này chưa có giờ trống vào ngày bạn chọn. Bạn thử đổi ngày khám, hoặc nhờ nhân viên hỗ trợ sắp lịch nhé."
      : "Bác sĩ này chưa có giờ trống gần đây. Bạn thử chọn ngày khác, hoặc nhờ nhân viên hỗ trợ sắp lịch nhé.",

  chooseDoctorForSlots: (hasDate: boolean) =>
    hasDate
      ? "Mình chưa thấy giờ trống vào ngày bạn chọn. Bạn thử chọn một bác sĩ để mình kiểm tra kỹ hơn, hoặc đổi ngày khám nhé."
      : "Bạn chọn một bác sĩ trước nhé, mình sẽ cho bạn xem các giờ còn trống để đặt khám.",

  noMatchingDoctorOrSlot:
    "Mình chưa tìm thấy bác sĩ hoặc giờ trống phù hợp với điều bạn chọn. Bạn thử đổi chuyên khoa, đổi ngày, hoặc nhờ nhân viên hỗ trợ nhé.",
};
