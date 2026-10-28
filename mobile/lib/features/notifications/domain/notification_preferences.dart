import 'package:flutter/material.dart';

enum NotificationPreferenceKind {
  generalAnnouncements(
    apiKey: 'generalAnnouncementsPush',
    label: 'Thông báo từ bệnh viện',
    description: 'Tin tức, hướng dẫn và cập nhật chung từ bệnh viện.',
    icon: Icons.campaign_outlined,
  ),
  appointmentUpdates(
    apiKey: 'appointmentUpdatesPush',
    label: 'Cập nhật lịch khám',
    description: 'Xác nhận, đổi, hủy và tiến trình khám.',
    icon: Icons.calendar_month_outlined,
  ),
  appointmentReminders(
    apiKey: 'appointmentRemindersPush',
    label: 'Nhắc lịch khám',
    description: 'Nhắc bạn chuẩn bị trước giờ khám.',
    icon: Icons.alarm_outlined,
  ),
  medicalResults(
    apiKey: 'medicalResultsPush',
    label: 'Kết quả khám',
    description: 'Hồ sơ và kết quả mới được bệnh viện công bố.',
    icon: Icons.fact_check_outlined,
  ),
  prescriptions(
    apiKey: 'prescriptionsPush',
    label: 'Đơn thuốc',
    description: 'Đơn thuốc mới được bác sĩ phát hành.',
    icon: Icons.medication_outlined,
  ),
  billing(
    apiKey: 'billingPush',
    label: 'Hóa đơn & thanh toán',
    description: 'Hóa đơn, thanh toán và hoàn tiền đã ghi nhận.',
    icon: Icons.receipt_long_outlined,
  );

  const NotificationPreferenceKind({
    required this.apiKey,
    required this.label,
    required this.description,
    required this.icon,
  });

  final String apiKey;
  final String label;
  final String description;
  final IconData icon;
}

class NotificationPreferences {
  const NotificationPreferences({
    this.generalAnnouncementsPush = true,
    this.appointmentUpdatesPush = true,
    this.appointmentRemindersPush = true,
    this.medicalResultsPush = true,
    this.prescriptionsPush = true,
    this.billingPush = true,
  });

  factory NotificationPreferences.fromJson(Map<String, dynamic> json) =>
      NotificationPreferences(
        generalAnnouncementsPush: json['generalAnnouncementsPush'] != false,
        appointmentUpdatesPush: json['appointmentUpdatesPush'] != false,
        appointmentRemindersPush: json['appointmentRemindersPush'] != false,
        medicalResultsPush: json['medicalResultsPush'] != false,
        prescriptionsPush: json['prescriptionsPush'] != false,
        billingPush: json['billingPush'] != false,
      );

  final bool generalAnnouncementsPush;
  final bool appointmentUpdatesPush;
  final bool appointmentRemindersPush;
  final bool medicalResultsPush;
  final bool prescriptionsPush;
  final bool billingPush;

  bool valueFor(NotificationPreferenceKind kind) => switch (kind) {
    NotificationPreferenceKind.generalAnnouncements => generalAnnouncementsPush,
    NotificationPreferenceKind.appointmentUpdates => appointmentUpdatesPush,
    NotificationPreferenceKind.appointmentReminders => appointmentRemindersPush,
    NotificationPreferenceKind.medicalResults => medicalResultsPush,
    NotificationPreferenceKind.prescriptions => prescriptionsPush,
    NotificationPreferenceKind.billing => billingPush,
  };

  NotificationPreferences withValue(
    NotificationPreferenceKind kind,
    bool value,
  ) => NotificationPreferences(
    generalAnnouncementsPush:
        kind == NotificationPreferenceKind.generalAnnouncements
        ? value
        : generalAnnouncementsPush,
    appointmentUpdatesPush:
        kind == NotificationPreferenceKind.appointmentUpdates
        ? value
        : appointmentUpdatesPush,
    appointmentRemindersPush:
        kind == NotificationPreferenceKind.appointmentReminders
        ? value
        : appointmentRemindersPush,
    medicalResultsPush: kind == NotificationPreferenceKind.medicalResults
        ? value
        : medicalResultsPush,
    prescriptionsPush: kind == NotificationPreferenceKind.prescriptions
        ? value
        : prescriptionsPush,
    billingPush: kind == NotificationPreferenceKind.billing
        ? value
        : billingPush,
  );
}
