import type { AIChatbotOutput, ChatBookingDraft } from "../chatbot.types.js";

// Câu trả lời cố định của hệ thống: chào, giới thiệu chức năng, làm lại, cấp cứu, và dự phòng khi không hiểu yêu cầu.
// Không cần AI nên luôn dùng được, kể cả khi AI hoặc kho tri thức lỗi.

export const greetingOutput = (draft: ChatBookingDraft): AIChatbotOutput => ({
  reply:
    "Chào bạn, mình là Kun, trợ lý ảo của DevKunCare. Mình có thể giúp bạn tìm chuyên khoa, gói khám, bác sĩ, lịch trống hoặc tra cứu lịch hẹn. Bạn cần gì nào?",
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
    "Mình có thể giúp bạn tìm chuyên khoa, gói khám, bác sĩ và lịch trống, hỗ trợ đặt lịch, trả lời các câu hỏi về giá, giờ làm việc, chính sách, và hướng dẫn tra cứu lịch hẹn. Bạn muốn bắt đầu từ đâu?",
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
    "Mình đã xóa các lựa chọn trước đó. Bạn chọn một chuyên khoa hoặc kể cho mình nghe nhu cầu khám nhé.",
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
    "Triệu chứng bạn kể có thể cần được xử lý khẩn cấp. Bạn hãy gọi cấp cứu hoặc đến cơ sở y tế gần nhất ngay để được hỗ trợ kịp thời.",
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
    ? "Mình đang hơi chậm một chút nên chưa hiểu hết ý bạn. Bạn chọn một mục bên dưới, mình hỗ trợ ngay nhé."
    : "Mình chưa hiểu rõ bạn cần gì. Bạn chọn một mục bên dưới hoặc nói cụ thể hơn giúp mình nhé.",
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
