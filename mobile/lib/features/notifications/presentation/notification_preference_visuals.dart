import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/notification_preferences.dart';

extension NotificationPreferenceKindVisuals on NotificationPreferenceKind {
  IconData get icon => switch (this) {
    NotificationPreferenceKind.generalAnnouncements => Icons.campaign_outlined,
    NotificationPreferenceKind.appointmentUpdates =>
      Icons.calendar_month_outlined,
    NotificationPreferenceKind.appointmentReminders => Icons.alarm_outlined,
    NotificationPreferenceKind.medicalResults => Icons.fact_check_outlined,
    NotificationPreferenceKind.prescriptions => Icons.medication_outlined,
    NotificationPreferenceKind.billing => Icons.receipt_long_outlined,
  };
}
