import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/patient_notification.dart';

import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

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

  Color foreground(AppColors colors) => switch (this) {
    PatientNotificationType.systemAnnouncement => colors.care,
    PatientNotificationType.appointmentConfirmed => colors.success,
    PatientNotificationType.appointmentRescheduled => colors.warning,
    PatientNotificationType.appointmentCancelled => colors.danger,
    PatientNotificationType.appointmentReminder => colors.info,
    PatientNotificationType.appointmentNoShow => colors.danger,
    PatientNotificationType.appointmentCheckedIn => colors.info,
    PatientNotificationType.appointmentInProgress => colors.violet,
    PatientNotificationType.appointmentCompleted => colors.success,
    PatientNotificationType.medicalResultPublished => colors.success,
    PatientNotificationType.prescriptionIssued => colors.violet,
    PatientNotificationType.prescriptionDispensed => colors.success,
    PatientNotificationType.invoiceCreated => colors.warning,
    PatientNotificationType.paymentSucceeded => colors.success,
    PatientNotificationType.paymentRefunded => colors.info,
    PatientNotificationType.unknown => colors.muted,
  };

  Color background(AppColors colors) => switch (this) {
    PatientNotificationType.systemAnnouncement => colors.careSoft,
    PatientNotificationType.appointmentConfirmed => colors.successContainer,
    PatientNotificationType.appointmentRescheduled => colors.warningContainer,
    PatientNotificationType.appointmentCancelled => colors.dangerContainer,
    PatientNotificationType.appointmentReminder => colors.infoContainer,
    PatientNotificationType.appointmentNoShow => colors.dangerContainer,
    PatientNotificationType.appointmentCheckedIn => colors.infoContainer,
    PatientNotificationType.appointmentInProgress => colors.violetContainer,
    PatientNotificationType.appointmentCompleted => colors.successContainer,
    PatientNotificationType.medicalResultPublished => colors.successContainer,
    PatientNotificationType.prescriptionIssued => colors.violetContainer,
    PatientNotificationType.prescriptionDispensed => colors.successContainer,
    PatientNotificationType.invoiceCreated => colors.warningContainer,
    PatientNotificationType.paymentSucceeded => colors.successContainer,
    PatientNotificationType.paymentRefunded => colors.infoContainer,
    PatientNotificationType.unknown => colors.surfaceMuted,
  };
}
