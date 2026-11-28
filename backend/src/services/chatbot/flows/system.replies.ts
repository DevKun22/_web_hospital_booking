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
    "Mình có thể gợi ý chuyên khoa từ triệu chứng, tìm bác sĩ và gói khám, xem lịch trống rồi giúp bạn đặt lịch. Mình cũng trả lời về giá, giờ làm việc và chính sách kèm nguồn để bạn kiểm tra lại; khi bạn đã đăng nhập, mình xem và hủy lịch hẹn giúp bạn (luôn hỏi xác nhận trước khi hủy). Mình không chẩn đoán bệnh hay kê đơn thay bác sĩ nhé. Bạn muốn bắt đầu từ đâu?",
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

/** Số cấp cứu quốc gia; luôn có trong câu trả lời cấp cứu, không phụ thuộc dữ liệu cấu hình. */
export const NATIONAL_EMERGENCY_NUMBER = "115";

export const emergencyOutput = (draft: ChatBookingDraft, facilityHotline?: string | null): AIChatbotOutput => ({
  reply: [
    `Triệu chứng bạn kể có thể cần xử lý khẩn cấp. Bạn hãy gọi ngay ${NATIONAL_EMERGENCY_NUMBER} (cấp cứu) hoặc đến cơ sở y tế gần nhất, đừng chờ đặt lịch khám.`,
    facilityHotline ? `Đường dây cấp cứu của cơ sở: ${facilityHotline}.` : null,
    "Nếu có người ở cạnh, hãy nhờ họ hỗ trợ bạn.",
  ]
    .filter(Boolean)
    .join(" "),
  intent: "SYMPTOM_TRIAGE",
  state: "EMERGENCY_CARE",
  nextStep: "EMERGENCY_CARE",
  confidence: 1,
  draft,
  suggestedActions: [
    { type: "EMERGENCY_ADVICE", label: `Gọi ${NATIONAL_EMERGENCY_NUMBER}`, payload: { phone: NATIONAL_EMERGENCY_NUMBER } },
    ...(facilityHotline ? [{ type: "EMERGENCY_ADVICE" as const, label: "Gọi cấp cứu của cơ sở", payload: { phone: facilityHotline } }] : []),
  ],
});

/** Đang đặt lịch dở (đã chọn khoa/bác sĩ/giờ) mà hỏi sang chuyện khác: luôn có nút quay lại đúng chỗ đang dừng. */
export const resumeBookingAction = (draft: ChatBookingDraft): SuggestedAction[] =>
  draft.departmentId || draft.packageId || draft.doctorId || draft.timeSlotId
    ? [{ type: "RESUME_BOOKING", label: "Tiếp tục đặt lịch", payload: {} }]
    : [];

export const fallbackOutput = (
  draft: ChatBookingDraft,
  aiUnavailable: boolean,
  retryMessage?: string,
): AIChatbotOutput => ({
  // Lỗi tạm thời của AI khác với "Kun chưa hiểu ý": nói rõ là do Kun đang bận và cho thử lại đúng câu vừa gửi.
  reply: aiUnavailable
    ? "Kun đang bận một chút nên chưa xử lý được câu này. Bạn bấm \"Thử lại\" sau ít giây, hoặc chọn một hướng bên dưới nhé."
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
    ...(aiUnavailable && retryMessage?.trim()
      ? [{ type: "ASK_QUESTION" as const, label: "Thử lại", payload: { question: retryMessage.trim().slice(0, 500) } }]
      : []),
    ...resumeBookingAction(draft),
    { type: "ASK_QUESTION", label: "Tôi có triệu chứng", payload: { question: "Tôi muốn mô tả triệu chứng để được gợi ý chuyên khoa" } },
    { type: "VIEW_PACKAGES", label: "Khám sức khỏe định kỳ", payload: {} },
    { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} },
  ],
});
