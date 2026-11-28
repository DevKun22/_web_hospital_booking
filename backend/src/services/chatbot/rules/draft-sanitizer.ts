import type { ChatBookingDraft, ChatFocus } from "../chatbot.types.js";
import { foldVietnamese } from "./text-normalizer.js";

const cleanupTerms = (symptoms?: string[]) =>
  Array.from(
    new Map(
      (symptoms || [])
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => [foldVietnamese(item), item]),
    ).values(),
  ).slice(0, 10);

const FOCUS_TYPES = new Set(["doctor", "department", "package"]);

const cleanFocus = (focus?: ChatFocus): ChatFocus | undefined => {
  if (!focus || typeof focus !== "object") return undefined;
  if (!FOCUS_TYPES.has(focus.type) || typeof focus.id !== "string" || typeof focus.name !== "string") return undefined;
  if (!focus.id.trim() || !focus.name.trim()) return undefined;
  return {
    type: focus.type,
    id: focus.id.trim(),
    name: focus.name.trim().slice(0, 120),
    departmentId: typeof focus.departmentId === "string" && focus.departmentId.trim() ? focus.departmentId.trim() : undefined,
  };
};

export const sanitizeBookingDraft = (
  draft: ChatBookingDraft,
): ChatBookingDraft => ({
  departmentId: draft.departmentId,
  departmentSlug: draft.departmentSlug,
  packageId: draft.packageId,
  packageSlug: draft.packageSlug,
  serviceMode: draft.packageId ? "PACKAGE" : draft.serviceMode,
  doctorId: draft.doctorId,
  date: draft.date,
  timeSlotId: draft.timeSlotId,
  timePeriod: draft.timePeriod,
  preferredTime: typeof draft.preferredTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.preferredTime) ? draft.preferredTime : undefined,
  symptoms: cleanupTerms(draft.symptoms),
  bodyParts: cleanupTerms(draft.bodyParts),
  symptomDuration: draft.symptomDuration?.trim() || undefined,
  symptomSeverity: draft.symptomSeverity,
  associatedSymptoms: cleanupTerms(draft.associatedSymptoms),
  triageLastQuestion: draft.triageLastQuestion?.trim() || undefined,
  reason: draft.reason?.trim() || undefined,
  focus: cleanFocus(draft.focus),
});