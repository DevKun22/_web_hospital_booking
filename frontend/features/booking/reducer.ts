import type { Appointment } from "@/lib/types";
import {
  createInitialDraft,
  createInitialState,
  type BookingDraft,
  type BookingSelection,
  type BookingSlot,
  type BookingState,
  type BookingStep,
  type PendingAppointment,
} from "@/features/booking/model";
import type { UrlPrefill } from "@/features/booking/prefill";

export type BookingAction =
  | { type: "date_defaulted"; date: string }
  | { type: "url_applied"; prefill: UrlPrefill }
  | { type: "selection_changed"; patch: Partial<BookingSelection> }
  | { type: "draft_changed"; patch: Partial<BookingDraft> }
  | { type: "slot_chosen"; slot: BookingSlot }
  | { type: "step_changed"; step: BookingStep }
  | { type: "error"; message: string }
  | { type: "notice"; message: string }
  | { type: "submitting"; value: boolean }
  | { type: "hold_created"; pending: PendingAppointment; notice: string; resendAt: number }
  | { type: "pending_restored"; pending: PendingAppointment; notice: string; resendAt: number }
  | { type: "hold_expired"; message: string }
  | { type: "hold_released"; notice: string }
  | { type: "otp_changed"; otp: string }
  | { type: "otp_resent"; patch: Partial<PendingAppointment>; notice: string; resendAt: number }
  | { type: "verified"; appointment: Appointment; notice: string }
  | { type: "slots_loaded"; slots: BookingSlot[] }
  | { type: "profile_applied"; ownerId: string; patch: Partial<BookingDraft> }
  | { type: "profile_cleared" }
  | { type: "reset" };

// Sửa lựa chọn hoặc thông tin làm phiếu giữ chỗ cũ không còn đúng: bỏ phiếu và các thông báo cũ.
const dropFlowState = (state: BookingState): BookingState => ({
  ...state,
  pending: null,
  verified: null,
  otp: "",
  notice: "",
  error: "",
});

const dateOnly = (value?: string | null) => value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || "";

export function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  switch (action.type) {
    case "date_defaulted":
      return state.draft.date ? state : { ...state, draft: { ...state.draft, date: action.date } };
    case "url_applied": {
      const { prefill } = action;
      const doctorId = prefill.doctorId ?? state.selection.doctorId;
      const packageId = prefill.packageId ?? state.selection.packageId;
      return {
        ...state,
        urlApplied: true,
        selection: {
          departmentId: prefill.departmentId || state.selection.departmentId,
          doctorId,
          packageId,
          serviceMode: prefill.serviceMode ?? (packageId ? "PACKAGE" : doctorId ? "DOCTOR_ONLY" : state.selection.serviceMode),
        },
        draft: {
          ...state.draft,
          date: prefill.date || state.draft.date,
          timeSlotId: prefill.timeSlotId ?? state.draft.timeSlotId,
        },
      };
    }
    case "selection_changed":
      return { ...dropFlowState(state), selection: { ...state.selection, ...action.patch } };
    case "draft_changed": {
      // Đổi ngày hoặc bỏ chọn giờ thì khung giờ đã chọn không còn hiệu lực.
      const clearsSlot = action.patch.timeSlotId === "" || (action.patch.date !== undefined && action.patch.date !== state.draft.date);
      return {
        ...dropFlowState(state),
        draft: { ...state.draft, ...action.patch },
        slot: clearsSlot ? null : state.slot,
      };
    }
    case "slot_chosen":
      return { ...dropFlowState(state), draft: { ...state.draft, timeSlotId: action.slot.id }, slot: action.slot };
    case "step_changed":
      return { ...state, step: action.step, error: "" };
    case "error":
      return { ...state, error: action.message, submitting: false };
    case "notice":
      return { ...state, notice: action.message };
    case "submitting":
      return { ...state, submitting: action.value };
    case "hold_created":
      return {
        ...state,
        pending: { ...action.pending, snapshot: { selection: state.selection, slot: state.slot } },
        step: "verify",
        resendAt: action.resendAt,
        notice: action.notice,
        error: "",
        submitting: false,
      };
    case "pending_restored": {
      const snapshot = action.pending.snapshot;
      const slot = snapshot?.slot ?? null;
      return {
        ...state,
        pending: action.pending,
        selection: snapshot?.selection ?? state.selection,
        slot,
        draft: slot ? { ...state.draft, timeSlotId: slot.id, date: dateOnly(slot.date) || state.draft.date } : state.draft,
        step: "verify",
        resendAt: action.resendAt,
        notice: action.notice,
        error: "",
        submitting: false,
      };
    }
    case "hold_expired":
      return { ...state, pending: null, otp: "", resendAt: 0, notice: "", error: action.message, step: "schedule", submitting: false };
    case "hold_released":
      return {
        ...state,
        pending: null,
        otp: "",
        resendAt: 0,
        step: "schedule",
        draft: { ...state.draft, timeSlotId: "" },
        slot: null,
        notice: action.notice,
        error: "",
        submitting: false,
      };
    case "otp_changed":
      return { ...state, otp: action.otp.replace(/\D/g, "").slice(0, 6) };
    case "otp_resent":
      return {
        ...state,
        pending: state.pending ? { ...state.pending, ...action.patch } : state.pending,
        resendAt: action.resendAt,
        notice: action.notice,
        error: "",
        submitting: false,
      };
    case "verified":
      return { ...state, verified: action.appointment, pending: null, otp: "", resendAt: 0, step: "done", notice: action.notice, error: "", submitting: false };
    case "slots_loaded": {
      // Đã giữ chỗ hoặc đã xác thực: khung giờ không còn nằm trong danh sách trống là bình thường, giữ nguyên.
      if (state.pending || state.verified) return state;
      const matched = action.slots.find((slot) => slot.id === state.draft.timeSlotId) ?? null;
      const timeSlotId = matched ? state.draft.timeSlotId : "";
      const date = dateOnly(matched?.date) || state.draft.date;
      if (timeSlotId === state.draft.timeSlotId && date === state.draft.date && matched === state.slot) return state;
      return { ...state, draft: { ...state.draft, date, timeSlotId }, slot: matched };
    }
    case "profile_applied": {
      // Đổi sang tài khoản khác: bỏ phần thông tin của người trước, chỉ giữ ngày và giờ đã chọn.
      const switched = Boolean(state.profileOwnerId && state.profileOwnerId !== action.ownerId);
      const base = switched ? { ...createInitialDraft(state.draft.date), timeSlotId: state.draft.timeSlotId } : state.draft;
      return { ...state, draft: { ...base, ...action.patch }, profileOwnerId: action.ownerId };
    }
    case "profile_cleared":
      if (!state.profileOwnerId) return state;
      return {
        ...state,
        draft: { ...createInitialDraft(state.draft.date), timeSlotId: state.draft.timeSlotId },
        profileOwnerId: null,
      };
    case "reset":
      return createInitialState();
    default:
      return state;
  }
}
