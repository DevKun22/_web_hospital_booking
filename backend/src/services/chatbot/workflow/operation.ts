import type { NLUResult } from "../ai/nlu.schema.js";
import type {
  ChatAction,
  ChatBookingDraft,
  ChatIntent,
  ChatOperation,
} from "../chatbot.types.js";

export const operationFromAction = (action?: ChatAction): ChatOperation | null => {
  if (!action) return null;

  if (action.type === "VIEW_DEPARTMENTS") return "SEARCH_DEPARTMENT";
  if (action.type === "VIEW_PACKAGES") return "SEARCH_PACKAGE";
  if (action.type === "VIEW_DOCTORS") return "SEARCH_DOCTOR";
  if (
    action.type === "VIEW_AVAILABLE_SLOTS" ||
    action.type === "SELECT_SLOT" ||
    action.type === "CHANGE_DATE"
  ) {
    return "SEARCH_SLOT";
  }
  if (action.type === "LOOKUP_APPOINTMENT") return "LOOKUP_APPOINTMENT";
  // Chọn lịch cần hủy, xác nhận hoặc bỏ hủy: thuộc luồng lịch hẹn cá nhân, kiểm quyền ở handler.
  if (action.type === "SELECT_APPOINTMENT" || action.type === "CONFIRM_CANCEL_APPOINTMENT" || action.type === "DISMISS_PENDING_ACTION") {
    return "CANCEL_APPOINTMENT";
  }
  // Quay lại đặt lịch sau khi hỏi chuyện khác: bước tiếp theo suy ra từ bản nháp còn giữ.
  if (action.type === "RESUME_BOOKING") return "CHANGE_SELECTION";
  // Người dùng bỏ một lựa chọn đã chọn: bước tiếp theo suy ra từ phần còn lại của bản nháp.
  if (action.type === "CLEAR_SELECTION") return "CHANGE_SELECTION";
  if (action.type === "START_BOOKING") return "START_BOOKING";
  if (
    action.type === "VIEW_DEPARTMENT" ||
    action.type === "SELECT_DEPARTMENT"
  ) {
    return "SEARCH_DEPARTMENT";
  }
  if (action.type === "VIEW_PACKAGE" || action.type === "SELECT_PACKAGE") {
    return "SEARCH_PACKAGE";
  }
  if (
    action.type === "VIEW_DOCTOR" ||
    action.type === "SELECT_DOCTOR" ||
    action.type === "CHANGE_DOCTOR"
  ) {
    return "SEARCH_DOCTOR";
  }

  return "UNKNOWN";
};

export const operationToIntent = (
  operation: ChatOperation,
  draft: ChatBookingDraft,
  nlu?: NLUResult,
): ChatIntent => {
  if (operation === "SEARCH_DEPARTMENT") {
    if (nlu?.entities.symptoms?.length) return "SYMPTOM_TRIAGE";
    return draft.departmentId ? "DEPARTMENT_DETAIL" : "DEPARTMENT_LIST";
  }
  if (operation === "SEARCH_PACKAGE") {
    return draft.packageId ? "PACKAGE_DETAIL" : "PACKAGE_LIST";
  }
  if (operation === "SEARCH_DOCTOR") return "DOCTOR_LIST";
  if (operation === "SEARCH_SLOT") return "AVAILABLE_SLOT_LOOKUP";
  if (operation === "START_BOOKING") return "BOOKING_START";
  if (operation === "LOOKUP_APPOINTMENT") return "APPOINTMENT_LOOKUP";
  if (operation === "CANCEL_APPOINTMENT") return "APPOINTMENT_CANCEL";
  if (operation === "RESCHEDULE_APPOINTMENT") return "APPOINTMENT_RESCHEDULE";
  if (
    operation === "ASK_INFORMATION" ||
    operation === "ASK_POLICY" ||
    operation === "ASK_CAPABILITIES" ||
    operation === "GREETING"
  ) {
    return "GENERAL_HOSPITAL_INFO";
  }

  // Câu sửa lựa chọn có thể không chỉ rõ operation; suy ra bước tiếp theo từ
  // draft đã xác minh thay vì đoán lại bằng nội dung câu người dùng.
  if (operation === "CHANGE_SELECTION") {
    if (draft.timeSlotId || draft.date) return "AVAILABLE_SLOT_LOOKUP";
    if (draft.doctorId) return "DOCTOR_LIST";
    if (draft.packageId) return "PACKAGE_LIST";
    if (draft.departmentId) return "DEPARTMENT_LIST";
  }

  return "UNKNOWN";
};