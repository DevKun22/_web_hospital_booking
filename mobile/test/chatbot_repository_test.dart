import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/chatbot/data/chatbot_repository.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_models.dart';

void main() {
  test(
    'uses the public chatbot v1 contract and parses grounded results',
    () async {
      final requests = <RequestOptions>[];
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            final data = options.path == '/chatbot/settings'
                ? {
                    'success': true,
                    'data': {
                      'isActive': true,
                      'value': {
                        'aiEnabled': true,
                        'faqEnabled': true,
                        'fallbackEnabled': true,
                      },
                    },
                  }
                : {
                    'success': true,
                    'data': {
                      'sessionId': 'session-1',
                      'source': 'AI',
                      'reply': 'Bạn có thể khám chuyên khoa Tim mạch.',
                      'intent': 'SYMPTOM_TRIAGE',
                      'state': 'SUGGESTING_DEPARTMENT',
                      'nextStep': 'CHOOSE_DEPARTMENT',
                      'confidence': 0.9,
                      'draft': {'departmentId': 'department-1'},
                      'results': [
                        {
                          'type': 'departments',
                          'title': 'Chuyên khoa phù hợp',
                          'items': [
                            {
                              'type': 'department',
                              'id': 'department-1',
                              'name': 'Tim mạch',
                            },
                          ],
                          'total': 1,
                          'limit': 3,
                        },
                      ],
                      'suggestedActions': [
                        {
                          'type': 'VIEW_DEPARTMENT',
                          'label': 'Xem Tim mạch',
                          'payload': {'departmentId': 'department-1'},
                        },
                      ],
                    },
                  };
            handler.resolve(
              Response<dynamic>(
                requestOptions: options,
                statusCode: 200,
                data: data,
              ),
            );
          },
        ),
      );
      final repository = ChatbotRepository(dio);

      final settings = await repository.getSettings();
      final response = await repository.sendMessage(
        message: 'Tôi bị đau ngực',
        sessionId: 'previous-session',
        draft: const ChatBookingDraft(symptoms: ['đau ngực']),
        action: const ChatbotAction(type: 'ASK_MORE_INFO', label: 'Mô tả thêm'),
      );

      expect(settings.isAvailable, isTrue);
      expect(response.source, ChatbotSource.ai);
      expect(response.draft.departmentId, 'department-1');
      expect(response.results.single.items.single.name, 'Tim mạch');
      expect(response.suggestedActions.single.type, 'VIEW_DEPARTMENT');
      expect(requests.map((request) => request.path), [
        '/chatbot/settings',
        '/chatbot/message',
      ]);
      final body = Map<String, dynamic>.from(requests.last.data as Map);
      expect(body['sessionId'], 'previous-session');
      expect((body['draft'] as Map)['symptoms'], ['đau ngực']);
      expect((body['action'] as Map)['type'], 'ASK_MORE_INFO');
      dio.close(force: true);
    },
  );
}
