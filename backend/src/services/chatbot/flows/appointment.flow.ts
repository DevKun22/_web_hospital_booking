import { randomUUID } from "crypto";
import PatientPortalService from "../../patientPortal.service.js";
import { PATIENT_CANCEL_ALLOWED_STATUSES } from "../../appointment/appointment.shared.js";
import { AppError } from "../../../utils/appError.js";
import { getVietnamNowParts } from "../../../utils/time.js";
import { claimPendingAction, type ChatSessionState, type PendingAction } from "../chatbot.session.js";
import { formatDateLabel } from "./booking.builders.js";
import { parseVietnameseDateTime } from "../nlu/datetime.parser.js";
import type {
  AIChatbotOutput,
  ChatAction,
  ChatbotActor,
  ChatbotResultGroup,
  ChatBookingDraft,
  ChatOperation,
  SuggestedAction,
} from "../chatbot.types.js";

// Lịch hẹn cá nhân trong khung chat: tra cứu, hủy (có xác nhận), đổi lịch (chuyển nhân viên). Danh tính CHỈ lấy từ token đã
// xác thực (actor); mã lịch, ngày hay "lịch của tôi" trong tin nhắn chỉ dùng để chọn trong các lịch của chính tài khoản đó.
// Mọi đọc/ghi đi qua PatientPortalService (cùng đường với cổng người khám): kiểm quyền sở hữu, trạng thái và mốc khóa hủy ở đó.
// Không gọi AI ở đây và không gửi thông tin lịch hẹn cho AI.

/** Thời gian chờ người dùng bấm xác nhận hủy. */
const CONFIRMATION_TTL_MS = 5 * 60_000;
const BOOKING_CODE = /\bBK\d{14}\b/i;
const MAX_CARDS = 5;
const CANCEL_REASON = "Người khám tự hủy qua trợ lý ảo Kun";

type PortalAppointment = Awaited<ReturnType<typeof PatientPortalService.getAppointment>>;

export type AppointmentFlowResult = {
  output: AIChatbotOutput;
  /** undefined: giữ nguyên thao tác đang chờ; null: xóa; giá trị: đặt thao tác chờ mới. */
  pendingAction?: PendingAction | null;
  /** Câu trả lời có thông tin lịch hẹn cá nhân: không lưu nguyên văn vào nhật ký. */
  personal: boolean;
  /** Đã thực hiện thay đổi dữ liệu thật (để ghi vào vết). */
  mutated?: boolean;
};

type FlowInput = {
  operation: ChatOperation;
  action?: ChatAction;
  actor: ChatbotActor;
  session: ChatSessionState;
  draft: ChatBookingDraft;
  message: string;
  appointmentRef?: string | null;
  now?: Date;
};

const LOOKUP_PORTAL_ACTION: SuggestedAction = { type: "LOOKUP_APPOINTMENT", label: "Mở lịch hẹn của tôi", payload: {} };
const CONTACT_STAFF_ACTION: SuggestedAction = { type: "CONTACT_STAFF", label: "Liên hệ nhân viên", payload: {} };

const output = (input: Partial<AIChatbotOutput> & Pick<AIChatbotOutput, "reply" | "intent" | "draft">): AIChatbotOutput => ({
  state: "SHOWING_APPOINTMENTS",
  nextStep: "END",
  confidence: 0.9,
  suggestedActions: [],
  ...input,
});

const canCancel = (item: PortalAppointment, now: Date) =>
  PATIENT_CANCEL_ALLOWED_STATUSES.includes(item.status) && new Date(item.cancelDeadline).getTime() > now.getTime();

const dateOf = (item: PortalAppointment) => item.appointmentDate.toISOString().slice(0, 10);

const doctorNameOf = (item: PortalAppointment) =>
  item.doctor?.user?.fullName ? `${item.doctor.title || ""} ${item.doctor.user.fullName}`.trim() : null;

