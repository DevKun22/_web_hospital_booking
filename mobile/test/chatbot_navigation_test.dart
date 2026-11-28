import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/features/chatbot/application/chatbot_controller.dart';
import 'package:hospital_booking_mobile/features/chatbot/data/chatbot_repository.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_models.dart';
import 'package:hospital_booking_mobile/features/chatbot/presentation/chatbot_screen.dart';

import 'helpers/fake_auth_controller.dart';

class _CountingRepository extends ChatbotRepository {
  _CountingRepository() : super(Dio(), Dio());

  int sendCalls = 0;

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
    sendCalls += 1;
    throw UnimplementedError('nút chuyển trang không được gửi về máy chủ');
  }
}

/// Giống app thật: /home và /appointments là hai tab của StatefulShellRoute, /chatbot và /support đẩy chồng lên trên.
GoRouter _router() => GoRouter(
  initialLocation: '/home',
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (_, _, shell) => Scaffold(body: shell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/home',
              builder: (context, _) => TextButton(
                onPressed: () => context.push('/chatbot'),
                child: const Text('Mở Kun'),
              ),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/appointments',
              builder: (_, _) => const Text('Nội dung tab lịch hẹn'),
            ),
          ],
        ),
      ],
    ),
    GoRoute(path: '/chatbot', builder: (_, _) => const ChatbotScreen()),
    GoRoute(
      path: '/support',
      builder: (_, _) => const Text('Trung tâm hỗ trợ'),
    ),
  ],
);

Future<_CountingRepository> _openChatbot(
  WidgetTester tester,
  GoRouter router,
) async {
  tester.view.physicalSize = const Size(900, 1800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final repository = _CountingRepository();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        fakeAuthOverride,
        chatbotRepositoryProvider.overrideWithValue(repository),
      ],
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  await tester.tap(find.text('Mở Kun'));
  await tester.pumpAndSettle();
  return repository;
}

void main() {
  testWidgets(
    '"Tra cứu lịch hẹn" chuyển sang tab lịch hẹn (không màn trắng), không gửi về máy chủ',
    (tester) async {
      // Lỗi thấy trên máy thật: push nhánh /appointments chồng lên màn trợ lý dựng vỏ tab thứ hai, thân trắng.
      final router = _router();
      final repository = await _openChatbot(tester, router);

      await tester.tap(find.text('Tra cứu lịch hẹn'));
      await tester.pumpAndSettle();

      expect(
        router.routerDelegate.currentConfiguration.uri.path,
        '/appointments',
      );
      expect(find.text('Nội dung tab lịch hẹn'), findsOneWidget);
      expect(repository.sendCalls, 0);
    },
  );
}
