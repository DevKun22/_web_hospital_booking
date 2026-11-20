import type { AIChatbotOutput, ChatBookingDraft, SuggestedAction } from "../chatbot.types.js";
import { vary } from "../rules/variants.js";

/** Mở đầu cuộc trò chuyện: các tình huống người khám hay gặp, mỗi nút dẫn tới một hướng khác nhau. */
const starterActions = (): SuggestedAction[] => [
  { type: "VIEW_DEPARTMENTS", label: "Tìm khoa theo triệu chứng", payload: {} },
  { type: "VIEW_PACKAGES", label: "Khám sức khỏe định kỳ", payload: {} },
  { type: "ASK_QUESTION", label: "Khám cho trẻ em", payload: { question: "Khám cho trẻ em thì nên chọn chuyên khoa nào?" } },
  { type: "LOOKUP_APPOINTMENT", label: "Tra cứu lịch hẹn", payload: {} },
];

// Câu trả lời cố định của hệ thống: chào, giới thiệu chức năng, làm lại, cấp cứu, và dự phòng khi không hiểu yêu cầu.
// Không cần AI nên luôn dùng được, kể cả khi AI hoặc kho tri thức lỗi.

export const greetingOutput = (draft: ChatBookingDraft): AIChatbotOutput => ({
  reply: vary([
    "Chào bạn, mình là Kun, trợ lý ảo của DevKunCare. Bạn đang cần tìm bác sĩ, chọn gói khám hay xem lịch trống? Chọn một hướng bên dưới hoặc cứ nhắn cho mình nhé.",
    "Xin chào, Kun đây. Mình giúp bạn tìm chuyên khoa, bác sĩ, gói khám, xem lịch trống và đặt lịch. Bạn muốn bắt đầu từ đâu?",
  ]),
  intent: "GENERAL_HOSPITAL_INFO",
  state: "BOOKING_GUIDE",
  nextStep: "SHOW_BOOKING_GUIDE",
  confidence: 1,
  draft,
  suggestedActions: starterActions(),
});

export const capabilitiesOutput = (draft: ChatBookingDraft): AIChatbotOutput => ({
  reply:
    "Mình có thể gợi ý chuyên khoa từ triệu chứng, tìm bác sĩ và gói khám, xem lịch trống rồi giúp bạn đặt lịch. Mình cũng trả lời về giá, giờ làm việc, chính sách và cách tra cứu lịch hẹn, kèm nguồn để bạn kiểm tra lại. Mình không chẩn đoán bệnh hay kê đơn thay bác sĩ nhé. Bạn muốn bắt đầu từ đâu?",
  intent: "GENERAL_HOSPITAL_INFO",
  state: "BOOKING_GUIDE",
  nextStep: "SHOW_BOOKING_GUIDE",
  confidence: 1,
  draft,
  suggestedActions: starterActions(),
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
    ? "Mình đang hơi chậm một chút nên chưa hiểu hết ý bạn. Bạn chọn một hướng bên dưới, mình hỗ trợ ngay nhé."
    : vary([
        "Mình chưa nắm rõ bạn cần gì. Bạn muốn khám vì một triệu chứng, khám sức khỏe định kỳ, hay đã biết bác sĩ muốn gặp? Chọn một hướng bên dưới hoặc nói cụ thể hơn giúp mình nhé.",
        "Bạn nói rõ hơn một chút giúp mình nhé: bạn đang gặp triệu chứng nào, muốn khám tổng quát, hay muốn đặt lịch với một bác sĩ cụ thể? Mình sẽ hỗ trợ đúng hướng.",
      ]),
  intent: "UNKNOWN",
  state: "BOOKING_GUIDE",
  nextStep: "CHOOSE_DEPARTMENT",
  confidence: 0.3,
  draft,
  suggestedActions: [
    { type: "ASK_QUESTION", label: "Tôi có triệu chứng", payload: { question: "Tôi muốn mô tả triệu chứng để được gợi ý chuyên khoa" } },
    { type: "VIEW_PACKAGES", label: "Khám sức khỏe định kỳ", payload: {} },
    { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} },
  ],
});