const describe = (item: PortalAppointment) =>
  `lịch ${item.bookingCode} lúc ${item.startTime} ngày ${formatDateLabel(dateOf(item))}${doctorNameOf(item) ? ` với ${doctorNameOf(item)}` : ""}`;

/** Thẻ lịch hẹn chỉ gồm điều cần để nhận ra lịch; không có tên, liên hệ hay lý do khám của người khám. */
const appointmentCards = (items: PortalAppointment[], now: Date, title: string): ChatbotResultGroup[] =>
  items.length
    ? [
        {
          type: "appointments",
          title,
          items: items.slice(0, MAX_CARDS).map((item) => ({
            type: "appointment" as const,
            id: item.id,
            bookingCode: item.bookingCode,
            date: dateOf(item),
            startTime: item.startTime,
            endTime: item.endTime,
            status: item.status,
            doctorName: doctorNameOf(item),
            departmentName: item.department?.name ?? null,
            canCancel: canCancel(item, now),
            cancelDeadline: item.cancelDeadline,
          })),
          total: items.length,
          limit: MAX_CARDS,
        },
      ]
    : [];

const loginRequired = (operation: ChatOperation, draft: ChatBookingDraft): AppointmentFlowResult => ({
  personal: false,
  output: output({
    reply:
      operation === "RESCHEDULE_APPOINTMENT"
        ? "Đổi lịch hẹn cần nhân viên hỗ trợ sắp lại giờ. Bạn đăng nhập tài khoản người khám để xem lịch của mình, hoặc liên hệ nhân viên kèm mã đặt lịch nhé."
        : "Để xem hoặc hủy lịch hẹn của bạn, bạn cần đăng nhập tài khoản người khám bằng email đã đặt lịch. Đăng nhập xong, bạn quay lại hỏi Kun là được.",
    intent: operation === "CANCEL_APPOINTMENT" ? "APPOINTMENT_CANCEL" : operation === "RESCHEDULE_APPOINTMENT" ? "APPOINTMENT_RESCHEDULE" : "APPOINTMENT_LOOKUP",
    state: "LOGIN_REQUIRED",
    nextStep: "LOGIN",
    draft,
    suggestedActions: [
      { type: "LOGIN_REQUIRED", label: "Đăng nhập để xem lịch", payload: { next: "/tai-khoan/lich-hen" } },
      CONTACT_STAFF_ACTION,
    ],
  }),
});

/** Các lịch còn có thể tự hủy (đúng trạng thái, chưa qua mốc khóa hủy), sớm nhất trước. */
const cancellableAppointments = async (patientId: string, now: Date) => {
  const lists = await Promise.all(
    PATIENT_CANCEL_ALLOWED_STATUSES.map((status) => PatientPortalService.listAppointments(patientId, { page: 1, limit: 20, status })),
  );
  return lists
    .flatMap((list) => list.items as PortalAppointment[])
    .filter((item) => canCancel(item, now))
    .sort((a, b) => `${dateOf(a)} ${a.startTime}`.localeCompare(`${dateOf(b)} ${b.startTime}`));
};

/** Chọn lịch theo cách người dùng nói: mã đặt lịch, hoặc ngày ("lịch ngày mai"); không nói gì thì giữ tất cả. */
const narrowByReference = (items: PortalAppointment[], text: string, today: string) => {
  const code = text.match(BOOKING_CODE)?.[0]?.toUpperCase();
  if (code) return items.filter((item) => item.bookingCode.toUpperCase() === code);
  const { date, preferredTime } = parseVietnameseDateTime(text, today);
  let narrowed = date ? items.filter((item) => dateOf(item) === date) : items;
  if (preferredTime) narrowed = narrowed.filter((item) => item.startTime === preferredTime);
  return narrowed;
};

