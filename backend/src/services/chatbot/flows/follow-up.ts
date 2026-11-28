import { prisma } from "../../../config/prisma.js";
import type { ChatBookingDraft, ChatFocus, ChatOperation, SuggestedAction } from "../chatbot.types.js";
import ChatbotDraftReducer from "../workflow/draft.reducer.js";
import type { KnowledgeChunk } from "../rag/rag.types.js";
import { foldVietnamese } from "../rules/text-normalizer.js";

// Gợi ý bước tiếp theo sau một câu trả lời thông tin. Chọn bằng quy tắc từ chính đoạn tri thức đã dùng để trả lời (bác sĩ, chuyên khoa,
// gói khám, chính sách...), không gọi thêm AI nên không tốn thời gian và không thể bịa: mã bác sĩ, khoa, gói đều đọc từ DB.
// Nhãn viết như câu người dùng sẽ hỏi; nút hỏi thêm mang sẵn câu đầy đủ (có tên) để truy hồi tìm đúng.

export type FollowUp = { actions: SuggestedAction[]; focus?: ChatFocus };

const contact: SuggestedAction = { type: "CONTACT_STAFF", label: "Hỏi nhân viên hỗ trợ", payload: {} };
const viewDepartments: SuggestedAction = { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} };
const startBooking: SuggestedAction = { type: "START_BOOKING", label: "Đặt lịch ngay", payload: {} };
const lookupAppointment: SuggestedAction = { type: "LOOKUP_APPOINTMENT", label: "Tra cứu lịch hẹn", payload: {} };

const ask = (label: string, question: string): SuggestedAction => ({ type: "ASK_QUESTION", label, payload: { question } });

const viewPackages: SuggestedAction = { type: "VIEW_PACKAGES", label: "Xem gói khám", payload: {} };

// Câu hỏi về chính sách đi tới bước kế tiếp hợp lý của chính chủ đề đó, không phải bộ nút chung cho mọi câu chính sách.
const CANCEL_TOPIC = /\b(huy|hoan|doi lich|doi gio|khoa huy|tre hen|khong den)\b/;
const PAYMENT_TOPIC = /\b(thanh toan|hoa don|vnpay|chuyen khoan|the ngan hang|phi)\b/;

/** Gợi ý khi nguồn là chính sách: theo chủ đề câu hỏi (hủy/hoàn/đổi lịch, thanh toán), còn lại là bộ mặc định. */
export const policyActions = (question: string): SuggestedAction[] => {
  const folded = foldVietnamese(question);
  if (CANCEL_TOPIC.test(folded)) {
    return [ask("Hủy lịch của tôi", "Tôi muốn hủy lịch hẹn của mình"), lookupAppointment, contact];
  }
  if (PAYMENT_TOPIC.test(folded)) return [viewPackages, startBooking, contact];
  return [startBooking, lookupAppointment, contact];
};

/** Mã nguồn có thể kèm "#chỉ số đoạn" (nội dung chuyên khoa, bài viết được tách nhiều đoạn). */
const baseId = (sourceId: string) => sourceId.split("#")[0];

class FollowUpService {
  /** Chủ đề trong câu trả lời: nguồn đầu tiên là bác sĩ, chuyên khoa hoặc gói khám còn hoạt động. */
  async topicOf(chunks: KnowledgeChunk[]): Promise<ChatFocus | null> {
    for (const chunk of chunks) {
      const id = baseId(chunk.sourceId);
      if (chunk.sourceType === "DOCTOR") {
        const doctor = await prisma.doctorProfile.findFirst({
          where: { id, isAvailable: true, user: { isActive: true } },
          select: { id: true, departmentId: true, user: { select: { fullName: true } } },
        });
        if (doctor) return { type: "doctor", id: doctor.id, name: doctor.user.fullName, departmentId: doctor.departmentId };
      } else if (chunk.sourceType === "PACKAGE") {
        const pack = await prisma.package.findFirst({
          where: { id, isActive: true },
          select: { id: true, name: true, departmentId: true },
        });
        if (pack) return { type: "package", id: pack.id, name: pack.name, departmentId: pack.departmentId ?? undefined };
      } else if (chunk.sourceType === "DEPARTMENT") {
        const department = await prisma.department.findFirst({ where: { id, isActive: true }, select: { id: true, name: true } });
        if (department) return { type: "department", id: department.id, name: department.name, departmentId: department.id };
      }
    }
    return null;
  }

