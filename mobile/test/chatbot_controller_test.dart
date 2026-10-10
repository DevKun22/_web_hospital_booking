import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/features/chatbot/application/chatbot_controller.dart';
import 'package:hospital_booking_mobile/features/chatbot/data/chatbot_repository.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_models.dart';

class _FakeChatbotRepository extends ChatbotRepository {
  _FakeChatbotRepository() : super(Dio());

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
    ChatBookingDraft? draft,
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
      overrides: [chatbotRepositoryProvider.overrideWithValue(repository)],
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
      overrides: [chatbotRepositoryProvider.overrideWithValue(repository)],
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
}