const askConfirmation = (item: PortalAppointment, input: FlowInput, now: Date): AppointmentFlowResult => {
  const pending: PendingAction = {
    type: "CANCEL_APPOINTMENT",
    appointmentId: item.id,
    userId: input.actor!.userId,
    sessionId: input.session.id,
    nonce: randomUUID(),
    expiresAt: new Date(now.getTime() + CONFIRMATION_TTL_MS).toISOString(),
  };
  return {
    personal: true,
    pendingAction: pending,
    output: output({
      reply: `Bạn muốn hủy ${describe(item)}? Thao tác này không hoàn tác được. Bấm "Xác nhận hủy lịch" trong 5 phút tới để hủy, hoặc "Không hủy nữa" để giữ lịch.`,
      intent: "APPOINTMENT_CANCEL",
      state: "AWAITING_CONFIRMATION",
      nextStep: "CONFIRM_ACTION",
      draft: input.draft,
      results: appointmentCards([item], now, "Lịch sẽ hủy"),
      suggestedActions: [
        { type: "CONFIRM_CANCEL_APPOINTMENT", label: "Xác nhận hủy lịch", payload: { nonce: pending.nonce } },
        { type: "DISMISS_PENDING_ACTION", label: "Không hủy nữa", payload: {} },
      ],
    }),
  };
};

class AppointmentFlow {
  async handle(input: FlowInput): Promise<AppointmentFlowResult> {
    const now = input.now ?? new Date();
    if (!input.actor) return loginRequired(input.operation, input.draft);

    if (input.action?.type === "DISMISS_PENDING_ACTION") {
      return {
        personal: false,
        pendingAction: null,
        output: output({ reply: "Mình giữ nguyên lịch hẹn của bạn, không hủy gì cả.", intent: "APPOINTMENT_CANCEL", state: "BOOKING_GUIDE", draft: input.draft, suggestedActions: [LOOKUP_PORTAL_ACTION] }),
      };
    }
    if (input.action?.type === "CONFIRM_CANCEL_APPOINTMENT") return this.confirmCancel(input, now);
    if (input.action?.type === "SELECT_APPOINTMENT") return this.selectForCancel(input, now);

    if (input.operation === "CANCEL_APPOINTMENT") return this.startCancel(input, now);
    if (input.operation === "RESCHEDULE_APPOINTMENT") return this.reschedule(input, now);
    return this.lookup(input, now);
  }

  private async lookup(input: FlowInput, now: Date): Promise<AppointmentFlowResult> {
    const { items } = await PatientPortalService.listAppointments(input.actor!.userId, { page: 1, limit: 10 });
    const today = getVietnamNowParts(now).date;
    const narrowed = narrowByReference(items as PortalAppointment[], `${input.message} ${input.appointmentRef ?? ""}`, today);
    const shown = narrowed.length ? narrowed : (items as PortalAppointment[]);
    return {
      personal: true,
      output: output({
        reply: shown.length
          ? narrowed.length
            ? `Mình tìm thấy ${Math.min(shown.length, MAX_CARDS)} lịch hẹn trong tài khoản của bạn. Bạn mở "Lịch hẹn của tôi" để xem đầy đủ chi tiết và hóa đơn.`
            : "Mình không thấy lịch khớp đúng điều bạn nhắc, đây là các lịch gần nhất trong tài khoản của bạn."
          : "Tài khoản của bạn chưa có lịch hẹn nào. Bạn muốn đặt lịch khám không?",
        intent: "APPOINTMENT_LOOKUP",
        draft: input.draft,
        results: appointmentCards(shown, now, "Lịch hẹn của bạn"),
        suggestedActions: shown.length ? [LOOKUP_PORTAL_ACTION] : [{ type: "VIEW_DEPARTMENTS", label: "Đặt lịch khám", payload: {} }],
      }),
    };
  }

