import { randomUUID } from "crypto";
import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { sanitizeBookingDraft } from "./rules/draft-sanitizer.js";
import type {
  ChatBookingDraft,
  ChatServiceMode,
  ChatTimePeriod,
} from "./chatbot.types.js";
import type { ChatbotResponse } from "./chatbot.types.js";

const readString = (payload: Record<string, unknown> | undefined, key: string) => {
  const value = payload?.[key];
  return typeof value === "string" ? value : undefined;
};
const readStringArray = (
  payload: Record<string, unknown>,
  key: string,
) => {
  const value = payload[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
};

const readSeverity = (
  payload: Record<string, unknown>,
): ChatBookingDraft["symptomSeverity"] => {
  const value = readString(payload, "symptomSeverity");
  return value === "MILD" ||
    value === "MODERATE" ||
    value === "SEVERE" ||
    value === "UNKNOWN"
    ? value
    : undefined;
};

const readServiceMode = (
  payload: Record<string, unknown>,
): ChatServiceMode | undefined => {
  const value = readString(payload, "serviceMode");
  return value === "DOCTOR_ONLY" || value === "PACKAGE" ? value : undefined;
};

const readTimePeriod = (
  payload: Record<string, unknown>,
): ChatTimePeriod | undefined => {
  const value = readString(payload, "timePeriod");
  return value === "MORNING" || value === "AFTERNOON" || value === "EVENING"
    ? value
    : undefined;
};

const DEFAULT_SESSION_EXPIRES_DAYS = 7;

const getSessionExpiresAt = (sessionExpiresDays = DEFAULT_SESSION_EXPIRES_DAYS) =>
  new Date(Date.now() + sessionExpiresDays * 24 * 60 * 60 * 1000);

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toPrismaJson = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const readDraft = (value: unknown): ChatBookingDraft => {
  if (!isObject(value)) return {};

  return sanitizeBookingDraft({
    departmentId: readString(value, "departmentId"),
    departmentSlug: readString(value, "departmentSlug"),
    packageId: readString(value, "packageId"),
    packageSlug: readString(value, "packageSlug"),
    serviceMode: readServiceMode(value),
    doctorId: readString(value, "doctorId"),
    date: readString(value, "date"),
    timeSlotId: readString(value, "timeSlotId"),
    timePeriod: readTimePeriod(value),
    symptoms: readStringArray(value, "symptoms"),
    bodyParts: readStringArray(value, "bodyParts"),
    symptomDuration: readString(value, "symptomDuration"),
    symptomSeverity: readSeverity(value),
    associatedSymptoms: readStringArray(value, "associatedSymptoms"),
    triageLastQuestion: readString(value, "triageLastQuestion"),
    reason: readString(value, "reason"),
    focus: isObject(value.focus) ? (value.focus as unknown as ChatBookingDraft["focus"]) : undefined,
  });
};

export const getOrCreateChatSession = async (
  sessionId?: string,
  phone?: string,
  sessionExpiresDays = DEFAULT_SESSION_EXPIRES_DAYS,
) => {
  if (sessionId) {
    const existingSession = await prisma.chatbotSession.findUnique({
      where: { id: sessionId },
    });

    if (existingSession) {
      if (!existingSession.expiresAt || existingSession.expiresAt <= new Date()) {
        const resetSession = await prisma.chatbotSession.update({
          where: { id: sessionId },
          data: {
            draft: toPrismaJson({}),
            currentIntent: null,
            currentState: null,
            lastActions: toPrismaJson([]),
            lastMessage: null,
            lastResponse: null,
            isActive: true,
            guestPhone: phone,
            expiresAt: getSessionExpiresAt(sessionExpiresDays),
          },
        });

        return {
          id: resetSession.id,
          draft: {},
          lastMessage: null as string | null,
          lastIntent: null as string | null,
        };
      }

      return {
        id: existingSession.id,
        draft: readDraft(existingSession.draft),
        lastMessage: existingSession.lastMessage,
        lastIntent: existingSession.currentIntent,
      };
    }
  }

  const session = await prisma.chatbotSession.create({
    data: {
      id: sessionId || randomUUID(),
      guestPhone: phone,
      expiresAt: getSessionExpiresAt(sessionExpiresDays),
    },
  });

  return {
    id: session.id,
    draft: readDraft(session.draft),
    lastMessage: null as string | null,
    lastIntent: null as string | null,
  };
};

export const updateChatSession = async (
  sessionId: string,
  response: ChatbotResponse,
  message: string,
  phone?: string,
  sessionExpiresDays = DEFAULT_SESSION_EXPIRES_DAYS,
) => {
  await prisma.chatbotSession.update({
    where: { id: sessionId },
    data: {
      guestPhone: phone,
      draft: toPrismaJson(response.draft),
      currentIntent: response.intent,
      currentState: response.state,
      lastActions: toPrismaJson(response.suggestedActions),
      lastMessage: message,
      lastResponse: response.reply,
      isActive: true,
      expiresAt: getSessionExpiresAt(sessionExpiresDays),
    },
  });
};


export const mergeDrafts = (...drafts: (ChatBookingDraft | undefined)[]) =>
  drafts.reduce<ChatBookingDraft>(
    (result, draft) => ({
      ...result,
      ...(draft || {}),
      symptoms: Array.from(
        new Set([...(result.symptoms || []), ...((draft || {}).symptoms || [])]),
      ),
      bodyParts: Array.from(
        new Set([...(result.bodyParts || []), ...((draft || {}).bodyParts || [])]),
      ),
      associatedSymptoms: Array.from(
        new Set([
          ...(result.associatedSymptoms || []),
          ...((draft || {}).associatedSymptoms || []),
        ]),
      ),
    }),
    {},
  );
