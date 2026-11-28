import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/features/chatbot/application/chatbot_controller.dart';
import 'package:hospital_booking_mobile/features/chatbot/data/chatbot_repository.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_models.dart';
import 'package:hospital_booking_mobile/features/chatbot/presentation/chatbot_screen.dart';
import 'package:hospital_booking_mobile/features/chatbot/presentation/widgets/chatbot_follow_ups.dart';
import 'package:hospital_booking_mobile/features/chatbot/presentation/widgets/chatbot_messages.dart';

import 'helpers/fake_auth_controller.dart';

const _appointmentResponse = {
  'sessionId': 'session-1',
  'source': 'SYSTEM',
  'reply': 'Mình tìm thấy 1 lịch hẹn trong tài khoản của bạn.',
  'intent': 'APPOINTMENT_LOOKUP',
  'state': 'SHOWING_APPOINTMENTS',
  'nextStep': 'END',
  'confidence': 1,
  'draft': <String, dynamic>{},
  'results': [
    {
      'type': 'appointments',
      'title': 'Lịch sắp tới của bạn',
      'total': 1,
      'limit': 3,
      'items': [
        {
          'type': 'appointment',
          'id': 'APPT-1',
          'bookingCode': 'BK20261129000001',
          'date': '2030-01-02',
          'startTime': '09:00',
          'endTime': '09:30',
          'doctorName': 'BS. Trần Minh',
          'status': 'CONFIRMED',
          'canCancel': true,
        },
      ],
    },
  ],
  'suggestedActions': <Map<String, dynamic>>[],
  'pendingAction': {
    'type': 'CANCEL_APPOINTMENT',
    'expiresAt': '2030-01-01T08:35:00.000Z',
  },
  'messageId': 'msg-1',
};

class _Repository extends ChatbotRepository {
  _Repository({this.error}) : super(Dio(), Dio());

  final ApiException? error;

  @override
  Future<ChatbotSettings> getSettings() async => const ChatbotSettings(
    isActive: true,
    aiEnabled: true,
    faqEnabled: true,
    fallbackEnabled: true,
  );

  @override
  Future<ChatbotResponse> sendMessage({
    required String message,
    String? sessionId,
    ChatbotAction? action,
  }) async {
    final failure = error;
    if (failure != null) throw failure;
    return ChatbotResponse.fromJson(_appointmentResponse);
  }
}

GoRouter _router() => GoRouter(
  initialLocation: '/chatbot',
  routes: [
    GoRoute(path: '/chatbot', builder: (_, _) => const ChatbotScreen()),
    GoRoute(
      path: '/appointments/:id',
      builder: (_, state) => Text('Chi tiết ${state.pathParameters['id']}'),
    ),
  ],
);

