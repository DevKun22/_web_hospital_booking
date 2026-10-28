import type { NotificationType } from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";

export const notificationPreferenceKeys = [
  "appointmentUpdatesPush",
  "appointmentRemindersPush",
  "medicalResultsPush",
  "prescriptionsPush",
  "billingPush",
  "generalAnnouncementsPush",
] as const;

export type NotificationPreferenceKey =
  (typeof notificationPreferenceKeys)[number];

export type NotificationPushPreferences = Record<
  NotificationPreferenceKey,
  boolean
>;

export const defaultNotificationPushPreferences: NotificationPushPreferences = {
  appointmentUpdatesPush: true,
  appointmentRemindersPush: true,
  medicalResultsPush: true,
  prescriptionsPush: true,
  billingPush: true,
  generalAnnouncementsPush: true,
};

const preferenceSelect = {
  appointmentUpdatesPush: true,
  appointmentRemindersPush: true,
  medicalResultsPush: true,
  prescriptionsPush: true,
  billingPush: true,
  generalAnnouncementsPush: true,
} as const;

export const notificationPreferenceKeyForType = (
  type: NotificationType,
): NotificationPreferenceKey => {
  switch (type) {
    case "SYSTEM_ANNOUNCEMENT":
      return "generalAnnouncementsPush";
    case "APPOINTMENT_REMINDER":
      return "appointmentRemindersPush";
    case "MEDICAL_RESULT_PUBLISHED":
      return "medicalResultsPush";
    case "PRESCRIPTION_ISSUED":
      return "prescriptionsPush";
    case "INVOICE_CREATED":
    case "PAYMENT_SUCCEEDED":
    case "PAYMENT_REFUNDED":
      return "billingPush";
    default:
      return "appointmentUpdatesPush";
  }
};

export const isNotificationPushEnabled = (
  type: NotificationType,
  preferences: NotificationPushPreferences | null | undefined,
) =>
  (preferences ?? defaultNotificationPushPreferences)[
    notificationPreferenceKeyForType(type)
  ];

class NotificationPreferenceService {
  async get(userId: string): Promise<NotificationPushPreferences> {
    const stored = await prisma.notificationPreference.findUnique({
      where: { userId },
      select: preferenceSelect,
    });
    return stored ?? defaultNotificationPushPreferences;
  }

  async update(
    userId: string,
    changes: Partial<NotificationPushPreferences>,
  ): Promise<NotificationPushPreferences> {
    return prisma.notificationPreference.upsert({
      where: { userId },
      update: changes,
      create: { userId, ...changes },
      select: preferenceSelect,
    });
  }
}

export default new NotificationPreferenceService();
