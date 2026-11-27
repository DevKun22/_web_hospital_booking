import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/chatbot/application/chatbot_controller.dart';
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
      final repository = ChatbotRepository(dio, dio);

      final settings = await repository.getSettings();
      final response = await repository.sendMessage(
        message: 'Tôi bị đau ngực',
        sessionId: 'previous-session',
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
      // Máy chủ giữ trạng thái hội thoại: client không gửi bản nháp.
      expect(body.containsKey('draft'), isFalse);
      expect((body['action'] as Map)['type'], 'ASK_MORE_INFO');
      dio.close(force: true);
    },
  );

  Map<String, dynamic> okReply(String sessionId) => {
    'success': true,
    'data': {
      'sessionId': sessionId,
      'source': 'SYSTEM',
      'reply': 'Xin chao',
      'intent': 'GENERAL_HOSPITAL_INFO',
      'state': 'BOOKING_GUIDE',
      'nextStep': 'END',
      'confidence': 1,
      'draft': {},
      'suggestedActions': [],
    },
  };

  Dio fakeDio(List<String> calls, String name, {int status = 200}) {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          calls.add(name);
          if (status == 200) {
            handler.resolve(
              Response<dynamic>(
                requestOptions: options,
                statusCode: 200,
                data: okReply(name),
              ),
            );
          } else {
            handler.reject(
              DioException(
                requestOptions: options,
                type: DioExceptionType.badResponse,
                response: Response<dynamic>(
                  requestOptions: options,
                  statusCode: status,
                  data: {
                    'success': false,
                    'message': 'Phiên đăng nhập đã hết hạn',
                  },
                ),
              ),
            );
          }
        },
      ),
    );
    return dio;
  }

  test(
    'tin nhắn đi qua Dio có token người khám, không qua Dio công khai',
    () async {
      // Lỗi tìm thấy khi thử trên máy thật: trước đây Kun dùng authDioProvider (Dio không gắn token) nên luôn coi là khách.
      final calls = <String>[];
      final container = ProviderContainer(
        overrides: [
          authenticatedDioProvider.overrideWithValue(
            fakeDio(calls, 'authenticated'),
          ),
          authDioProvider.overrideWithValue(fakeDio(calls, 'public')),
        ],
      );
      addTearDown(container.dispose);
      final response = await container
          .read(chatbotRepositoryProvider)
          .sendMessage(message: 'xem lich hen cua toi');
      expect(calls, ['authenticated']);
      expect(response.sessionId, 'authenticated');
    },
  );

  test('phiên đăng nhập hỏng hẳn (401): hỏi lại một lần như khách', () async {
    final calls = <String>[];
    final repository = ChatbotRepository(
      fakeDio(calls, 'authenticated', status: 401),
      fakeDio(calls, 'public'),
    );
    final response = await repository.sendMessage(message: 'xin chao');
    expect(calls, ['authenticated', 'public']);
    expect(response.sessionId, 'public');
  });

  test('lỗi khác 401 (vd. 409 xung đột) không hỏi lại như khách', () async {
    final calls = <String>[];
    final repository = ChatbotRepository(
      fakeDio(calls, 'authenticated', status: 409),
      fakeDio(calls, 'public'),
    );
    await expectLater(
      repository.sendMessage(message: 'xin chao'),
      throwsA(anything),
    );
    expect(calls, ['authenticated']);
  });

  test(
    '401 mà app vẫn còn token (làm mới lỗi tạm thời): báo lỗi, không hạ xuống khách',
    () async {
      final calls = <String>[];
      final repository = ChatbotRepository(
        fakeDio(calls, 'authenticated', status: 401),
        fakeDio(calls, 'public'),
        hasAccessToken: () => true,
      );
      await expectLater(
        repository.sendMessage(message: 'xin chao'),
        throwsA(anything),
      );
      expect(calls, ['authenticated']);
    },
  );
}
