import type {
  ChatBookingDraft,
  ChatbotSource,
  ChatbotDraftSummary,
  ChatbotResultGroup,
  ChatbotSuggestedAction,
} from "@/lib/types";

// Phần logic thuần của khung trợ lý Kun (không có React): nhãn, tiến trình đặt lịch, đường dẫn sang trang đặt lịch.

export type ChatMessageRole = "user" | "assistant" | "system" | "alert";

export type ChatWidgetMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  results?: ChatbotResultGroup[];
  sources?: ChatbotSource[];
  /** Gợi ý bước tiếp theo đi kèm câu trả lời này; chỉ tin mới nhất hiện cho bấm. */
  actions?: ChatbotSuggestedAction[];
  /** Tin lỗi gửi: hiện nút "Thử lại". */
  retryable?: boolean;
};

// ---- Chờ phản hồi: lời nhắn thân thiện theo việc Kun đang làm ----

const actionLoadingText: Record<string, string> = {
  VIEW_DEPARTMENT: "Kun đang xem chuyên khoa này giúp bạn…",
  SELECT_DEPARTMENT: "Kun đang xem chuyên khoa này giúp bạn…",
  VIEW_PACKAGE: "Kun đang mở gói khám cho bạn…",
  SELECT_PACKAGE: "Kun đang mở gói khám cho bạn…",
  VIEW_DOCTOR: "Kun đang tìm lịch trống của bác sĩ…",
  SELECT_DOCTOR: "Kun đang tìm lịch trống của bác sĩ…",
  VIEW_AVAILABLE_SLOTS: "Kun đang giữ khung giờ này cho bạn…",
  SELECT_SLOT: "Kun đang chuẩn bị lịch cho bạn…",
  CHANGE_DOCTOR: "Kun đang tìm bác sĩ khác…",
  CLEAR_SELECTION: "Kun đang cập nhật lựa chọn của bạn…",
  SUMMARIZE_ARTICLE: "Kun đang đọc và tóm tắt bài viết…",
};

/** Nút ở trang bài viết: nhờ Kun tóm tắt đúng bài đang đọc. */
export const buildSummarizeArticleAction = (slug: string): ChatbotSuggestedAction => ({
  type: "SUMMARIZE_ARTICLE",
  label: "Tóm tắt bài viết này giúp mình",
  payload: { articleSlug: slug },
});

export const getLoadingText = (action?: ChatbotSuggestedAction) =>
  action ? actionLoadingText[action.type] || "Kun đang xử lý lựa chọn của bạn…" : "Kun đang suy nghĩ…";

/** Sau vài giây vẫn chưa có phản hồi thì nói thật là đang lâu, để người dùng không tưởng bị treo. */
export const SLOW_LOADING_TEXT = "Kun vẫn đang tìm, bạn chờ thêm chút nhé…";

export const getInputPlaceholder = (action?: ChatbotSuggestedAction) => {
  if (action?.type === "CHANGE_DATE") return "Nhập ngày khám";
  if (action?.type === "CHANGE_DOCTOR") return "Nhập tên bác sĩ hoặc chuyên khoa";
  return "Hỏi Kun về bác sĩ, gói khám, lịch khám…";
};

// ---- Tiến trình đặt lịch ----

export type ClearableField = "department" | "package" | "doctor" | "slot";

export type BookingStep = { key: "department" | "doctor" | "slot" | "confirm"; label: string; done: boolean };

/** Bốn bước đặt lịch; bước đang làm là bước đầu tiên chưa xong. Chưa chọn gì thì chưa có tiến trình để hiện. */
export const getBookingProgress = (summary?: ChatbotDraftSummary) => {
  if (!summary || (!summary.department && !summary.package && !summary.doctor && !summary.slot)) return null;
  const steps: BookingStep[] = [
    { key: "department", label: "Khoa", done: Boolean(summary.department || summary.doctor) },
    { key: "doctor", label: "Bác sĩ", done: Boolean(summary.doctor) },
    { key: "slot", label: "Giờ khám", done: Boolean(summary.slot) },
    { key: "confirm", label: "Xác nhận", done: false },
  ];
  const activeIndex = steps.findIndex((step) => !step.done);
  return { steps, activeIndex: activeIndex === -1 ? steps.length - 1 : activeIndex };
};

export const formatChatbotDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

/** Ngày theo giờ Việt Nam (máy chủ trả ISO UTC, ngày duyệt buổi sáng không được lùi về hôm trước). */
export const formatReviewDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
};

/** Dòng kiểm chứng dưới nguồn: "Duyệt bởi X · cập nhật 12/11/2026"; nguồn không có ngày thì không có dòng này. */
export const getSourceReviewLine = (source: Pick<ChatbotSource, "reviewedBy" | "updatedAt">) => {
  const date = source.updatedAt ? formatReviewDate(source.updatedAt) : null;
  if (!date) return null;
  const reviewer = source.reviewedBy?.trim();
  return reviewer ? `Duyệt bởi ${reviewer} · cập nhật ${date}` : `Cập nhật ${date}`;
};

/** Các lựa chọn có thể bỏ, theo thứ tự hiện, kèm nhãn cho nút xóa. */
export const getSelectionChips = (summary?: ChatbotDraftSummary) => {
  if (!summary) return [];
  const chips: { field: ClearableField; label: string }[] = [];
  if (summary.department) chips.push({ field: "department", label: summary.department.name });
  if (summary.package) chips.push({ field: "package", label: summary.package.name });
  if (summary.doctor) chips.push({ field: "doctor", label: summary.doctor.name });
  if (summary.slot) {
    chips.push({ field: "slot", label: `${summary.slot.startTime}, ${formatChatbotDate(summary.slot.date)}` });
  }
  return chips;
};

