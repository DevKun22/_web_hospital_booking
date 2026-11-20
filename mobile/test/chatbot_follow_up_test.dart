import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/chatbot/application/chatbot_controller.dart';
import 'package:hospital_booking_mobile/features/chatbot/data/chatbot_repository.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_models.dart';
import 'package:hospital_booking_mobile/features/chatbot/presentation/widgets/chatbot_follow_ups.dart';
import 'package:hospital_booking_mobile/features/chatbot/presentation/widgets/chatbot_messages.dart';

class _RecordingRepository extends ChatbotRepository {
  _RecordingRepository() : super(Dio());

  String? lastMessage;
  ChatbotAction? lastAction;
  ChatBookingDraft? lastDraft;

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
  }) async {
    lastMessage = message;
    lastAction = action;
    lastDraft = draft;
    return const ChatbotResponse(
      sessionId: 'session-1',
      source: ChatbotSource.ai,
      reply: 'Gói Tổng Quát gồm xét nghiệm máu và siêu âm.',
      intent: 'GENERAL_HOSPITAL_INFO',
      state: 'BOOKING_GUIDE',
      nextStep: 'END',
      confidence: 0.9,
      draft: ChatBookingDraft(
        focus: ChatFocus(type: 'package', id: 'p1', name: 'Gói Tổng Quát'),
      ),
      results: [],
      suggestedActions: [
        ChatbotAction(type: 'VIEW_PACKAGE', label: 'Chọn gói này'),
      ],
      sources: [ChatbotSourceRef(id: 's1', title: 'Gói Tổng Quát')],
    );
  }
}

void main() {
  test('đọc nguồn, chủ đề và câu hỏi của nút hỏi thêm từ phản hồi', () {
    final response = ChatbotResponse.fromJson({
      'sessionId': 's',
      'reply': 'ok',
      'draft': {
        'focus': {
          'type': 'doctor',
          'id': 'd1',
          'name': 'BS An',
          'departmentId': 'k1',
        },
      },
      'suggestedActions': [
        {
          'type': 'ASK_QUESTION',
          'label': 'Gói này gồm gì?',
          'payload': {'question': '  Gói Tổng Quát gồm những gì?  '},
        },
        {
          'type': 'ASK_QUESTION',
          'label': 'Rỗng',
          'payload': {'question': ' '},
        },
      ],
      'sources': [
        {'id': 'a', 'title': 'Hồ sơ BS An', 'url': '/bac-si/an'},
        {'id': 'b', 'title': ''},
      ],
    });
    expect(response.draft.focus?.id, 'd1');
    expect(response.draft.focus?.departmentId, 'k1');
    expect(
      response.suggestedActions[0].question,
      'Gói Tổng Quát gồm những gì?',
    );
    expect(response.suggestedActions[1].question, isNull);
    expect(response.sources.single.title, 'Hồ sơ BS An');
    // Chủ đề đi theo bản nháp gửi lại cho máy chủ; loại chủ đề lạ bị bỏ.
    expect(response.draft.toJson()['focus'], containsPair('id', 'd1'));
    expect(
      ChatFocus.tryParse({'type': 'hacker', 'id': 'x', 'name': 'y'}),
      isNull,
    );
  });

  test(
    'nút hỏi thêm gửi câu đầy đủ, hiện nhãn ngắn và gắn gợi ý vào tin trả lời',
    () async {
      final repository = _RecordingRepository();
      final container = ProviderContainer(
        overrides: [chatbotRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);
      final controller = container.read(chatbotControllerProvider.notifier);
      for (var i = 0; i < 100; i++) {
        if (container.read(chatbotControllerProvider).availability ==
            ChatbotAvailability.ready) {
          break;
        }
        await Future<void>.delayed(const Duration(milliseconds: 2));
      }

      final sent = await controller.sendAction(
        const ChatbotAction(
          type: 'ASK_QUESTION',
          label: 'Gói này gồm gì?',
          payload: {'question': 'Gói Tổng Quát gồm những hạng mục nào?'},
        ),
      );
      expect(sent, isTrue);
      expect(repository.lastMessage, 'Gói Tổng Quát gồm những hạng mục nào?');
      expect(repository.lastAction, isNull);

      final state = container.read(chatbotControllerProvider);
      expect(state.messages[1].role, ChatMessageRole.user);
      expect(state.messages[1].content, 'Gói này gồm gì?');
      expect(state.messages.last.actions.single.type, 'VIEW_PACKAGE');
      expect(state.messages.last.sources.single.title, 'Gói Tổng Quát');
      expect(state.draft?.focus?.name, 'Gói Tổng Quát');

      // Câu kế tiếp mang chủ đề đi cùng để máy chủ hiểu "gói này".
      await controller.sendMessage('gói này giá bao nhiêu');
      expect(repository.lastDraft?.focus?.id, 'p1');
    },
  );

  test('tin chào có gợi ý ban đầu đa dạng tình huống', () {
    final welcome = const ChatbotState().messages.single;
    expect(welcome.actions.length, 4);
    expect(welcome.actions.any((action) => action.question != null), isTrue);
  });

  testWidgets(
    'chỉ tin mới nhất hiện gợi ý; bấm gợi ý gọi onAction; nguồn hiện dạng thẻ',
    (tester) async {
      ChatbotAction? picked;
      const message = ChatMessage(
        id: 'assistant-1',
        role: ChatMessageRole.assistant,
        content: 'Câu trả lời',
        actions: [
          ChatbotAction(type: 'START_BOOKING', label: 'Đặt lịch ngay'),
          ChatbotAction(type: 'EMERGENCY_ADVICE', label: 'Bị lọc'),
        ],
        sources: [ChatbotSourceRef(id: 's', title: 'Hồ sơ BS An')],
      );

      Widget host({required bool latest}) => MaterialApp(
        home: Scaffold(
          body: ChatbotMessageBubble(
            message: message,
            disabled: false,
            isLatest: latest,
            onAction: (action) => picked = action,
          ),
        ),
      );

      await tester.pumpWidget(host(latest: false));
      expect(find.text('Đặt lịch ngay'), findsNothing);
      expect(find.text('Hồ sơ BS An'), findsOneWidget);

      await tester.pumpWidget(host(latest: true));
      expect(find.text('Bạn có thể hỏi tiếp'), findsOneWidget);
      expect(find.text('Bị lọc'), findsNothing);
      await tester.tap(find.text('Đặt lịch ngay'));
      expect(picked?.type, 'START_BOOKING');
    },
  );

  test('gợi ý trùng với thẻ kết quả đang hiện thì bị bỏ', () {
    final visible = visibleChatbotActions(
      const [
        ChatbotAction(type: 'VIEW_DOCTOR', label: 'Chọn bác sĩ'),
        ChatbotAction(type: 'CHANGE_DATE', label: 'Xem ngày khác'),
      ],
      const [
        ChatbotResultGroup(
          type: 'doctors',
          title: 'Bác sĩ',
          items: [],
          total: 0,
          limit: 4,
        ),
      ],
    );
    expect(visible.map((action) => action.type), ['CHANGE_DATE']);
  });
}
