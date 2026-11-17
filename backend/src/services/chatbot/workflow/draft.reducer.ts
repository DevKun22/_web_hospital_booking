import type { NLUResult } from "../ai/nlu.schema.js";
import type {
  ChatAction,
  ChatBookingDraft,
  ChatServiceMode,
} from "../chatbot.types.js";
import { sanitizeBookingDraft } from "../rules/draft-sanitizer.js";

const readString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const readServiceMode = (
  payload: Record<string, unknown>,
): ChatServiceMode | undefined => {
  const value = readString(payload, "serviceMode");
  return value === "DOCTOR_ONLY" || value === "PACKAGE" ? value : undefined;
};

const readPrefill = (payload: Record<string, unknown>) => {
  const prefill = payload.prefill;
  return prefill && typeof prefill === "object" && !Array.isArray(prefill)
    ? (prefill as Record<string, unknown>)
    : {};
};

const clearRequestedFields = (
  draft: ChatBookingDraft,
  fields: NLUResult["correction"]["clearFields"],
) => {
  const next = { ...draft };

  for (const field of fields) {
    if (field === "department") {
      next.departmentId = undefined;
      next.departmentSlug = undefined;
      next.packageId = undefined;
      next.packageSlug = undefined;
      next.serviceMode = undefined;
      next.doctorId = undefined;
      next.timeSlotId = undefined;
    }
    if (field === "package") {
      next.packageId = undefined;
      next.packageSlug = undefined;
      next.serviceMode = undefined;
    }
    if (field === "doctor") {
      next.doctorId = undefined;
      next.timeSlotId = undefined;
    }
    if (field === "date") {
      next.date = undefined;
      next.timeSlotId = undefined;
    }
    if (field === "slot") next.timeSlotId = undefined;
    if (field === "symptoms") {
      next.symptoms = [];
      next.bodyParts = [];
      next.symptomDuration = undefined;
      next.symptomSeverity = undefined;
      next.associatedSymptoms = [];
      next.triageLastQuestion = undefined;
    }
  }

  return next;
};

