import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_invoice.dart';

/// Biểu diễn giao diện của PatientInvoiceStatus; tách khỏi lớp domain để domain là Dart thuần.
extension PatientInvoiceStatusVisuals on PatientInvoiceStatus {
  AppStatusTone get tone => switch (this) {
    PatientInvoiceStatus.paid => AppStatusTone.success,
    PatientInvoiceStatus.unpaid => AppStatusTone.warning,
    PatientInvoiceStatus.cancelled => AppStatusTone.danger,
    PatientInvoiceStatus.refunded ||
    PatientInvoiceStatus.unknown => AppStatusTone.info,
  };

  IconData get icon => switch (this) {
    PatientInvoiceStatus.paid => Icons.check_circle_outline,
    PatientInvoiceStatus.unpaid => Icons.schedule_outlined,
    PatientInvoiceStatus.cancelled => Icons.cancel_outlined,
    PatientInvoiceStatus.refunded => Icons.currency_exchange_outlined,
    PatientInvoiceStatus.unknown => Icons.info_outline,
  };
}
