import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/patient_notification.dart';

import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';

/// Biểu diễn giao diện của PatientNotificationType; tách khỏi lớp domain để domain là Dart thuần.
extension PatientNotificationTypeVisuals on PatientNotificationType {
  IconData get icon => switch (this) {
    PatientNotificationType.systemAnnouncement => Icons.campaign_outlined,
    PatientNotificationType.appointmentConfirmed => Icons.verified_outlined,
    PatientNotificationType.appointmentRescheduled => Icons.update_rounded,
    PatientNotificationType.appointmentCancelled => Icons.event_busy_outlined,
    PatientNotificationType.appointmentReminder => Icons.alarm_rounded,
    PatientNotificationType.appointmentNoShow => Icons.person_off_outlined,
    PatientNotificationType.appointmentCheckedIn => Icons.how_to_reg_outlined,
    PatientNotificationType.appointmentInProgress =>
      Icons.medical_services_outlined,
    PatientNotificationType.appointmentCompleted => Icons.task_alt_rounded,
    PatientNotificationType.medicalResultPublished =>
      Icons.assignment_turned_in_outlined,
    PatientNotificationType.prescriptionIssued => Icons.medication_outlined,
    PatientNotificationType.prescriptionDispensed =>
      Icons.local_pharmacy_outlined,
    PatientNotificationType.invoiceCreated => Icons.receipt_long_outlined,
    PatientNotificationType.paymentSucceeded => Icons.payments_outlined,
    PatientNotificationType.paymentRefunded => Icons.currency_exchange_rounded,
    PatientNotificationType.unknown => Icons.notifications_none_rounded,
  };

  Color get foreground => switch (this) {
    PatientNotificationType.systemAnnouncement => AppPalette.care,
    PatientNotificationType.appointmentConfirmed => AppPalette.success,
    PatientNotificationType.appointmentRescheduled => AppPalette.warning,
    PatientNotificationType.appointmentCancelled => AppPalette.danger,
    PatientNotificationType.appointmentReminder => AppPalette.info,
    PatientNotificationType.appointmentNoShow => AppPalette.danger,
    PatientNotificationType.appointmentCheckedIn => AppPalette.info,
    PatientNotificationType.appointmentInProgress => AppPalette.violet,
    PatientNotificationType.appointmentCompleted => AppPalette.success,
    PatientNotificationType.medicalResultPublished => AppPalette.success,
    PatientNotificationType.prescriptionIssued => AppPalette.violet,
    PatientNotificationType.prescriptionDispensed => AppPalette.success,
    PatientNotificationType.invoiceCreated => AppPalette.warning,
    PatientNotificationType.paymentSucceeded => AppPalette.success,
    PatientNotificationType.paymentRefunded => AppPalette.info,
    PatientNotificationType.unknown => AppPalette.muted,
  };

  Color get background => switch (this) {
    PatientNotificationType.systemAnnouncement => AppPalette.careSoft,
    PatientNotificationType.appointmentConfirmed => AppPalette.successContainer,
    PatientNotificationType.appointmentRescheduled =>
      AppPalette.warningContainer,
    PatientNotificationType.appointmentCancelled => AppPalette.dangerContainer,
    PatientNotificationType.appointmentReminder => AppPalette.infoContainer,
    PatientNotificationType.appointmentNoShow => AppPalette.dangerContainer,
    PatientNotificationType.appointmentCheckedIn => AppPalette.infoContainer,
    PatientNotificationType.appointmentInProgress => AppPalette.violetContainer,
    PatientNotificationType.appointmentCompleted => AppPalette.successContainer,
    PatientNotificationType.medicalResultPublished =>
      AppPalette.successContainer,
    PatientNotificationType.prescriptionIssued => AppPalette.violetContainer,
    PatientNotificationType.prescriptionDispensed =>
      AppPalette.successContainer,
    PatientNotificationType.invoiceCreated => AppPalette.warningContainer,
    PatientNotificationType.paymentSucceeded => AppPalette.successContainer,
    PatientNotificationType.paymentRefunded => AppPalette.infoContainer,
    PatientNotificationType.unknown => AppPalette.surfaceMuted,
  };
}
