import type {
  ChatBookingDraft,
  ChatbotResponseSource,
  ChatbotResultGroup,
  ChatbotSuggestedAction,
} from "@/lib/types";

export type ChatMessageRole = "user" | "assistant" | "system" | "alert";

export type ChatWidgetMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  source?: ChatbotResponseSource;
  results?: ChatbotResultGroup[];
};

const responseSourceLabel: Record<ChatbotResponseSource, string> = {
  SYSTEM: "Hệ thống gợi ý",
  FAQ: "Kho FAQ trả lời",
  AI: "AI phân tích · dữ liệu hệ thống",
  FALLBACK: "Phản hồi dự phòng",
  EMERGENCY: "Cảnh báo an toàn",
};

export const getResponseSourceLabel = (source?: ChatbotResponseSource) =>
  source ? responseSourceLabel[source] : "Trợ lý trả lời";

const actionLoadingText: Record<string, string> = {
  VIEW_DEPARTMENT: "Đang kiểm tra chuyên khoa...",
  SELECT_DEPARTMENT: "Đang kiểm tra chuyên khoa...",
  VIEW_PACKAGE: "Đang kiểm tra gói khám...",
  SELECT_PACKAGE: "Đang kiểm tra gói khám...",
  VIEW_DOCTOR: "Đang tìm lịch trống...",
  SELECT_DOCTOR: "Đang tìm lịch trống...",
  VIEW_AVAILABLE_SLOTS: "Đang kiểm tra khung giờ...",
  SELECT_SLOT: "Đang chuẩn bị đặt lịch...",
  LOOKUP_APPOINTMENT: "Đang mở tra cứu lịch hẹn...",
  START_BOOKING: "Đang mở form đặt lịch...",
  CONTACT_STAFF: "Đang mở tư vấn...",
  CHANGE_DATE: "Bạn có thể nhập ngày khám mong muốn...",
  CHANGE_DOCTOR: "Đang đổi bác sĩ...",
  EMERGENCY_ADVICE: "Đang hiển thị hướng dẫn khẩn cấp...",
};

const statusText: Record<string, string> = {
  SUGGESTING_DEPARTMENT: "Đang chọn chuyên khoa",
  SUGGESTING_PACKAGE: "Đang chọn gói khám",
  CHOOSING_DOCTOR: "Đang chọn bác sĩ",
  CHOOSING_DATE: "Đang chọn ngày khám",
  CHOOSING_SLOT: "Đang chọn lịch trống",
  READY_TO_BOOK: "Sẵn sàng đặt lịch",
  BOOKING_GUIDE: "Hướng dẫn đặt lịch",
  EMERGENCY_CARE: "Cần hỗ trợ khẩn cấp",
};

const stripActionPrefix = (label: string) =>
  label.replace(/^(Xem|Chọn|Đổi|Mở|Tra cứu|Liên hệ)\s+/i, "").trim();

export const getActionLoadingText = (action?: ChatbotSuggestedAction) =>
  action
    ? actionLoadingText[action.type] || "Đang xử lý lựa chọn..."
    : "Chatbot đang trả lời...";

export const getActionInputPlaceholder = (action?: ChatbotSuggestedAction) => {
  if (action?.type === "CHANGE_DATE") return "Nhập ngày khám mong muốn...";
  if (action?.type === "CHANGE_DOCTOR")
    return "Nhập tên bác sĩ hoặc chuyên khoa...";
  return "Nhập câu hỏi...";
};

export const getFlowStatusText = (
  state?: string | null,
  nextStep?: string | null,
) => {
  const key = state || nextStep || "";
  return statusText[key] || "";
};

export const getActionEventMessage = (action: ChatbotSuggestedAction) => {
  const label = stripActionPrefix(action.label);

  switch (action.type) {
    case "VIEW_DEPARTMENT":
    case "SELECT_DEPARTMENT":
      return `Đã chọn chuyên khoa: ${label}`;
    case "VIEW_PACKAGE":
    case "SELECT_PACKAGE":
      return `Đã chọn gói khám: ${label}`;
    case "VIEW_DOCTOR":
    case "SELECT_DOCTOR":
      return `Đã chọn bác sĩ: ${label}`;
    case "VIEW_AVAILABLE_SLOTS":
    case "SELECT_SLOT":
      return `Đã chọn khung giờ: ${label}`;
    case "LOOKUP_APPOINTMENT":
      return "Mở tra cứu lịch hẹn";
    case "START_BOOKING":
      return "Mở form đặt lịch";
    case "CONTACT_STAFF":
      return "Mở form tư vấn";
    case "CHANGE_DATE":
      return "Bạn muốn đổi ngày khám";
    case "CHANGE_DOCTOR":
      return "Bạn muốn đổi bác sĩ";
    case "EMERGENCY_ADVICE":
      return "Cần hỗ trợ khẩn cấp";
    default:
      return `Đã chọn: ${action.label}`;
  }
};

export const getActionEventRole = (
  action: ChatbotSuggestedAction,
): ChatMessageRole => (action.type === "EMERGENCY_ADVICE" ? "alert" : "system");

export const getActionRenderKey = (
  action: ChatbotSuggestedAction,
  index: number,
) => {
  const payload = action.payload || {};
  const identity = [
    typeof payload.departmentId === "string" ? payload.departmentId : "",
    typeof payload.packageId === "string" ? payload.packageId : "",
    typeof payload.doctorId === "string" ? payload.doctorId : "",
    typeof payload.timeSlotId === "string" ? payload.timeSlotId : "",
    typeof payload.date === "string" ? payload.date : "",
  ]
    .filter(Boolean)
    .join(":");

  return `${action.type}:${identity || action.label}:${index}`;
};

export const buildBookingHref = (
  action?: ChatbotSuggestedAction,
  draft?: ChatBookingDraft,
) => {
  const prefill = action?.payload?.prefill as
    | Partial<ChatBookingDraft>
    | undefined;
  const source = { ...(draft || {}), ...(prefill || {}) };
  const params = new URLSearchParams();

  (
    ["departmentId", "packageId", "doctorId", "date", "timeSlotId"] as const
  ).forEach((key) => {
    const value = source[key];
    if (typeof value === "string" && value.trim()) params.set(key, value);
  });

  const query = params.toString();
  return `/dat-lich${query ? `?${query}` : ""}`;
};

export const formatChatbotDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  return `${match[3]}/${match[2]}/${match[1]}`;
};
