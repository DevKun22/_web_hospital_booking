const CHAT_INTENTS = [
  "SYMPTOM_TRIAGE",
  "DEPARTMENT_LIST",
  "DEPARTMENT_DETAIL",
  "PACKAGE_LIST",
  "PACKAGE_DETAIL",
  "DOCTOR_LIST",
  "AVAILABLE_SLOT_LOOKUP",
  "BOOKING_START",
  "BOOKING_FORM_HELP",
  "APPOINTMENT_LOOKUP_GUIDE",
  "PAYMENT_GUIDE",
  "GENERAL_HOSPITAL_INFO",
  "UNKNOWN",
] as const;

const CHAT_STATES = [
  "IDLE",
  "ASKING_SYMPTOMS",
  "SUGGESTING_DEPARTMENT",
  "SUGGESTING_PACKAGE",
  "CHOOSING_DOCTOR",
  "CHOOSING_DATE",
  "CHOOSING_SLOT",
  "READY_TO_BOOK",
  "BOOKING_GUIDE",
  "EMERGENCY_CARE",
] as const;

export const SUGGESTED_ACTION_TYPES = [
  "ASK_MORE_INFO",
  "VIEW_DEPARTMENTS",
  "VIEW_DEPARTMENT",
  "VIEW_PACKAGES",
  "VIEW_PACKAGE",
  "VIEW_DOCTORS",
  "VIEW_DOCTOR",
  "VIEW_AVAILABLE_SLOTS",
  "CHANGE_DATE",
  "CHANGE_DOCTOR",
  "START_BOOKING",
  "LOOKUP_APPOINTMENT",
  "CONTACT_STAFF",
  "EMERGENCY_ADVICE",
  "ASK_QUESTION",
] as const;

const CHAT_NEXT_STEPS = [
  "ASK_SYMPTOM_DETAILS",
  "CHOOSE_DEPARTMENT",
  "CHOOSE_PACKAGE",
  "CHOOSE_DOCTOR",
  "CHOOSE_DATE",
  "CHOOSE_SLOT",
  "READY_TO_BOOK",
  "SHOW_BOOKING_GUIDE",
  "SHOW_PAYMENT_GUIDE",
  "EMERGENCY_CARE",
  "END",
] as const;

export type ChatIntent = typeof CHAT_INTENTS[number];
type ChatState = typeof CHAT_STATES[number];
type ChatNextStep = typeof CHAT_NEXT_STEPS[number];
export type SuggestedActionType = typeof SUGGESTED_ACTION_TYPES[number];
export type ChatbotResponseSource =
  | "SYSTEM"
  | "FAQ"
  | "AI"
  | "FALLBACK"
  | "EMERGENCY";

export const CHAT_OPERATIONS = [
  "START_BOOKING",
  "SEARCH_DEPARTMENT",
  "SEARCH_PACKAGE",
  "SEARCH_DOCTOR",
  "SEARCH_SLOT",
  "LOOKUP_APPOINTMENT",
  "ASK_PAYMENT",
  "ASK_INFORMATION",
  "ASK_CAPABILITIES",
  "CHANGE_SELECTION",
  "RESET_FLOW",
  "GREETING",
  "UNKNOWN",
] as const;

export const CHAT_TIME_PERIODS = ["MORNING", "AFTERNOON", "EVENING"] as const;

export type ChatOperation = (typeof CHAT_OPERATIONS)[number];
export type ChatTimePeriod = (typeof CHAT_TIME_PERIODS)[number];
export type ChatServiceMode = "DOCTOR_ONLY" | "PACKAGE";

/** Chủ đề Kun vừa nói tới trong câu trả lời thông tin; để hiểu "bác sĩ này", "gói đó" ở câu hỏi kế tiếp. */
export type ChatFocus = {
  type: "doctor" | "department" | "package";
  id: string;
  name: string;
  departmentId?: string;
};

export type ChatBookingDraft = {
  departmentId?: string;
  departmentSlug?: string;
  packageId?: string;
  packageSlug?: string;
  serviceMode?: ChatServiceMode;
  doctorId?: string;
  date?: string;
  timeSlotId?: string;
  timePeriod?: ChatTimePeriod;
  symptoms?: string[];
  bodyParts?: string[];
  symptomDuration?: string;
  symptomSeverity?: "MILD" | "MODERATE" | "SEVERE" | "UNKNOWN";
  associatedSymptoms?: string[];
  triageLastQuestion?: string;
  reason?: string;
  focus?: ChatFocus;
};

export type ChatAction = {
  type: string;
  label?: string;
  payload?: Record<string, unknown>;
};

export type SuggestedAction = {
  type: SuggestedActionType;
  label: string;
  payload: Record<string, unknown>;
};

type ChatbotResultItem =
  | {
      type: "department";
      id: string;
      name: string;
      slug?: string | null;
      description?: string | null;
    }
  | {
      type: "package";
      id: string;
      name: string;
      slug?: string | null;
      departmentId?: string | null;
      departmentName?: string | null;
      summary?: string | null;
      finalPrice: number;
    }
  | {
      type: "doctor";
      id: string;
      fullName: string;
      title?: string | null;
      specialization?: string | null;
      departmentId: string;
      departmentName: string;
      consultationFee: number;
    }
  | {
      type: "slot";
      id: string;
      doctorId: string;
      doctorName?: string;
      departmentName?: string;
      date: string;
      startTime: string;
      endTime: string;
    };

export type ChatbotResultGroup = {
  type: "departments" | "packages" | "doctors" | "slots";
  title: string;
  description?: string;
  items: ChatbotResultItem[];
  total: number;
  limit: number;
};
export type ChatbotRequestInput = {
  sessionId?: string;
  message: string;
  draft?: ChatBookingDraft;
  action?: ChatAction;
};

import type { ChatbotSource } from "./rag/rag.types.js";

export type AIChatbotOutput = {
  reply: string;
  intent: ChatIntent;
  state: ChatState;
  nextStep: ChatNextStep;
  confidence: number;
  draft: ChatBookingDraft;
  results?: ChatbotResultGroup[];
  suggestedActions: SuggestedAction[];
  /** Nguồn tri thức mà câu trả lời dựa vào (chỉ có với câu trả lời từ kho tri thức). */
  sources?: ChatbotSource[];
};

/** Các lựa chọn đang giữ trong bản nháp đặt lịch, kèm tên để hiển thị. */
export type ChatbotDraftSummary = {
  department?: { id: string; name: string };
  package?: { id: string; name: string; price: number };
  doctor?: { id: string; name: string; departmentName: string; fee: number };
  slot?: { id: string; date: string; startTime: string; endTime: string };
  date?: string;
};

export type ChatbotResponse = AIChatbotOutput & {
  sessionId: string;
  source: ChatbotResponseSource;
  draftSummary?: ChatbotDraftSummary;
  /** Mã bản ghi nhật ký của câu trả lời này, để người dùng gửi phản hồi hữu ích / chưa đúng; vắng khi không ghi được nhật ký. */
  messageId?: string;
};