class ChatbotDraftReducer {
  reduce(
    current: ChatBookingDraft,
    patch: Partial<ChatBookingDraft>,
    correction: NLUResult["correction"],
  ) {
    const base = clearRequestedFields(current, correction.clearFields);
    const departmentChanged =
      Boolean(patch.departmentId) && patch.departmentId !== base.departmentId;
    const doctorChanged = Boolean(patch.doctorId) && patch.doctorId !== base.doctorId;
    const dateChanged = Boolean(patch.date) && patch.date !== base.date;
    const periodChanged =
      Boolean(patch.timePeriod) && patch.timePeriod !== base.timePeriod;

    // Khi lựa chọn cha thay đổi, chỉ xóa các trường con phụ thuộc.
    // Giá trị mới trong patch được áp dụng sau bước vô hiệu hóa này.
    const invalidated: ChatBookingDraft = {
      ...base,
      ...(departmentChanged
        ? {
            packageId: undefined,
            packageSlug: undefined,
            serviceMode: undefined,
            doctorId: undefined,
            timeSlotId: undefined,
          }
        : {}),
      ...(doctorChanged || dateChanged || periodChanged
        ? { timeSlotId: undefined }
        : {}),
    };

    const mergedSymptoms = Array.from(
      new Set([...(invalidated.symptoms || []), ...(patch.symptoms || [])]),
    );
    const mergedBodyParts = Array.from(
      new Set([...(invalidated.bodyParts || []), ...(patch.bodyParts || [])]),
    );
    const mergedAssociatedSymptoms = Array.from(
      new Set([
        ...(invalidated.associatedSymptoms || []),
        ...(patch.associatedSymptoms || []),
      ]),
    );

    return sanitizeBookingDraft({
      ...invalidated,
      ...Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      ),
      symptoms: mergedSymptoms,
      bodyParts: mergedBodyParts,
      associatedSymptoms: mergedAssociatedSymptoms,
    });
  }

  reduceAction(current: ChatBookingDraft, action?: ChatAction) {
    if (!action) return current;

    const payload =
      action.payload && typeof action.payload === "object" ? action.payload : {};
    const prefill = readPrefill(payload);
    let patch: Partial<ChatBookingDraft> = {};

    if (action.type === "CLEAR_SELECTION") {
      const field = readString(payload, "field");
      const allowed = ["department", "package", "doctor", "date", "slot"] as const;
      const clearable = allowed.find((item) => item === field);
      return sanitizeBookingDraft(clearRequestedFields(current, clearable ? [clearable] : []));
    }

    if (action.type === "VIEW_DEPARTMENTS") {
      return sanitizeBookingDraft({
        ...current,
        departmentId: undefined,
        departmentSlug: undefined,
        packageId: undefined,
        packageSlug: undefined,
        serviceMode: undefined,
        doctorId: undefined,
        timeSlotId: undefined,
      });
    }
    if (action.type === "VIEW_PACKAGES") {
      return sanitizeBookingDraft({
        ...current,
        packageId: undefined,
        packageSlug: undefined,
        serviceMode: undefined,
        timeSlotId: undefined,
      });
    }
    if (action.type === "VIEW_DOCTORS") {
      const serviceMode = readServiceMode(payload);

      return sanitizeBookingDraft({
        ...current,
        ...(serviceMode === "DOCTOR_ONLY"
          ? {
              packageId: undefined,
              packageSlug: undefined,
              serviceMode,
            }
          : {}),
        doctorId: undefined,
        timeSlotId: undefined,
      });
    }

    if (action.type === "VIEW_DEPARTMENT" || action.type === "SELECT_DEPARTMENT") {
      return sanitizeBookingDraft({
        ...current,
        departmentId: readString(payload, "departmentId"),
        departmentSlug: readString(payload, "departmentSlug"),
        packageId: undefined,
        packageSlug: undefined,
        serviceMode: undefined,
        doctorId: undefined,
        timeSlotId: undefined,
      });
    } else if (action.type === "VIEW_PACKAGE" || action.type === "SELECT_PACKAGE") {
      patch = {
        departmentId: readString(payload, "departmentId"),
        packageId: readString(payload, "packageId"),
        packageSlug: readString(payload, "packageSlug"),
        serviceMode: "PACKAGE",
      };
    } else if (action.type === "VIEW_DOCTOR" || action.type === "SELECT_DOCTOR") {
      patch = {
        departmentId: readString(payload, "departmentId"),
        serviceMode:
          current.packageId || current.serviceMode === "PACKAGE"
            ? "PACKAGE"
            : "DOCTOR_ONLY",
        doctorId: readString(payload, "doctorId"),
      };
    } else if (
      action.type === "VIEW_AVAILABLE_SLOTS" ||
      action.type === "SELECT_SLOT"
    ) {
      patch = {
        serviceMode:
          current.packageId || current.serviceMode === "PACKAGE"
            ? "PACKAGE"
            : "DOCTOR_ONLY",
        doctorId: readString(payload, "doctorId"),
        date: readString(payload, "date"),
        timeSlotId: readString(payload, "timeSlotId"),
      };
    } else if (action.type === "CHANGE_DATE") {
      const requestedDate = readString(payload, "date");
      if (!requestedDate) {
        return sanitizeBookingDraft({
          ...current,
          doctorId: readString(payload, "doctorId") || current.doctorId,
          date: undefined,
          timeSlotId: undefined,
        });
      }
      patch = {
        doctorId: readString(payload, "doctorId"),
        date: requestedDate,
      };
    } else if (action.type === "CHANGE_DOCTOR") {
      return sanitizeBookingDraft({
        ...current,
        doctorId: undefined,
        timeSlotId: undefined,
      });
    } else if (action.type === "START_BOOKING") {
      patch = {
        departmentId: readString(prefill, "departmentId"),
        packageId: readString(prefill, "packageId"),
        serviceMode:
          readServiceMode(prefill) ||
          (readString(prefill, "packageId") ? "PACKAGE" : current.serviceMode),
        doctorId: readString(prefill, "doctorId"),
        date: readString(prefill, "date"),
        timeSlotId: readString(prefill, "timeSlotId"),
        reason: readString(prefill, "reason"),
      };
    }

    return this.reduce(current, patch, { clearFields: [] });
  }
}

export default new ChatbotDraftReducer();