import { randomUUID } from "crypto";
import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { sanitizeBookingDraft } from "./rules/draft-sanitizer.js";
import type { ChatBookingDraft, ChatbotActor, ChatbotResponse, ChatOperation } from "./chatbot.types.js";

// Phiên trò chuyện do máy chủ làm chủ: bản nháp đặt lịch, vài lượt gần nhất, thao tác đang chờ xác nhận đều đọc từ DB,
// không lấy từ body của client. Phiên gắn với tài khoản khi người khám đăng nhập; mã phiên KHÔNG phải bằng chứng danh tính
// (danh tính chỉ lấy từ token đã xác thực), nên mọi lệch giữa phiên và tài khoản đều dẫn tới phiên mới, không gộp ngữ cảnh.

const DEFAULT_SESSION_EXPIRES_DAYS = 7;
export const MAX_HISTORY_TURNS = 5;
const MAX_HISTORY_TEXT = 300;

export type ChatHistoryTurn = { user: string; operation: ChatOperation | null; at: string };

/** Thao tác đang chờ người dùng bấm xác nhận. Gắn chặt với tài khoản, lịch hẹn, phiên, hạn dùng và mã một lần. */
export type PendingAction = {
  type: "CANCEL_APPOINTMENT";
  appointmentId: string;
  userId: string;
  sessionId: string;
  nonce: string;
  expiresAt: string;
};

export type ChatSessionState = {
  id: string;
  userId: string | null;
  draft: ChatBookingDraft;
  history: ChatHistoryTurn[];
  pendingAction: PendingAction | null;
  lastMessage: string | null;
  lastIntent: string | null;
  lastState: string | null;
  version: number;
  /** Phiên này vừa được tạo mới hoặc xoay (để trả mã phiên mới cho client và ghi vào vết). */
  binding: SessionBinding;
};

/**
 * Cách xử lý mã phiên client gửi lên, theo tài khoản đã xác thực:
 * - CREATE: không có / không tìm thấy / đã hết hạn → phiên mới với mã do máy chủ sinh (không nhận mã client tự đặt: chống cố định phiên).
 * - REUSE: phiên khách và người gửi là khách, hoặc phiên đã gắn đúng tài khoản này.
 * - ROTATE_ON_LOGIN: phiên khách, người gửi vừa đăng nhập → phiên mới gắn tài khoản, chỉ mang theo bản nháp đặt lịch và các lượt gần nhất.
 * - DETACH: phiên đã gắn tài khoản nhưng người gửi là khách hoặc tài khoản khác → phiên mới trống, không mang gì theo.
 */
export type SessionBinding = "CREATE" | "REUSE" | "ROTATE_ON_LOGIN" | "DETACH";

export const decideSessionBinding = (
  session: { userId: string | null; expiresAt: Date | null; isActive: boolean } | null,
  actor: ChatbotActor,
  now = new Date(),
): SessionBinding => {
  if (!session || !session.isActive || !session.expiresAt || session.expiresAt <= now) return "CREATE";
  const actorId = actor?.userId ?? null;
  if (session.userId === actorId) return "REUSE";
  if (!session.userId && actorId) return "ROTATE_ON_LOGIN";
  return "DETACH";
};

const getSessionExpiresAt = (days = DEFAULT_SESSION_EXPIRES_DAYS) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toPrismaJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
/** Cột Json cho phép null: null phải ghi bằng DbNull của Prisma. */
const nullableJson = (value: unknown) => (value === null || value === undefined ? Prisma.DbNull : toPrismaJson(value));

const readDraft = (value: unknown): ChatBookingDraft => (isObject(value) ? sanitizeBookingDraft(value as ChatBookingDraft) : {});

const readHistory = (value: unknown): ChatHistoryTurn[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is ChatHistoryTurn => isObject(item) && typeof item.user === "string")
        .map((item) => ({ user: item.user.slice(0, MAX_HISTORY_TEXT), operation: (item.operation as ChatOperation) ?? null, at: String(item.at ?? "") }))
        .slice(-MAX_HISTORY_TURNS)
    : [];

const readPending = (value: unknown): PendingAction | null => {
  if (!isObject(value) || value.type !== "CANCEL_APPOINTMENT") return null;
  const fields = ["appointmentId", "userId", "sessionId", "nonce", "expiresAt"] as const;
  if (!fields.every((field) => typeof value[field] === "string" && value[field])) return null;
  return value as unknown as PendingAction;
};

