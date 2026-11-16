import type { AIChatbotOutput, ChatBookingDraft } from "../chatbot.types.js";

// Câu trả lời cố định của hệ thống: chào, giới thiệu chức năng, làm lại, cấp cứu, và dự phòng khi không hiểu yêu cầu.
// Không cần AI nên luôn dùng được, kể cả khi AI hoặc kho tri thức lỗi.

export const greetingOutput = (draft: ChatBookingDraft): AIChatbotOutput => ({
  reply:
    "Xin chào, hệ thống có thể hỗ trợ bạn tìm chuyên khoa, gói khám, bác sĩ, lịch trống hoặc tra cứu lịch hẹn.",
  intent: "GENERAL_HOSPITAL_INFO",
  state: "BOOKING_GUIDE",
  nextStep: "SHOW_BOOKING_GUIDE",
  confidence: 1,
  draft,
  suggestedActions: [
    { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} },
    { type: "VIEW_PACKAGES", label: "Xem gói khám", payload: {} },
    {
      type: "LOOKUP_APPOINTMENT",
      label: "Tra cứu lịch hẹn",
      payload: {},
    },
  ],
});

export const capabilitiesOutput = (draft: ChatBookingDraft): AIChatbotOutput => ({
  reply:
    "Tôi có thể giúp bạn tìm chuyên khoa, gói khám, bác sĩ và lịch trống; đồng thời hỗ trợ đặt lịch hoặc hướng dẫn tra cứu lịch hẹn. Bạn muốn bắt đầu từ đâu?",
  intent: "GENERAL_HOSPITAL_INFO",
  state: "BOOKING_GUIDE",
  nextStep: "SHOW_BOOKING_GUIDE",
  confidence: 1,
  draft,
  suggestedActions: [
    { type: "VIEW_DEPARTMENTS", label: "Tìm chuyên khoa", payload: {} },
    { type: "VIEW_PACKAGES", label: "Xem gói khám", payload: {} },
    {
      type: "LOOKUP_APPOINTMENT",
      label: "Tra cứu lịch hẹn",
      payload: {},
    },
  ],
});

export const resetOutput = (): AIChatbotOutput => ({
  reply:
    "Thông tin lựa chọn trước đó đã được xóa. Bạn có thể bắt đầu lại bằng cách chọn chuyên khoa hoặc mô tả nhu cầu khám.",
  intent: "BOOKING_START",
  state: "BOOKING_GUIDE",
  nextStep: "CHOOSE_DEPARTMENT",
  confidence: 1,
  draft: {},
  suggestedActions: [
    { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} },
    { type: "VIEW_PACKAGES", label: "Xem gói khám", payload: {} },
  ],
});

export const emergencyOutput = (draft: ChatBookingDraft): AIChatbotOutput => ({
  reply:
    "Triệu chứng bạn mô tả có thể cần được xử lý khẩn cấp. Hãy đến cơ sở y tế gần nhất hoặc gọi cấp cứu ngay để được hỗ trợ kịp thời.",
  intent: "SYMPTOM_TRIAGE",
  state: "EMERGENCY_CARE",
  nextStep: "EMERGENCY_CARE",
  confidence: 1,
  draft,
  suggestedActions: [
    {
      type: "EMERGENCY_ADVICE",
      label: "Đến cơ sở y tế gần nhất",
      payload: {},
    },
    {
      type: "CONTACT_STAFF",
      label: "Liên hệ nhân viên hỗ trợ",
      payload: {},
    },
  ],
});

export const fallbackOutput = (
  draft: ChatBookingDraft,
  aiUnavailable: boolean,
): AIChatbotOutput => ({
  reply: aiUnavailable
    ? "AI đang tạm thời không phản hồi. Hệ thống vẫn có thể hỗ trợ bạn qua các lựa chọn bên dưới."
    : "Hệ thống chưa xác định rõ yêu cầu. Bạn có thể chọn một chức năng bên dưới hoặc mô tả cụ thể hơn.",
  intent: "UNKNOWN",
  state: "BOOKING_GUIDE",
  nextStep: "CHOOSE_DEPARTMENT",
  confidence: 0.3,
  draft,
  suggestedActions: [
    { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} },
    { type: "VIEW_PACKAGES", label: "Xem gói khám", payload: {} },
    {
      type: "LOOKUP_APPOINTMENT",
      label: "Tra cứu lịch hẹn",
      payload: {},
    },
  ],
});
