class PushMessage {
  const PushMessage({
    required this.messageId,
    this.title,
    this.body,
    this.data = const {},
  });

  final String messageId;
  final String? title;
  final String? body;
  final Map<String, String> data;

  String get displayTitle => _text(title) ?? 'Thông báo mới';

  String get displayBody => _text(body) ?? 'Bạn có cập nhật mới từ bệnh viện.';

  String? get notificationId => _text(data['notificationId']);

  /// Chỉ chuyển tới các route nội bộ đã được kiểm soát. Dữ liệu FCM không
  /// bao giờ được dùng trực tiếp như một URL để tránh điều hướng ngoài ý muốn.
  String get safeDestination {
    final entityType = _text(data['entityType'])?.toUpperCase();
    final entityId = _text(data['entityId']);
    if (entityType == 'APPOINTMENT' && entityId != null) {
      final type = _text(data['type'])?.toUpperCase();
      final query = Uri(
        queryParameters: {'origin': 'notification', 'notificationType': ?type},
      ).query;
      return '/appointments/${Uri.encodeComponent(entityId)}?$query';
    }
    if (entityType == 'MEDICAL_RECORD' && entityId != null) {
      return '/medical-records/${Uri.encodeComponent(entityId)}';
    }
    if (entityType == 'PRESCRIPTION' && entityId != null) {
      return '/prescriptions/${Uri.encodeComponent(entityId)}';
    }
    if (entityType == 'INVOICE' && entityId != null) {
      return '/invoices/${Uri.encodeComponent(entityId)}';
    }
    return '/notifications';
  }
}

String? _text(String? value) {
  final normalized = value?.trim();
  return normalized == null || normalized.isEmpty ? null : normalized;
}