const sessionSelect = {
  id: true,
  userId: true,
  draft: true,
  history: true,
  pendingAction: true,
  lastMessage: true,
  currentIntent: true,
  currentState: true,
  isActive: true,
  expiresAt: true,
  version: true,
} as const;

type SessionRow = Prisma.ChatbotSessionGetPayload<{ select: typeof sessionSelect }>;

const toState = (row: SessionRow, binding: SessionBinding): ChatSessionState => ({
  id: row.id,
  userId: row.userId,
  draft: readDraft(row.draft),
  history: readHistory(row.history),
  pendingAction: readPending(row.pendingAction),
  lastMessage: row.lastMessage,
  lastIntent: row.currentIntent,
  lastState: row.currentState,
  version: row.version,
  binding,
});

/** Mở phiên cho một tin nhắn theo quy tắc ở decideSessionBinding. Phiên cũ bị thay (xoay hoặc tách) được đánh dấu ngừng dùng. */
export const openChatSession = async (
  requestedId: string | undefined,
  actor: ChatbotActor,
  sessionExpiresDays = DEFAULT_SESSION_EXPIRES_DAYS,
): Promise<ChatSessionState> => {
  const existing = requestedId ? await prisma.chatbotSession.findUnique({ where: { id: requestedId }, select: sessionSelect }) : null;
  const binding = decideSessionBinding(existing, actor);
  if (existing && binding === "REUSE") return toState(existing, binding);

  // Xoay khi đăng nhập: mang theo bản nháp đặt lịch (khoa, bác sĩ, giờ đã chọn) và các lượt gần nhất; không mang thao tác đang chờ.
  const carried = existing && binding === "ROTATE_ON_LOGIN" ? { draft: readDraft(existing.draft), history: readHistory(existing.history) } : null;
  const created = await prisma.$transaction(async (tx) => {
    if (existing && binding !== "CREATE") {
      await tx.chatbotSession.update({ where: { id: existing.id }, data: { isActive: false, pendingAction: Prisma.DbNull } });
    }
    return tx.chatbotSession.create({
      data: {
        id: randomUUID(),
        userId: actor?.userId ?? null,
        draft: toPrismaJson(carried?.draft ?? {}),
        history: toPrismaJson(carried?.history ?? []),
        expiresAt: getSessionExpiresAt(sessionExpiresDays),
      },
      select: sessionSelect,
    });
  });
  return toState(created, binding);
};

export const appendHistory = (history: ChatHistoryTurn[], message: string, operation: ChatOperation | null): ChatHistoryTurn[] =>
  [...history, { user: message.slice(0, MAX_HISTORY_TEXT), operation, at: new Date().toISOString() }].slice(-MAX_HISTORY_TURNS);

/**
 * Lưu kết quả một lượt với khóa lạc quan theo `version`: nếu trong lúc xử lý đã có lượt khác ghi vào phiên (hai yêu cầu đồng thời),
 * lượt đến sau không ghi đè trạng thái mới hơn. Trả về false khi bị từ chối vì xung đột.
 */
export const saveChatSession = async (
  session: ChatSessionState,
  input: {
    response: ChatbotResponse;
    message: string;
    history: ChatHistoryTurn[];
    pendingAction: PendingAction | null;
    /** Nội dung lưu làm lastResponse; câu trả lời có lịch hẹn cá nhân thì lưu bản rút gọn. */
    storedReply: string;
    sessionExpiresDays?: number;
  },
) => {
  const result = await prisma.chatbotSession.updateMany({
    where: { id: session.id, version: session.version, isActive: true },
    data: {
      draft: toPrismaJson(input.response.draft),
      currentIntent: input.response.intent,
      currentState: input.response.state,
      lastActions: toPrismaJson(input.response.suggestedActions),
      lastMessage: input.message,
      lastResponse: input.storedReply,
      history: toPrismaJson(input.history),
      pendingAction: nullableJson(input.pendingAction),
      expiresAt: getSessionExpiresAt(input.sessionExpiresDays),
      version: { increment: 1 },
    },
  });
  return result.count === 1;
};

/** Xóa thao tác đang chờ ngay khi bắt đầu thực hiện, có điều kiện theo mã một lần: hai lần bấm xác nhận chỉ một lần thắng. */
export const claimPendingAction = async (sessionId: string, nonce: string) => {
  const result = await prisma.$executeRaw`
    UPDATE "ChatbotSession" SET "pendingAction" = NULL, "updatedAt" = NOW()
    WHERE "id" = ${sessionId} AND "pendingAction"->>'nonce' = ${nonce}
  `;
  return result === 1;
};
