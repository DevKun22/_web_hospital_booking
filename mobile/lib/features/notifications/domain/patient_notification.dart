import 'package:flutter/material.dart';

enum PatientNotificationType {
  systemAnnouncement('SYSTEM_ANNOUNCEMENT'),
  appointmentConfirmed('APPOINTMENT_CONFIRMED'),
  appointmentRescheduled('APPOINTMENT_RESCHEDULED'),
  appointmentCancelled('APPOINTMENT_CANCELLED'),
  appointmentReminder('APPOINTMENT_REMINDER'),
  appointmentNoShow('APPOINTMENT_NO_SHOW'),
  appointmentCheckedIn('APPOINTMENT_CHECKED_IN'),
  appointmentInProgress('APPOINTMENT_IN_PROGRESS'),
  appointmentCompleted('APPOINTMENT_COMPLETED'),
  medicalResultPublished('MEDICAL_RESULT_PUBLISHED'),
  prescriptionIssued('PRESCRIPTION_ISSUED'),
  invoiceCreated('INVOICE_CREATED'),
  paymentSucceeded('PAYMENT_SUCCEEDED'),
  paymentRefunded('PAYMENT_REFUNDED'),
  unknown('UNKNOWN');

  const PatientNotificationType(this.apiValue);

  factory PatientNotificationType.fromApi(dynamic value) {
    final normalized = value?.toString().toUpperCase();
    return PatientNotificationType.values.firstWhere(
      (type) => type.apiValue == normalized,
      orElse: () => PatientNotificationType.unknown,
    );
  }

  final String apiValue;

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
    PatientNotificationType.invoiceCreated => const Color(0xFFFFF3DD),
    PatientNotificationType.paymentSucceeded => const Color(0xFFE4F5EF),
    PatientNotificationType.paymentRefunded => const Color(0xFFE9F3FA),
    PatientNotificationType.unknown => const Color(0xFFE8F0EE),
  };

  String get historyLabel => switch (this) {
    PatientNotificationType.systemAnnouncement => 'Thông báo bệnh viện',
    PatientNotificationType.appointmentConfirmed => 'Xác nhận lịch khám',
    PatientNotificationType.appointmentRescheduled => 'Đổi lịch khám',
    PatientNotificationType.appointmentCancelled => 'Hủy lịch khám',
    PatientNotificationType.appointmentReminder => 'Nhắc lịch khám',
    PatientNotificationType.appointmentNoShow => 'Ghi nhận không đến khám',
    PatientNotificationType.appointmentCheckedIn => 'Đã check-in',
    PatientNotificationType.appointmentInProgress => 'Đang khám',
    PatientNotificationType.appointmentCompleted => 'Hoàn thành khám',
    _ => 'Cập nhật lịch khám',
  };
}

class PatientNotification {
  const PatientNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.publishedAt,
    required this.isRead,
    this.entityType,
    this.entityId,
    this.readAt,
  });

  factory PatientNotification.fromJson(Map<String, dynamic> json) =>
      PatientNotification(
        id: json['id']?.toString() ?? '',
        type: PatientNotificationType.fromApi(json['type']),
        title: json['title']?.toString() ?? 'Thông báo mới',
        body: json['body']?.toString() ?? '',
        entityType: json['entityType']?.toString(),
        entityId: json['entityId']?.toString(),
        publishedAt:
            DateTime.tryParse(
              json['publishedAt']?.toString() ?? '',
            )?.toLocal() ??
            DateTime.fromMillisecondsSinceEpoch(0),
        readAt: DateTime.tryParse(json['readAt']?.toString() ?? '')?.toLocal(),
        isRead: json['isRead'] == true || json['readAt'] != null,
      );

  final String id;
  final PatientNotificationType type;
  final String title;
  final String body;
  final String? entityType;
  final String? entityId;
  final DateTime publishedAt;
  final DateTime? readAt;
  final bool isRead;

  bool get isAnnouncement => type == PatientNotificationType.systemAnnouncement;

  String? get safeDestination {
    final normalizedEntityType = entityType?.trim().toUpperCase();
    final normalizedEntityId = entityId?.trim();
    if (normalizedEntityId == null || normalizedEntityId.isEmpty) {
      return null;
    }

    final encodedEntityId = Uri.encodeComponent(normalizedEntityId);
    final isAppointmentNotification =
        type == PatientNotificationType.appointmentConfirmed ||
        type == PatientNotificationType.appointmentRescheduled ||
        type == PatientNotificationType.appointmentCancelled ||
        type == PatientNotificationType.appointmentReminder ||
        type == PatientNotificationType.appointmentNoShow ||
        type == PatientNotificationType.appointmentCheckedIn ||
        type == PatientNotificationType.appointmentInProgress ||
        type == PatientNotificationType.appointmentCompleted;
    final isInvoiceNotification =
        type == PatientNotificationType.invoiceCreated ||
        type == PatientNotificationType.paymentSucceeded ||
        type == PatientNotificationType.paymentRefunded;

    if (normalizedEntityType == 'APPOINTMENT' && isAppointmentNotification) {
      final query = Uri(
        queryParameters: {
          'origin': 'notification',
          'notificationType': type.apiValue,
          'notificationAt': publishedAt.toUtc().toIso8601String(),
        },
      ).query;
      return '/appointments/$encodedEntityId?$query';
    }
    if (normalizedEntityType == 'MEDICAL_RECORD' &&
        type == PatientNotificationType.medicalResultPublished) {
      return '/medical-records/$encodedEntityId';
    }
    if (normalizedEntityType == 'PRESCRIPTION' &&
        type == PatientNotificationType.prescriptionIssued) {
      return '/prescriptions/$encodedEntityId';
    }
    if (normalizedEntityType == 'INVOICE' && isInvoiceNotification) {
      return '/invoices/$encodedEntityId';
    }
    return null;
  }

  PatientNotification copyWith({bool? isRead, DateTime? readAt}) =>
      PatientNotification(
        id: id,
        type: type,
        title: title,
        body: body,
        entityType: entityType,
        entityId: entityId,
        publishedAt: publishedAt,
        readAt: readAt ?? this.readAt,
        isRead: isRead ?? this.isRead,
      );
}

class NotificationPage {
  const NotificationPage({
    required this.items,
    required this.page,
    required this.total,
    required this.unreadCount,
    required this.hasNextPage,
  });

  final List<PatientNotification> items;
  final int page;
  final int total;
  final int unreadCount;
  final bool hasNextPage;
}
