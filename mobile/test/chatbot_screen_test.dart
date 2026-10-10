import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/chatbot/application/chatbot_controller.dart';
import 'package:hospital_booking_mobile/features/chatbot/data/chatbot_repository.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_models.dart';
import 'package:hospital_booking_mobile/features/chatbot/presentation/chatbot_screen.dart';

class _ScreenChatbotRepository extends ChatbotRepository {
  _ScreenChatbotRepository() : super(Dio());

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
  }) async => const ChatbotResponse(
    sessionId: 'session-1',
    source: ChatbotSource.system,
    reply: 'Tôi đã tìm thấy chuyên khoa phù hợp.',
    intent: 'DEPARTMENT_LIST',
    state: 'SUGGESTING_DEPARTMENT',
    nextStep: 'CHOOSE_DEPARTMENT',
    confidence: 1,
    draft: ChatBookingDraft(departmentId: 'department-1'),
    results: [
      ChatbotResultGroup(
        type: 'departments',
        title: 'Chuyên khoa phù hợp',
        items: [
          ChatbotResultItem(
            type: ChatbotResultType.department,
            id: 'department-1',
            name: 'Tim mạch',
          ),
        ],
        total: 1,
        limit: 3,
      ),
    ],
    suggestedActions: [],
  );
}

void main() {
  testWidgets('sends a message and renders grounded chatbot results', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(900, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          chatbotRepositoryProvider.overrideWithValue(
            _ScreenChatbotRepository(),
          ),
        ],
        child: const MaterialApp(home: ChatbotScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Đang sẵn sàng hỗ trợ'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'Tìm chuyên khoa tim mạch');
    await tester.tap(find.byTooltip('Gửi tin nhắn'));
    await tester.pumpAndSettle();

    expect(find.text('Tìm chuyên khoa tim mạch'), findsOneWidget);
    expect(find.text('Tôi đã tìm thấy chuyên khoa phù hợp.'), findsOneWidget);
    expect(find.text('Tim mạch'), findsOneWidget);
    expect(find.text('Chọn chuyên khoa'), findsOneWidget);
    expect(
      find.text('Không nhập OTP, mật khẩu hoặc thông tin quá nhạy cảm.'),
      findsOneWidget,
    );
  });
}
