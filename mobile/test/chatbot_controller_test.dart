import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'helpers/fake_auth_controller.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/chatbot/application/chatbot_controller.dart';
import 'package:hospital_booking_mobile/features/chatbot/data/chatbot_repository.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_models.dart';

class _FakeChatbotRepository extends ChatbotRepository {
  _FakeChatbotRepository() : super(Dio(), Dio());

  int sendCalls = 0;
  Completer<ChatbotResponse>? sendGate;
  ApiException? nextError;

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
  }) {
    sendCalls += 1;
    final error = nextError;
    nextError = null;
    if (error != null) return Future.error(error);
    return (sendGate ??= Completer<ChatbotResponse>()).future;
  }
}

const _response = ChatbotResponse(
  sessionId: 'session-1',
  source: ChatbotSource.faq,
  reply: 'Bạn có thể xem danh sách chuyên khoa.',
  intent: 'DEPARTMENT_LIST',
  state: 'SUGGESTING_DEPARTMENT',
  nextStep: 'CHOOSE_DEPARTMENT',
  confidence: 1,
  draft: ChatBookingDraft(),
  results: [],
  suggestedActions: [
    ChatbotAction(type: 'VIEW_DEPARTMENTS', label: 'Xem chuyên khoa'),
  ],
);

Future<void> _waitUntil(bool Function() condition) async {
  for (var attempt = 0; attempt < 100; attempt++) {
    if (condition()) return;
    await Future<void>.delayed(const Duration(milliseconds: 2));
  }
  fail('Timed out waiting for chatbot state');
}

void main() {
  test('prevents duplicate sends and appends one assistant response', () async {
    final repository = _FakeChatbotRepository();
    final container = ProviderContainer(
      overrides: [
        chatbotRepositoryProvider.overrideWithValue(repository),
        fakeAuthOverride,
      ],
    );
    addTearDown(container.dispose);
    final controller = container.read(chatbotControllerProvider.notifier);
    await _waitUntil(
      () =>
          container.read(chatbotControllerProvider).availability ==
          ChatbotAvailability.ready,
    );

    final first = controller.sendMessage('Tôi cần tìm chuyên khoa');
    final duplicate = await controller.sendMessage('Gửi trùng');

    expect(duplicate, isFalse);
    expect(repository.sendCalls, 1);
    expect(container.read(chatbotControllerProvider).messages.length, 2);

    repository.sendGate!.complete(_response);
    expect(await first, isTrue);
    final state = container.read(chatbotControllerProvider);
    expect(state.messages.length, 3);
    expect(state.messages.last.content, contains('danh sách chuyên khoa'));
    expect(state.actions.single.type, 'VIEW_DEPARTMENTS');
    expect(state.flowStatus, 'Đang chọn chuyên khoa');
  });

  test('keeps the failed message and retries without duplicating it', () async {
    final repository = _FakeChatbotRepository()
      ..nextError = const ApiException(
        kind: ApiErrorKind.network,
        message: 'Không thể kết nối máy chủ.',
      );
    final container = ProviderContainer(
      overrides: [
        chatbotRepositoryProvider.overrideWithValue(repository),
        fakeAuthOverride,
      ],
    );
    addTearDown(container.dispose);
    final controller = container.read(chatbotControllerProvider.notifier);
    await _waitUntil(
      () =>
          container.read(chatbotControllerProvider).availability ==
          ChatbotAvailability.ready,
    );

    expect(await controller.sendMessage('Tìm bác sĩ'), isFalse);
    var state = container.read(chatbotControllerProvider);
    expect(state.messages.length, 2);
    expect(state.lastFailedRequest?.message, 'Tìm bác sĩ');

    final retry = controller.retryLast();
    repository.sendGate!.complete(_response);
    expect(await retry, isTrue);
    state = container.read(chatbotControllerProvider);
    expect(state.messages.length, 3);
    expect(
      state.messages.where((message) => message.content == 'Tìm bác sĩ'),
      hasLength(1),
    );
  });

  test(
    'đăng xuất hoặc đổi tài khoản thì xóa cuộc trò chuyện; khách đăng nhập thì giữ',
    () async {
      final repository = _FakeChatbotRepository();
      final container = ProviderContainer(
        overrides: [
          chatbotRepositoryProvider.overrideWithValue(repository),
          fakeAuthOverride,
        ],
      );
      addTearDown(container.dispose);
      final controller = container.read(chatbotControllerProvider.notifier);
      final auth =
          container.read(authControllerProvider.notifier) as FakeAuthController;
      await _waitUntil(
        () =>
            container.read(chatbotControllerProvider).availability ==
            ChatbotAvailability.ready,
      );

      final sent = controller.sendMessage('xem lich hen cua toi');
      repository.sendGate!.complete(_response);
      await sent;
      expect(container.read(chatbotControllerProvider).messages.length, 3);

      // Khách vừa đăng nhập: cuộc trò chuyện là của chính họ, giữ nguyên.
      auth.signInAs('user-a');
      await Future<void>.delayed(Duration.zero);
      expect(container.read(chatbotControllerProvider).messages.length, 3);
      expect(container.read(chatbotControllerProvider).sessionId, 'session-1');

      // Đổi sang tài khoản khác: không được thấy thẻ lịch của người trước.
      auth.signInAs('user-b');
      await Future<void>.delayed(Duration.zero);
      final switched = container.read(chatbotControllerProvider);
      expect(switched.messages.length, 1);
      expect(switched.sessionId, isNull);
      expect(switched.availability, ChatbotAvailability.ready);

      // Đăng xuất cũng xóa.
      repository.sendGate = null;
      final again = controller.sendMessage('xin chao');
      repository.sendGate!.complete(_response);
      await again;
      auth.signOut();
      await Future<void>.delayed(Duration.zero);
      expect(container.read(chatbotControllerProvider).messages.length, 1);
    },
  );
}