// ---- Gợi ý nhanh ----

const MAX_QUICK_REPLIES = 4;
/** Nút gợi ý trùng với thẻ kết quả đang hiện (chọn khoa, gói, bác sĩ, giờ) thì bỏ: thẻ đã là nơi chọn. */
const RESULT_ACTION: Record<ChatbotResultGroup["type"], string> = {
  departments: "VIEW_DEPARTMENT",
  packages: "VIEW_PACKAGE",
  doctors: "VIEW_DOCTOR",
  slots: "VIEW_AVAILABLE_SLOTS",
};

export const getQuickReplies = (actions: ChatbotSuggestedAction[], latestResults?: ChatbotResultGroup[]) => {
  const covered = new Set((latestResults || []).map((group) => RESULT_ACTION[group.type]));
  return actions
    // EMERGENCY_ADVICE chỉ là lời khuyên đã nằm trong thẻ cảnh báo, bấm không làm gì thêm.
    .filter((action) => !covered.has(action.type) && action.type !== "EMERGENCY_ADVICE")
    .slice(0, MAX_QUICK_REPLIES);
};

/** Nút "hỏi thêm" mang sẵn câu hỏi đầy đủ (có tên bác sĩ, gói...), gửi đi như người dùng gõ; nhãn ngắn chỉ để hiển thị. */
export const getAskQuestion = (action: ChatbotSuggestedAction) => {
  if (action.type !== "ASK_QUESTION") return null;
  const question = action.payload?.question;
  return typeof question === "string" && question.trim() ? question.trim() : null;
};

// ---- Sang trang đặt lịch ----

/** Đường dẫn trang đặt lịch kèm các lựa chọn đã có (khoa, gói, bác sĩ, ngày, giờ). */
export const buildBookingHref = (draft?: ChatBookingDraft, prefill?: Partial<ChatBookingDraft>) => {
  const source = { ...(draft || {}), ...(prefill || {}) };
  const params = new URLSearchParams();
  (["departmentId", "packageId", "doctorId", "date", "timeSlotId"] as const).forEach((key) => {
    const value = source[key];
    if (typeof value === "string" && value.trim()) params.set(key, value);
  });
  const query = params.toString();
  return `/dat-lich${query ? `?${query}` : ""}`;
};

/** Đường dẫn trang đích của nút gợi ý chuyển trang (không cần hỏi máy chủ); null nếu là nút trao đổi với Kun. */
export const getNavigationTarget = (action: ChatbotSuggestedAction, draft?: ChatBookingDraft) => {
  if (action.type === "LOOKUP_APPOINTMENT") return "/tai-khoan/dang-nhap?next=/tai-khoan/lich-hen";
  if (action.type === "CONTACT_STAFF") return "/ho-tro";
  if (action.type === "START_BOOKING") {
    return buildBookingHref(draft, action.payload?.prefill as Partial<ChatBookingDraft> | undefined);
  }
  return null;
};

export type KunTeaser = { message: string; chips: ChatbotSuggestedAction[] };

const findDepartmentChip: ChatbotSuggestedAction = { type: "VIEW_DEPARTMENTS", label: "Tìm chuyên khoa", payload: {} };
const viewPackagesChip: ChatbotSuggestedAction = { type: "VIEW_PACKAGES", label: "Xem gói khám", payload: {} };

/**
 * Tin nhắn nổi của Kun theo trang đang xem (thay vì một câu chung cho mọi trang), kèm vài nút bấm để hỏi ngay.
 * Trang người dùng đang điền biểu mẫu hay thanh toán thì im lặng, không chen ngang.
 */
export const getKunTeaser = (pathname: string): KunTeaser | null => {
  if (/^\/(dat-lich|thanh-toan|login|tai-khoan)(\/|$)/.test(pathname)) return null;
  if (pathname.startsWith("/kien-thuc/")) return { message: "Cần hỏi thêm về bài viết này? Cứ hỏi mình, mình trả lời kèm nguồn nhé.", chips: [findDepartmentChip] };
  if (pathname.startsWith("/kien-thuc")) return { message: "Bạn đang thắc mắc về sức khỏe? Hỏi Kun, mình tìm trong các bài đã được bác sĩ duyệt.", chips: [findDepartmentChip] };
  if (pathname.startsWith("/bac-si")) return { message: "Chưa biết nên chọn bác sĩ nào? Kể mình nghe triệu chứng, mình gợi ý giúp.", chips: [findDepartmentChip] };
  if (pathname.startsWith("/chuyen-khoa")) return { message: "Không rõ nên khám chuyên khoa nào? Mô tả triệu chứng, Kun gợi ý cho bạn.", chips: [findDepartmentChip, viewPackagesChip] };
  if (pathname.startsWith("/goi-kham")) return { message: "Cần chọn gói khám phù hợp? Hỏi Kun về giá và nội dung gói nhé.", chips: [viewPackagesChip, findDepartmentChip] };
  return { message: "Chào bạn, mình là Kun. Cần tìm bác sĩ hay đặt lịch khám, cứ hỏi mình nhé.", chips: [findDepartmentChip, viewPackagesChip] };
};