  private async startCancel(input: FlowInput, now: Date): Promise<AppointmentFlowResult> {
    const today = getVietnamNowParts(now).date;
    const candidates = await cancellableAppointments(input.actor!.userId, now);
    if (!candidates.length) {
      return {
        personal: false,
        output: output({
          reply: "Hiện bạn không có lịch nào còn tự hủy được (lịch đã quá mốc khóa hủy hoặc đang được khám thì cần nhân viên hỗ trợ).",
          intent: "APPOINTMENT_CANCEL",
          draft: input.draft,
          suggestedActions: [LOOKUP_PORTAL_ACTION, CONTACT_STAFF_ACTION],
        }),
      };
    }
    const narrowed = narrowByReference(candidates, `${input.message} ${input.appointmentRef ?? ""}`, today);
    if (narrowed.length === 1) return askConfirmation(narrowed[0], input, now);

    const options = narrowed.length ? narrowed : candidates;
    return {
      personal: true,
      pendingAction: null,
      output: output({
        reply:
          narrowed.length || candidates.length > 1
            ? "Bạn muốn hủy lịch nào? Chọn một lịch bên dưới, mình sẽ hỏi xác nhận trước khi hủy."
            : "Mình không thấy lịch khớp điều bạn nhắc. Đây là các lịch còn tự hủy được, bạn chọn lịch cần hủy nhé.",
        intent: "APPOINTMENT_CANCEL",
        draft: input.draft,
        results: appointmentCards(options, now, "Lịch có thể hủy"),
        suggestedActions: options.slice(0, 3).map((item) => ({
          type: "SELECT_APPOINTMENT" as const,
          label: `Hủy ${item.startTime} ${formatDateLabel(dateOf(item))}`,
          payload: { appointmentId: item.id },
        })),
      }),
    };
  }

  private async selectForCancel(input: FlowInput, now: Date): Promise<AppointmentFlowResult> {
    const appointmentId = String(input.action?.payload?.appointmentId ?? "");
    const item = await this.findOwned(input.actor!.userId, appointmentId);
    if (!item) return this.notFound(input);
    if (!canCancel(item, now)) return this.notCancellable(item, input, now);
    return askConfirmation(item, input, now);
  }

  private async confirmCancel(input: FlowInput, now: Date): Promise<AppointmentFlowResult> {
    const nonce = String(input.action?.payload?.nonce ?? "");
    const pending = input.session.pendingAction;
    // Xác nhận chỉ hợp lệ khi khớp đúng thao tác đang chờ của phiên này, tài khoản này, còn hạn. Nút cũ, nút của phiên khác,
    // bấm lần hai đều rơi vào đây và không làm gì thêm (idempotent).
    const valid =
      pending &&
      pending.nonce === nonce &&
      pending.userId === input.actor!.userId &&
      pending.sessionId === input.session.id &&
      new Date(pending.expiresAt).getTime() > now.getTime();
    if (!valid) {
      const expired = pending && pending.nonce === nonce && new Date(pending.expiresAt).getTime() <= now.getTime();
      return {
        personal: false,
        pendingAction: expired ? null : undefined,
        output: output({
          reply: expired
            ? "Yêu cầu xác nhận đã hết hạn nên mình chưa hủy gì. Nếu vẫn muốn hủy, bạn nói lại với mình nhé."
            : "Yêu cầu hủy này không còn hiệu lực (đã xử lý hoặc đã được thay bằng yêu cầu khác), nên mình không hủy thêm gì.",
          intent: "APPOINTMENT_CANCEL",
          draft: input.draft,
          suggestedActions: [LOOKUP_PORTAL_ACTION],
        }),
      };
    }
    // Giành quyền thực hiện bằng cách xóa thao tác chờ có điều kiện theo mã: hai lần bấm đồng thời chỉ một lần đi tiếp.
    if (!(await claimPendingAction(input.session.id, nonce))) {
      return {
        personal: false,
        pendingAction: null,
        output: output({ reply: "Yêu cầu hủy này đang hoặc đã được xử lý rồi.", intent: "APPOINTMENT_CANCEL", draft: input.draft, suggestedActions: [LOOKUP_PORTAL_ACTION] }),
      };
    }

    // Kiểm lại ngay trước khi hủy: lịch có thể đã đổi trạng thái hoặc qua mốc khóa hủy trong lúc chờ xác nhận.
    const item = await this.findOwned(input.actor!.userId, pending.appointmentId);
    if (!item) return { ...this.notFound(input), pendingAction: null };
    if (!canCancel(item, now)) return { ...this.notCancellable(item, input, now), pendingAction: null };

    try {
      const cancelled = await PatientPortalService.cancelAppointment(input.actor!.userId, item.id, CANCEL_REASON);
      return {
        personal: true,
        pendingAction: null,
        mutated: true,
        output: output({
          reply: `Mình đã hủy ${describe(cancelled)}. Bạn sẽ nhận thông báo xác nhận trong tài khoản. Nếu cần, bạn có thể đặt lịch mới bất cứ lúc nào.`,
          intent: "APPOINTMENT_CANCEL",
          draft: input.draft,
          results: appointmentCards([cancelled], now, "Lịch đã hủy"),
          suggestedActions: [{ type: "VIEW_DEPARTMENTS", label: "Đặt lịch mới", payload: {} }, LOOKUP_PORTAL_ACTION],
        }),
      };
    } catch (error) {
      // Lỗi nghiệp vụ (quá mốc khóa hủy, trạng thái vừa đổi) có thông báo dành cho người dùng; lỗi khác để tầng trên xử lý.
      if (!(error instanceof AppError) || error.statusCode >= 500) throw error;
      return {
        personal: false,
        pendingAction: null,
        output: output({ reply: `${error.message}`, intent: "APPOINTMENT_CANCEL", draft: input.draft, suggestedActions: [LOOKUP_PORTAL_ACTION, CONTACT_STAFF_ACTION] }),
      };
    }
  }

