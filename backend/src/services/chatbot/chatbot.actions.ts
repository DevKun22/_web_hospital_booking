import { prisma } from "../../config/prisma.js";
import { isSlotStartInPastVietnamTime } from "../../utils/time.js";
import type {
  ChatBookingDraft,
  SuggestedAction,
  SuggestedActionType,
} from "./chatbot.types.js";
import { SUGGESTED_ACTION_TYPES } from "./chatbot.types.js";

const allowedActionTypes = new Set<string>(SUGGESTED_ACTION_TYPES);

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key];
  return typeof value === "string" ? value : undefined;
};

const defaultActionLabels: Record<SuggestedActionType, string> = {
  ASK_MORE_INFO: "Mô tả thêm",
  VIEW_DEPARTMENTS: "Xem chuyên khoa",
  VIEW_DEPARTMENT: "Xem chuyên khoa",
  VIEW_PACKAGES: "Xem gói khám",
  VIEW_PACKAGE: "Xem gói khám",
  VIEW_DOCTORS: "Xem bác sĩ",
  VIEW_DOCTOR: "Xem bác sĩ",
  VIEW_AVAILABLE_SLOTS: "Xem lịch trống",
  CHANGE_DATE: "Đổi ngày khám",
  CHANGE_DOCTOR: "Đổi bác sĩ",
  START_BOOKING: "Đặt lịch ngay",
  LOOKUP_APPOINTMENT: "Tra cứu lịch hẹn",
  CONTACT_STAFF: "Liên hệ hỗ trợ",
  EMERGENCY_ADVICE: "Hướng dẫn khẩn cấp",
};

export const buildStartBookingAction = (
  draft: ChatBookingDraft,
): SuggestedAction | null => {
  if (!draft.departmentId || !draft.doctorId || !draft.timeSlotId) return null;

  return {
    type: "START_BOOKING",
    label: "Đặt lịch ngay",
    payload: {
      prefill: {
        departmentId: draft.departmentId,
        packageId: draft.packageId,
        doctorId: draft.doctorId,
        timeSlotId: draft.timeSlotId,
        reason: draft.reason,
      },
    },
  };
};

class ChatbotActionService {
  async validateActions(
    actions: SuggestedAction[],
    draft: ChatBookingDraft,
    maxSuggestedActions = 3,
  ) {
    const checkedActions = await Promise.all(
      actions.map(async (action) => {
        if (!allowedActionTypes.has(action.type)) return null;
        const payload = isObject(action.payload) ? action.payload : {};
        if (!(await this.isPayloadValid(action.type, payload))) return null;

        return {
          type: action.type,
          label: action.label || defaultActionLabels[action.type],
          payload,
        } satisfies SuggestedAction;
      }),
    );

    const validActions: SuggestedAction[] = [];
    const seen = new Set<string>();

    for (const action of checkedActions) {
      if (action) {
        const payload = action.payload;
        const actionKey = [
          action.type,
          getString(payload, "departmentId") ||
            getString(payload, "departmentSlug") ||
            "",
          getString(payload, "packageId") ||
            getString(payload, "packageSlug") ||
            "",
          getString(payload, "doctorId") || "",
          getString(payload, "timeSlotId") || "",
        ].join(":");

        if (seen.has(actionKey)) continue;
        seen.add(actionKey);

        validActions.push({
          type: action.type,
          label: action.label,
          payload,
        });
      }
    }

    const bookingAction = buildStartBookingAction(draft);

    const prioritizedActions =
      bookingAction &&
      !validActions.some((action) => action.type === "START_BOOKING")
        ? [bookingAction, ...validActions]
        : validActions;

    return prioritizedActions.slice(
      0,
      Math.min(Math.max(maxSuggestedActions, 1), 6),
    );
  }

  private async isPayloadValid(
    type: SuggestedActionType,
    payload: Record<string, unknown>,
  ) {
    if (type === "VIEW_DEPARTMENT") {
      const departmentId = getString(payload, "departmentId");
      const departmentSlug = getString(payload, "departmentSlug");

      if (!departmentId && !departmentSlug) return false;

      const department = await prisma.department.findFirst({
        where: {
          isActive: true,
          OR: [
            ...(departmentId ? [{ id: departmentId }] : []),
            ...(departmentSlug ? [{ slug: departmentSlug }] : []),
          ],
        },
        select: { id: true },
      });

      return Boolean(department);
    }

    if (type === "VIEW_PACKAGE") {
      const packageId = getString(payload, "packageId");
      const packageSlug = getString(payload, "packageSlug");

      if (!packageId && !packageSlug) return false;

      const packageItem = await prisma.package.findFirst({
        where: {
          isActive: true,
          OR: [
            ...(packageId ? [{ id: packageId }] : []),
            ...(packageSlug ? [{ slug: packageSlug }] : []),
          ],
        },
        select: { id: true },
      });

      return Boolean(packageItem);
    }

    if (type === "VIEW_DOCTOR") {
      const doctorId = getString(payload, "doctorId");
      if (!doctorId) return false;

      const doctor = await prisma.doctorProfile.findFirst({
        where: {
          id: doctorId,
          isAvailable: true,
          user: { isActive: true },
        },
        select: { id: true },
      });

      return Boolean(doctor);
    }

    if (type === "VIEW_AVAILABLE_SLOTS") {
      const timeSlotId = getString(payload, "timeSlotId");
      if (!timeSlotId) return false;

      const slot = await prisma.doctorTimeSlot.findFirst({
        where: {
          id: timeSlotId,
          status: "AVAILABLE",
          isActive: true,
        },
        select: { id: true, date: true, startTime: true },
      });

      if (!slot) return false;

      return !isSlotStartInPastVietnamTime(slot.date, slot.startTime);
    }

    return true;
  }
}

export default new ChatbotActionService();