  /** Gợi ý theo chủ đề; không có chủ đề cụ thể thì theo loại nguồn (chính sách, bài viết, câu hỏi thường gặp). */
  actionsFor(topic: ChatFocus | null, chunks: KnowledgeChunk[], question = ""): SuggestedAction[] {
    if (topic?.type === "doctor") {
      return [
        { type: "VIEW_DOCTOR", label: "Xem lịch trống của bác sĩ này", payload: { doctorId: topic.id, departmentId: topic.departmentId } },
        {
          type: "START_BOOKING",
          label: "Đặt lịch với bác sĩ này",
          payload: { prefill: { doctorId: topic.id, departmentId: topic.departmentId } },
        },
        topic.departmentId
          ? { type: "VIEW_DEPARTMENT", label: "Xem khoa của bác sĩ", payload: { departmentId: topic.departmentId } }
          : contact,
      ];
    }
    if (topic?.type === "package") {
      return [
        ask("Gói này gồm những gì?", `${topic.name} gồm những hạng mục nào?`),
        { type: "VIEW_PACKAGE", label: "Chọn gói này", payload: { packageId: topic.id, departmentId: topic.departmentId } },
        { type: "VIEW_PACKAGES", label: "Xem gói khác", payload: {} },
      ];
    }
    if (topic?.type === "department") {
      return [
        { type: "VIEW_DEPARTMENT", label: "Xem bác sĩ và lịch trống", payload: { departmentId: topic.id } },
        ask("Khoa có gói khám nào?", `${topic.name} có những gói khám nào và giá bao nhiêu?`),
        ask("Khi nào nên đi khám?", `Khi nào nên đến khám ${topic.name}?`),
      ];
    }

    const types = new Set(chunks.map((chunk) => chunk.sourceType));
    if (types.has("POLICY")) return policyActions(question);
    if (types.has("ARTICLE")) return [viewDepartments, ask("Khi nào cần đi khám?", "Khi nào tôi nên đi khám thay vì tự theo dõi tại nhà?"), contact];
    if (types.has("SITE")) return [startBooking, viewDepartments];
    return [startBooking, viewDepartments, contact];
  }

  async forChunks(chunks: KnowledgeChunk[], question = ""): Promise<FollowUp> {
    const topic = await this.topicOf(chunks);
    return { actions: this.actionsFor(topic, chunks, question), focus: topic ?? undefined };
  }
}

const REFERENCE_WORDS = /\b(nay|do|kia|ay|vua roi|tren)\b/;
const REFERENCE_MAX_WORDS = 9;

/**
 * Câu hỏi có đại từ chỉ chủ đề ("bác sĩ này", "gói đó", "khoa ấy") mà không nêu tên: thêm tên chủ đề Kun vừa nói để truy hồi và AI hiểu đúng.
 * `fold` là hàm bỏ dấu tiếng Việt (truyền vào để tệp này không phụ thuộc bộ chuẩn hóa).
 */
export const withFocusName = (message: string, focus: ChatFocus | undefined, fold: (text: string) => string) => {
  if (!focus) return message;
  const folded = fold(message);
  if (folded.includes(fold(focus.name))) return message;
  if (message.trim().split(/\s+/).length > REFERENCE_MAX_WORDS) return message;
  if (!REFERENCE_WORDS.test(folded)) return message;
  return `${message.trim().replace(/[?!.\s]+$/g, "")} (${focus.name})`;
};

const DOCTOR_OPERATIONS = new Set<ChatOperation>(["SEARCH_SLOT", "SEARCH_DOCTOR", "START_BOOKING"]);
const PACKAGE_OPERATIONS = new Set<ChatOperation>(["SEARCH_PACKAGE", "SEARCH_SLOT", "START_BOOKING"]);
const DEPARTMENT_OPERATIONS = new Set<ChatOperation>(["SEARCH_DOCTOR", "SEARCH_SLOT", "SEARCH_PACKAGE"]);

/**
 * Người dùng muốn xem lịch, đặt lịch... mà không nêu bác sĩ, gói hay khoa nào: dùng chủ đề Kun vừa nói tới.
 * Không đè lên thứ người dùng đã chọn hoặc vừa nêu rõ trong câu.
 */
export const applyFocus = (draft: ChatBookingDraft, operation: ChatOperation, resolved: Partial<ChatBookingDraft>): ChatBookingDraft => {
  const focus = draft.focus;
  if (!focus) return draft;
  let patch: Partial<ChatBookingDraft> | null = null;
  if (focus.type === "doctor" && DOCTOR_OPERATIONS.has(operation) && !draft.doctorId && !resolved.doctorId) {
    patch = { doctorId: focus.id, departmentId: focus.departmentId };
  } else if (focus.type === "package" && PACKAGE_OPERATIONS.has(operation) && !draft.packageId && !resolved.packageId) {
    patch = { packageId: focus.id, departmentId: focus.departmentId };
  } else if (focus.type === "department" && DEPARTMENT_OPERATIONS.has(operation) && !draft.departmentId && !resolved.departmentId) {
    patch = { departmentId: focus.id };
  }
  return patch ? ChatbotDraftReducer.reduce(draft, patch, { clearFields: [] }) : draft;
};

/** Bản nháp thêm chủ đề mới; chủ đề cũ giữ nguyên khi câu trả lời không nói tới thực thể nào. */
export const withFocus = (draft: ChatBookingDraft, focus?: ChatFocus): ChatBookingDraft => (focus ? { ...draft, focus } : draft);

export default new FollowUpService();