  /** Người khám chưa có thao tác đổi lịch an toàn (chỉ nhân viên đổi được), nên chuyển sang nhân viên hoặc hủy rồi đặt lại. */
  private async reschedule(input: FlowInput, now: Date): Promise<AppointmentFlowResult> {
    const candidates = await cancellableAppointments(input.actor!.userId, now);
    return {
      personal: candidates.length > 0,
      output: output({
        reply:
          "Hiện việc đổi ngày giờ lịch hẹn do nhân viên cơ sở khám thực hiện để bảo đảm còn chỗ với bác sĩ. Bạn liên hệ nhân viên kèm mã đặt lịch, hoặc tự hủy lịch cũ (khi còn trước mốc khóa hủy) rồi đặt lịch mới.",
        intent: "APPOINTMENT_RESCHEDULE",
        draft: input.draft,
        results: appointmentCards(candidates, now, "Lịch sắp tới của bạn"),
        suggestedActions: [CONTACT_STAFF_ACTION, LOOKUP_PORTAL_ACTION],
      }),
    };
  }

  private async findOwned(patientId: string, appointmentId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(appointmentId)) return null;
    try {
      return await PatientPortalService.getAppointment(patientId, appointmentId);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) return null;
      throw error;
    }
  }

  private notFound(input: FlowInput): AppointmentFlowResult {
    return {
      personal: false,
      output: output({ reply: "Mình không tìm thấy lịch này trong tài khoản của bạn.", intent: "APPOINTMENT_CANCEL", draft: input.draft, suggestedActions: [LOOKUP_PORTAL_ACTION] }),
    };
  }

  private notCancellable(item: PortalAppointment, input: FlowInput, now: Date): AppointmentFlowResult {
    const reason = PATIENT_CANCEL_ALLOWED_STATUSES.includes(item.status)
      ? "đã qua mốc tự hủy theo chính sách"
      : "không còn ở trạng thái tự hủy được";
    return {
      personal: true,
      output: output({
        reply: `Lịch ${item.bookingCode} ${reason}. Bạn liên hệ nhân viên để được hỗ trợ nhé.`,
        intent: "APPOINTMENT_CANCEL",
        draft: input.draft,
        results: appointmentCards([item], now, "Lịch hẹn"),
        suggestedActions: [CONTACT_STAFF_ACTION, LOOKUP_PORTAL_ACTION],
      }),
    };
  }
}

export default new AppointmentFlow();
