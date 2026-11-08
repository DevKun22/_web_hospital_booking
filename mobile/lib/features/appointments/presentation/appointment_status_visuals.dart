import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';

/// Biểu diễn giao diện của PatientAppointmentStatus; tách khỏi lớp domain để domain là Dart thuần.
extension PatientAppointmentStatusVisuals on PatientAppointmentStatus {
  AppStatusTone get tone => switch (this) {
    PatientAppointmentStatus.confirmed ||
    PatientAppointmentStatus.checkedIn ||
    PatientAppointmentStatus.inProgress => AppStatusTone.success,
    PatientAppointmentStatus.pendingOtp ||
    PatientAppointmentStatus.pendingConfirm ||
    PatientAppointmentStatus.rescheduled => AppStatusTone.warning,
    PatientAppointmentStatus.cancelledByPatient ||
    PatientAppointmentStatus.cancelledByDoctor ||
    PatientAppointmentStatus.cancelledByAdmin ||
    PatientAppointmentStatus.noShow => AppStatusTone.danger,
    PatientAppointmentStatus.completed ||
    PatientAppointmentStatus.unknown => AppStatusTone.info,
  };

  IconData get icon => switch (this) {
    PatientAppointmentStatus.confirmed => Icons.verified_outlined,
    PatientAppointmentStatus.checkedIn => Icons.how_to_reg_outlined,
    PatientAppointmentStatus.inProgress => Icons.medical_services_outlined,
    PatientAppointmentStatus.completed => Icons.task_alt_outlined,
    PatientAppointmentStatus.cancelledByPatient ||
    PatientAppointmentStatus.cancelledByDoctor ||
    PatientAppointmentStatus.cancelledByAdmin => Icons.cancel_outlined,
    PatientAppointmentStatus.noShow => Icons.person_off_outlined,
    PatientAppointmentStatus.rescheduled => Icons.update_outlined,
    PatientAppointmentStatus.pendingOtp ||
    PatientAppointmentStatus.pendingConfirm => Icons.schedule_outlined,
    PatientAppointmentStatus.unknown => Icons.info_outline,
  };
}
