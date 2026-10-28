enum ChatbotEntryKind { doctor, department, medicalPackage }

String chatbotLocationForContext({
  required ChatbotEntryKind kind,
  required String displayName,
}) {
  final safeName = _compact(displayName);
  final prompt = switch (kind) {
    ChatbotEntryKind.doctor =>
      'Tôi muốn tìm hiểu và đặt lịch với bác sĩ $safeName.',
    ChatbotEntryKind.department =>
      'Tôi cần tư vấn lịch khám chuyên khoa $safeName.',
    ChatbotEntryKind.medicalPackage =>
      'Tôi muốn tìm hiểu gói khám $safeName và lịch phù hợp.',
  };
  return Uri(path: '/chatbot', queryParameters: {'prompt': prompt}).toString();
}

String _compact(String value) {
  final compacted = value.trim().replaceAll(RegExp(r'\s+'), ' ');
  if (compacted.length <= 120) return compacted;
  return compacted.substring(0, 120).trimRight();
}
