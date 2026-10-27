import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_entry_context.dart';

void main() {
  test('builds an encoded chatbot route from public context', () {
    final location = chatbotLocationForContext(
      kind: ChatbotEntryKind.doctor,
      displayName: '  BS. CKI  Nguyễn Văn An  ',
    );
    final uri = Uri.parse(location);

    expect(uri.path, '/chatbot');
    expect(
      uri.queryParameters['prompt'],
      'Tôi muốn tìm hiểu và đặt lịch với bác sĩ BS. CKI Nguyễn Văn An.',
    );
  });
}
