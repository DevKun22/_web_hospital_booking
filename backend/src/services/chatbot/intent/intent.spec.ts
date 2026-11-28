import type { ChatOperation } from "../chatbot.types.js";

// Đặc tả ý định tập trung: một chỗ duy nhất mô tả mỗi thao tác chatbot hiểu được, handler xử lý nó, có cần đăng nhập không
// và ví dụ câu nói. Lời nhắc cho AI phân tích ý định được dựng từ đây, bộ điều phối định tuyến theo `handler` ở đây,
// nên thêm hoặc sửa một ý định chỉ cần sửa tệp này và handler tương ứng.

/** Nhóm xử lý: SYSTEM câu cố định; INFO trả lời từ kho tri thức (RAG); BOOKING luồng đặt lịch từ DB; APPOINTMENT lịch hẹn cá nhân. */
export type IntentHandler = "SYSTEM" | "INFO" | "BOOKING" | "APPOINTMENT" | "FALLBACK";

export type IntentSpec = {
  operation: ChatOperation;
  handler: IntentHandler;
  description: string;
  /** Cần người khám đã đăng nhập (token hợp lệ) mới thực hiện được. */
  requiresAuth: boolean;
  /** Thao tác làm thay đổi dữ liệu thật: luôn phải xác nhận lại trước khi làm. */
  mutates: boolean;
  examples: string[];
};

export const INTENT_SPECS: readonly IntentSpec[] = [
  {
    operation: "GREETING",
    handler: "SYSTEM",
    description: "Lời chào, mở đầu cuộc trò chuyện, không kèm yêu cầu nào khác.",
    requiresAuth: false,
    mutates: false,
    examples: ["xin chào", "chào Kun", "alo"],
  },
  {
    operation: "ASK_CAPABILITIES",
    handler: "SYSTEM",
    description: "Hỏi trợ lý làm được gì, hỗ trợ những gì.",
    requiresAuth: false,
    mutates: false,
    examples: ["bạn giúp được gì", "Kun có chức năng gì"],
  },
  {
    operation: "RESET_FLOW",
    handler: "SYSTEM",
    description: "Muốn bỏ hết lựa chọn đang có và bắt đầu lại.",
    requiresAuth: false,
    mutates: false,
    examples: ["làm lại từ đầu", "xóa hết lựa chọn"],
  },
  {
    operation: "ASK_INFORMATION",
    handler: "INFO",
    description:
      "Hỏi thông tin chung về cơ sở khám: giá, giờ mở cửa, địa chỉ, thông tin bác sĩ, gói khám, chuyên khoa, kiến thức sức khỏe đã xuất bản.",
    requiresAuth: false,
    mutates: false,
    examples: ["gói khám tổng quát giá bao nhiêu", "cơ sở mở cửa mấy giờ", "bác sĩ An có kinh nghiệm gì"],
  },
  {
    operation: "ASK_POLICY",
    handler: "INFO",
    description: "Hỏi chính sách và quy trình: hủy lịch, đổi lịch, thanh toán, hoàn tiền, bảo hiểm, OTP, quyền riêng tư.",
    requiresAuth: false,
    mutates: false,
    examples: ["hủy lịch trước bao lâu", "thanh toán bằng cách nào", "có nhận bảo hiểm y tế không"],
  },
  {
    operation: "SEARCH_DEPARTMENT",
    handler: "BOOKING",
    description: "Tìm chuyên khoa, hoặc mô tả triệu chứng để được gợi ý chuyên khoa.",
    requiresAuth: false,
    mutates: false,
    examples: ["tôi bị đau đầu mấy ngày nay nên khám khoa nào", "có những chuyên khoa nào"],
  },
  {
    operation: "SEARCH_DOCTOR",
    handler: "BOOKING",
    description: "Tìm hoặc chọn bác sĩ.",
    requiresAuth: false,
    mutates: false,
    examples: ["bác sĩ nào khám tim mạch", "tôi muốn khám với bác sĩ Minh"],
  },
  {
    operation: "SEARCH_PACKAGE",
    handler: "BOOKING",
    description: "Tìm hoặc chọn gói khám.",
    requiresAuth: false,
    mutates: false,
    examples: ["có gói khám sức khỏe định kỳ không", "chọn gói tầm soát tim mạch"],
  },
  {
    operation: "SEARCH_SLOT",
    handler: "BOOKING",
    description: "Hỏi lịch trống, giờ còn trống theo ngày, buổi hoặc giờ cụ thể.",
    requiresAuth: false,
    mutates: false,
    examples: ["sáng mai còn lịch không", "thứ hai tuần sau 9 giờ còn trống không", "chiều nay bác sĩ An rảnh không"],
  },
  {
    operation: "START_BOOKING",
    handler: "BOOKING",
    description: "Muốn đặt lịch khám (chưa nêu rõ hoặc đã nêu khoa, bác sĩ, ngày giờ).",
    requiresAuth: false,
    mutates: false,
    examples: ["tôi muốn đặt lịch khám", "đặt lịch khám da liễu ngày mai"],
  },
  {
    operation: "CHANGE_SELECTION",
    handler: "BOOKING",
    description: "Sửa một lựa chọn đã chọn trong lúc đặt lịch (đổi khoa, bác sĩ, ngày, giờ).",
    requiresAuth: false,
    mutates: false,
    examples: ["đổi sang bác sĩ khác", "thôi chọn ngày khác"],
  },
  {
    operation: "LOOKUP_APPOINTMENT",
    handler: "APPOINTMENT",
    description: "Xem lịch hẹn đã đặt của chính mình (lịch sắp tới, trạng thái, mã đặt lịch).",
    requiresAuth: true,
    mutates: false,
    examples: ["lịch hẹn của tôi", "tôi có lịch khám nào sắp tới không", "xem lịch BK20261124123456"],
  },
  {
    operation: "CANCEL_APPOINTMENT",
    handler: "APPOINTMENT",
    description: "Muốn hủy một lịch hẹn đã đặt của chính mình.",
    requiresAuth: true,
    mutates: true,
    examples: ["hủy lịch khám ngày mai", "tôi muốn hủy lịch hẹn"],
  },
  {
    operation: "RESCHEDULE_APPOINTMENT",
    handler: "APPOINTMENT",
    description: "Muốn đổi ngày giờ của một lịch hẹn đã đặt.",
    requiresAuth: true,
    mutates: true,
    examples: ["đổi lịch hẹn sang thứ năm", "dời lịch khám sang chiều"],
  },
  {
    operation: "UNKNOWN",
    handler: "FALLBACK",
    description: "Không thuộc các ý định trên hoặc không rõ ý.",
    requiresAuth: false,
    mutates: false,
    examples: ["thời tiết hôm nay thế nào"],
  },
];

const byOperation = new Map(INTENT_SPECS.map((spec) => [spec.operation, spec]));

export const intentSpecOf = (operation: ChatOperation): IntentSpec => byOperation.get(operation) ?? (byOperation.get("UNKNOWN") as IntentSpec);

/** Phần mô tả ý định trong lời nhắc cho AI phân tích: dựng từ đặc tả để lời nhắc và bộ định tuyến không lệch nhau. */
export const intentPromptSection = () =>
  INTENT_SPECS.map((spec) => `- ${spec.operation}: ${spec.description} Ví dụ: ${spec.examples.map((item) => `"${item}"`).join(", ")}.`).join("\n");
