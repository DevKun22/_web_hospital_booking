import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/patient_notification.dart';

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
    PatientNotificationType.systemAnnouncement => const Color(0xFF006B5F),
    PatientNotificationType.appointmentConfirmed => const Color(0xFF237A57),
    PatientNotificationType.appointmentRescheduled => const Color(0xFFA4660D),
    PatientNotificationType.appointmentCancelled => const Color(0xFFB64048),
    PatientNotificationType.appointmentReminder => const Color(0xFF2B6F9E),
    PatientNotificationType.appointmentNoShow => const Color(0xFFB64048),
    PatientNotificationType.appointmentCheckedIn => const Color(0xFF2B6F9E),
    PatientNotificationType.appointmentInProgress => const Color(0xFF6556A5),
    PatientNotificationType.appointmentCompleted => const Color(0xFF237A57),
    PatientNotificationType.medicalResultPublished => const Color(0xFF237A57),
    PatientNotificationType.prescriptionIssued => const Color(0xFF6556A5),
    PatientNotificationType.prescriptionDispensed => const Color(0xFF237A57),
    PatientNotificationType.invoiceCreated => const Color(0xFFA4660D),
    PatientNotificationType.paymentSucceeded => const Color(0xFF237A57),
    PatientNotificationType.paymentRefunded => const Color(0xFF2B6F9E),
    PatientNotificationType.unknown => const Color(0xFF647B7E),
  };

  Color get background => switch (this) {
    PatientNotificationType.systemAnnouncement => const Color(0xFFDDF6F1),
    PatientNotificationType.appointmentConfirmed => const Color(0xFFE4F5EF),
    PatientNotificationType.appointmentRescheduled => const Color(0xFFFFF3DD),
    PatientNotificationType.appointmentCancelled => const Color(0xFFFCEBED),
    PatientNotificationType.appointmentReminder => const Color(0xFFE9F3FA),
    PatientNotificationType.appointmentNoShow => const Color(0xFFFCEBED),
    PatientNotificationType.appointmentCheckedIn => const Color(0xFFE9F3FA),
    PatientNotificationType.appointmentInProgress => const Color(0xFFF0ECFA),
    PatientNotificationType.appointmentCompleted => const Color(0xFFE4F5EF),
    PatientNotificationType.medicalResultPublished => const Color(0xFFE4F5EF),
    PatientNotificationType.prescriptionIssued => const Color(0xFFF0ECFA),
    PatientNotificationType.prescriptionDispensed => const Color(0xFFE4F5EF),
    PatientNotificationType.invoiceCreated => const Color(0xFFFFF3DD),
    PatientNotificationType.paymentSucceeded => const Color(0xFFE4F5EF),
    PatientNotificationType.paymentRefunded => const Color(0xFFE9F3FA),
    PatientNotificationType.unknown => const Color(0xFFE8F0EE),
  };
}