Future<void> _pump(
  WidgetTester tester,
  GoRouter router,
  ChatbotRepository repository,
) async {
  tester.view.physicalSize = const Size(900, 1800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        fakeAuthOverride,
        chatbotRepositoryProvider.overrideWithValue(repository),
      ],
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'thẻ lịch hẹn có nút mở thẳng chi tiết lịch, không gửi về máy chủ',
    (tester) async {
      final router = _router();
      await _pump(tester, router, _Repository());
      final container = ProviderScope.containerOf(
        tester.element(find.byType(ChatbotScreen)),
      );

      await container
          .read(chatbotControllerProvider.notifier)
          .sendMessage('lịch hẹn của tôi');
      await tester.pumpAndSettle();
      expect(find.text('Xem chi tiết lịch'), findsOneWidget);

      await tester.ensureVisible(find.text('Xem chi tiết lịch'));
      await tester.tap(find.text('Xem chi tiết lịch'));
      await tester.pumpAndSettle();

      // `push` chồng màn chi tiết lên trên màn Kun (không rời màn Kun), nên kiểm bằng nội dung màn đích.
      expect(find.text('Chi tiết APPT-1'), findsOneWidget);
    },
  );

  test('phản hồi mang hạn xác nhận và mã tin để dùng ở giao diện', () {
    final response = ChatbotResponse.fromJson(_appointmentResponse);
    expect(response.messageId, 'msg-1');
    expect(
      response.pendingExpiresAt,
      DateTime.utc(2030, 1, 1, 8, 35).toLocal(),
    );
    expect(
      ChatbotResponse.fromJson({
        ..._appointmentResponse,
        'pendingAction': null,
      }).pendingExpiresAt,
      isNull,
    );
  });

  testWidgets('tin đang chờ xác nhận hủy hiện hạn xác nhận', (tester) async {
    final router = _router();
    await _pump(tester, router, _Repository());
    final container = ProviderScope.containerOf(
      tester.element(find.byType(ChatbotScreen)),
    );
    await container
        .read(chatbotControllerProvider.notifier)
        .sendMessage('hủy lịch');
    await tester.pumpAndSettle();

    final deadline = DateTime.utc(2030, 1, 1, 8, 35).toLocal();
    String two(int value) => value.toString().padLeft(2, '0');
    expect(
      find.textContaining(
        'Xác nhận trước ${two(deadline.hour)}:${two(deadline.minute)}',
      ),
      findsOneWidget,
    );
  });

  testWidgets(
    'nguồn có đường dẫn thì bấm mở được; nguồn không có đường dẫn thì không',
    (tester) async {
      final opened = <String>[];
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ChatbotSourceChips(
              sources: const [
                ChatbotSourceRef(
                  id: 'a',
                  title: 'Chính sách đặt lịch',
                  url: '/huong-dan/dat-lich',
                ),
                ChatbotSourceRef(id: 'b', title: 'Nguồn không có trang'),
              ],
              onOpen: (source) async {
                opened.add(source.url!);
                return true;
              },
            ),
          ),
        ),
      );

      await tester.tap(find.text('Chính sách đặt lịch'));
      await tester.tap(find.text('Nguồn không có trang'));
      await tester.pump();
      expect(opened, ['/huong-dan/dat-lich']);
      expect(find.byIcon(Icons.open_in_new_outlined), findsOneWidget);
    },
  );

  testWidgets('không mở được nguồn thì báo, không lặng lẽ bỏ qua', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ChatbotSourceChips(
            sources: const [
              ChatbotSourceRef(id: 'a', title: 'Bài viết', url: '/bai-viet/x'),
            ],
            onOpen: (_) async => false,
          ),
        ),
      ),
    );
    await tester.tap(find.text('Bài viết'));
    await tester.pump();
    expect(find.textContaining('Chưa mở được trang nguồn'), findsOneWidget);
  });

  test('gửi quá nhanh (429): nói rõ chờ bao lâu', () async {
    final container = ProviderContainer(
      overrides: [
        fakeAuthOverride,
        chatbotRepositoryProvider.overrideWithValue(
          _Repository(
            error: const ApiException(
              kind: ApiErrorKind.rateLimited,
              statusCode: 429,
              message: 'Bạn thao tác quá nhanh.',
              retryAfterSeconds: 12,
            ),
          ),
        ),
      ],
    );
    addTearDown(container.dispose);
    container.listen(chatbotControllerProvider, (_, _) {});
    final controller = container.read(chatbotControllerProvider.notifier);
    while (container.read(chatbotControllerProvider).availability !=
        ChatbotAvailability.ready) {
      await Future<void>.delayed(const Duration(milliseconds: 2));
    }

    expect(await controller.sendMessage('xin chào'), isFalse);
    final error = container.read(chatbotControllerProvider).error!;
    expect(error.message, contains('12 giây'));
    expect(error.retryAfterSeconds, 12);
    expect(error.kind, ApiErrorKind.rateLimited);
  });

  test('ô soạn và controller cùng giới hạn 2000 ký tự như máy chủ', () {
    expect(chatbotMaxMessageLength, 2000);
  });

  testWidgets(
    'chờ lâu hơn bình thường thì Kun nói thật là cần thêm thời gian',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChatbotTypingIndicator(slowAfter: Duration(seconds: 2)),
          ),
        ),
      );
      expect(find.text('Kun đang trả lời…'), findsOneWidget);
      await tester.pump(const Duration(seconds: 3));
      expect(find.textContaining('cần thêm chút thời gian'), findsOneWidget);
    },
  );

  testWidgets(
    'chữ lớn 2.0 và màn hẹp: tin có thẻ, hạn xác nhận và nguồn không tràn',
    (tester) async {
      tester.view.physicalSize = const Size(360, 780);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final response = ChatbotResponse.fromJson(_appointmentResponse);
      await tester.pumpWidget(
        MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: const TextScaler.linear(2)),
            child: child!,
          ),
          home: Scaffold(
            body: SingleChildScrollView(
              child: ChatbotMessageBubble(
                isLatest: true,
                disabled: false,
                onAction: (_) {},
                message: ChatMessage(
                  id: 'assistant-1',
                  role: ChatMessageRole.assistant,
                  content: response.reply,
                  results: response.results,
                  actions: const [
                    ChatbotAction(
                      type: 'CONFIRM_CANCEL_APPOINTMENT',
                      label: 'Xác nhận hủy lịch',
                    ),
                  ],
                  sources: const [
                    ChatbotSourceRef(
                      id: 's',
                      title:
                          'Chính sách đặt lịch, hủy lịch và nhắc lịch của cơ sở khám',
                      url: '/huong-dan/dat-lich',
                    ),
                  ],
                  pendingExpiresAt: response.pendingExpiresAt,
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Xem chi tiết lịch'), findsOneWidget);
    },
  );
}
