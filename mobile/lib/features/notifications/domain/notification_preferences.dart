enum NotificationPreferenceKind {
  generalAnnouncements(
    apiKey: 'generalAnnouncementsPush',
    label: 'Thông báo từ bệnh viện',
    description: 'Tin tức, hướng dẫn và cập nhật chung từ bệnh viện.',
  ),
  appointmentUpdates(
    apiKey: 'appointmentUpdatesPush',
    label: 'Cập nhật lịch khám',
    description: 'Xác nhận, đổi, hủy và tiến trình khám.',
  ),
  appointmentReminders(
    apiKey: 'appointmentRemindersPush',
    label: 'Nhắc lịch khám',
    description: 'Nhắc bạn chuẩn bị trước giờ khám.',
  ),
  medicalResults(
    apiKey: 'medicalResultsPush',
    label: 'Kết quả khám',
    description: 'Hồ sơ và kết quả mới được bệnh viện công bố.',
  ),
  prescriptions(
    apiKey: 'prescriptionsPush',
    label: 'Đơn thuốc',
    description: 'Đơn thuốc mới được bác sĩ phát hành.',
  ),
  billing(
    apiKey: 'billingPush',
    label: 'Hóa đơn & thanh toán',
    description: 'Hóa đơn, thanh toán và hoàn tiền đã ghi nhận.',
  );

  const NotificationPreferenceKind({
    required this.apiKey,
    required this.label,
    required this.description,
  });

  final String apiKey;
  final String label;
  final String description;
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
