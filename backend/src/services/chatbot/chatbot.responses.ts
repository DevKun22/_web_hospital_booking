import type {
  AIChatbotOutput,
  ChatBookingDraft,
  ChatIntent,
  SuggestedAction,
} from "./chatbot.types.js";

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

  departmentListGuide:
    "Bạn có thể chọn nhanh một chuyên khoa bên dưới để xem gói khám, bác sĩ và lịch trống phù hợp.",

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
      ? `${doctorName} đã được chọn. Đây là các khung giờ còn trống phù hợp.`
      : "Bác sĩ đã được ghi nhận. Đây là các khung giờ còn trống phù hợp.",

  doctorSelectedNoSlots: (doctorName?: string) =>
    doctorName
      ? `${doctorName} đã được chọn. Hiện chưa có lịch trống phù hợp, bạn có thể chọn ngày khác hoặc đổi bác sĩ.`
      : "Bác sĩ đã được ghi nhận. Hiện chưa có lịch trống phù hợp, bạn có thể chọn ngày khác hoặc đổi bác sĩ.",

  slotSelected:
    "Khung giờ này đã được chọn. Bạn có thể bấm đặt lịch ngay để nhập thông tin người khám và xác thực OTP.",

  doctorChange: (hasDoctors: boolean) =>
    hasDoctors
      ? "Đây là một số bác sĩ phù hợp với chuyên khoa đã chọn."
      : "Hiện chưa tìm thấy bác sĩ phù hợp. Bạn có thể đổi chuyên khoa hoặc liên hệ nhân viên hỗ trợ.",

  symptomNeedMoreInfo:
    "Hệ thống đã ghi nhận triệu chứng của bạn. Bạn mô tả thêm vị trí đau, mức độ và thời gian xuất hiện để được gợi ý chuyên khoa phù hợp hơn.",

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
    "Hiện dữ liệu bệnh viện chưa đủ để gợi ý chuyên khoa an toàn. Bạn có thể xem danh sách chuyên khoa hoặc liên hệ nhân viên để được hỗ trợ.",

  departmentSuggestion: (departmentName?: string) =>
    departmentName
      ? `Dựa trên thông tin hiện có, bạn có thể bắt đầu với ${departmentName}. Bạn có thể xem khoa, chọn gói khám hoặc chọn bác sĩ để tiếp tục đặt lịch.`
      : "Bạn có thể chọn một chuyên khoa trước, sau đó hệ thống sẽ gợi ý gói khám, bác sĩ và lịch trống phù hợp.",

  packageSuggestion: (hasPackages: boolean) =>
    hasPackages
      ? "Hệ thống tìm thấy một số gói khám phù hợp. Bạn có thể mở chi tiết gói để xem hạng mục và chọn đặt lịch."
      : "Hiện chưa có gói khám phù hợp với thông tin đã chọn. Bạn có thể chọn chuyên khoa hoặc liên hệ nhân viên để được tư vấn.",

  readyToBook:
    "Hệ thống đã có đủ bác sĩ và khung giờ. Bạn có thể bấm đặt lịch ngay để sang form thông tin người khám và xác thực OTP.",

  slotLookupAfterDateMiss: (dateLabel: string, nearestDateLabel: string) =>
    `Ngày ${dateLabel} chưa có lịch trống phù hợp. Hệ thống tìm thấy lịch gần nhất vào ${nearestDateLabel}, bạn chọn khung giờ phù hợp để tiếp tục đặt lịch.`,

  doctorSlotsFound:
    "Hệ thống tìm thấy một số khung giờ còn trống của bác sĩ này. Bạn chọn khung giờ phù hợp để tiếp tục đặt lịch.",

  nearestSlotsFound:
    "Hệ thống tìm thấy một số lịch trống gần nhất. Bạn chọn khung giờ phù hợp để tiếp tục đặt lịch.",

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

type FAQAnswer = {
  question: string;
  answer: string;
  keywords: string[];
};

type FAQComposeInput = {
  faq: FAQAnswer;
  intent: ChatIntent;
  confidence: number;
  draft: ChatBookingDraft;
};

const buildKnowledgeActions = (intent: ChatIntent): SuggestedAction[] => {
  if (intent === "PAYMENT_GUIDE" || intent === "APPOINTMENT_LOOKUP_GUIDE") {
    return [
      {
        type: "LOOKUP_APPOINTMENT",
        label: "Tra cứu lịch hẹn",
        payload: {},
      },
      {
        type: "CONTACT_STAFF",
        label: "Liên hệ hỗ trợ",
        payload: {},
      },
    ];
  }

  return [
    {
      type: "VIEW_DEPARTMENTS",
      label: "Xem chuyên khoa",
      payload: {},
    },
    {
      type: "CONTACT_STAFF",
      label: "Liên hệ hỗ trợ",
      payload: {},
    },
  ];
};

export const composeFAQOutput = ({
  faq,
  intent,
  confidence,
  draft,
}: FAQComposeInput): AIChatbotOutput => ({
  reply: faq.answer,
  intent,
  state: "BOOKING_GUIDE",
  nextStep:
    intent === "PAYMENT_GUIDE"
      ? "SHOW_PAYMENT_GUIDE"
      : intent === "APPOINTMENT_LOOKUP_GUIDE"
        ? "SHOW_BOOKING_GUIDE"
        : "END",
  confidence,
  draft,
  suggestedActions: buildKnowledgeActions(intent),
});
