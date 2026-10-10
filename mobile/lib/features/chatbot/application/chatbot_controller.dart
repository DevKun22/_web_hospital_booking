import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/chatbot/data/chatbot_repository.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_models.dart';

final chatbotRepositoryProvider = Provider<ChatbotRepository>(
  (ref) => ChatbotRepository(ref.watch(authDioProvider)),
);

final chatbotControllerProvider =
    NotifierProvider<ChatbotController, ChatbotState>(ChatbotController.new);

enum ChatbotAvailability { checking, ready, disabled, unavailable }

enum ChatMessageRole { user, assistant, alert }

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    this.source,
    this.results = const [],
  });

  final String id;
  final ChatMessageRole role;
  final String content;
  final ChatbotSource? source;
  final List<ChatbotResultGroup> results;
}

class ChatbotState {
  const ChatbotState({
    this.availability = ChatbotAvailability.checking,
    this.messages = const [
      ChatMessage(
        id: 'welcome',
        role: ChatMessageRole.assistant,
        source: ChatbotSource.system,
        content:
            'Xin chào, tôi có thể hỗ trợ tìm chuyên khoa, bác sĩ, lịch trống và hướng dẫn đặt lịch.',
      ),
    ],
    this.actions = const [],
    this.isSending = false,
    this.flowStatus,
    this.error,
    this.lastFailedRequest,
    this.sessionId,
    this.draft,
  });

  final ChatbotAvailability availability;
  final List<ChatMessage> messages;
  final List<ChatbotAction> actions;
  final bool isSending;
  final String? flowStatus;
  final ApiException? error;
  final ChatbotPendingRequest? lastFailedRequest;
  final String? sessionId;
  final ChatBookingDraft? draft;

  bool get canSend => availability == ChatbotAvailability.ready && !isSending;

  ChatbotState copyWith({
    ChatbotAvailability? availability,
    List<ChatMessage>? messages,
    List<ChatbotAction>? actions,
    bool? isSending,
    String? flowStatus,
    bool clearFlowStatus = false,
    ApiException? error,
    bool clearError = false,
    ChatbotPendingRequest? lastFailedRequest,
    bool clearLastFailedRequest = false,
    String? sessionId,
    bool clearSessionId = false,
    ChatBookingDraft? draft,
    bool clearDraft = false,
  }) => ChatbotState(
    availability: availability ?? this.availability,
    messages: messages ?? this.messages,
    actions: actions ?? this.actions,
    isSending: isSending ?? this.isSending,
    flowStatus: clearFlowStatus ? null : (flowStatus ?? this.flowStatus),
    error: clearError ? null : (error ?? this.error),
    lastFailedRequest: clearLastFailedRequest
        ? null
        : (lastFailedRequest ?? this.lastFailedRequest),
    sessionId: clearSessionId ? null : (sessionId ?? this.sessionId),
    draft: clearDraft ? null : (draft ?? this.draft),
  );
}

class ChatbotPendingRequest {
  const ChatbotPendingRequest({required this.message, this.action});

  final String message;
  final ChatbotAction? action;
}

class ChatbotController extends Notifier<ChatbotState> {
  int _requestVersion = 0;
  int _messageSequence = 0;

  @override
  ChatbotState build() {
    Future<void>.microtask(loadSettings);
    return const ChatbotState();
  }

  Future<void> loadSettings() async {
    state = state.copyWith(
      availability: ChatbotAvailability.checking,
      clearError: true,
    );
    try {
      final settings = await ref.read(chatbotRepositoryProvider).getSettings();
      state = state.copyWith(
        availability: settings.isAvailable
            ? ChatbotAvailability.ready
            : ChatbotAvailability.disabled,
        clearError: true,
      );
    } on ApiException catch (error) {
      state = state.copyWith(
        availability: ChatbotAvailability.unavailable,
        error: error,
      );
    }
  }

  Future<bool> sendMessage(String value) {
    final message = value.trim();
    if (message.isEmpty || message.length > 1000) return Future.value(false);
    return _send(ChatbotPendingRequest(message: message), appendMessage: true);
  }

  Future<bool> sendAction(ChatbotAction action) => _send(
    ChatbotPendingRequest(message: action.label, action: action),
    appendMessage: true,
  );

  Future<bool> retryLast() {
    final request = state.lastFailedRequest;
    if (request == null) return Future.value(false);
    return _send(request, appendMessage: false);
  }

  Future<bool> _send(
    ChatbotPendingRequest request, {
    required bool appendMessage,
  }) async {
    if (!state.canSend) return false;
    final requestVersion = ++_requestVersion;
    final nextMessages = appendMessage
        ? [
            ...state.messages,
            ChatMessage(
              id: _nextMessageId('user'),
              role: ChatMessageRole.user,
              content: request.message,
            ),
          ]
        : state.messages;
    state = state.copyWith(
      messages: nextMessages,
      actions: const [],
      isSending: true,
      clearError: true,
      clearLastFailedRequest: true,
    );

    try {
      final response = await ref
          .read(chatbotRepositoryProvider)
          .sendMessage(
            message: request.message,
            sessionId: state.sessionId,
            draft: state.draft,
            action: request.action,
          );
      if (requestVersion != _requestVersion) return false;
      final flowStatus = _flowStatus(response.state, response.nextStep);
      state = state.copyWith(
        messages: [
          ...state.messages,
          ChatMessage(
            id: _nextMessageId('assistant'),
            role: response.state == 'EMERGENCY_CARE'
                ? ChatMessageRole.alert
                : ChatMessageRole.assistant,
            content: response.reply,
            source: response.source,
            results: response.results,
          ),
        ],
        actions: response.suggestedActions,
        isSending: false,
        flowStatus: flowStatus,
        clearFlowStatus: flowStatus == null,
        sessionId: response.sessionId,
        draft: response.draft,
        clearError: true,
        clearLastFailedRequest: true,
      );
      return true;
    } on ApiException catch (error) {
      if (requestVersion != _requestVersion) return false;
      state = state.copyWith(
        isSending: false,
        error: error,
        lastFailedRequest: request,
      );
      return false;
    }
  }

  void resetConversation() {
    _requestVersion += 1;
    state = ChatbotState(availability: state.availability);
  }

  void dismissError() => state = state.copyWith(clearError: true);

  String _nextMessageId(String prefix) =>
      '$prefix-${DateTime.now().microsecondsSinceEpoch}-${_messageSequence++}';
}

String? _flowStatus(String state, String nextStep) {
  final key = state.isNotEmpty ? state : nextStep;
  return switch (key) {
    'SUGGESTING_DEPARTMENT' => 'Đang chọn chuyên khoa',
    'SUGGESTING_PACKAGE' => 'Đang chọn gói khám',
    'CHOOSING_DOCTOR' => 'Đang chọn bác sĩ',
    'CHOOSING_DATE' => 'Đang chọn ngày khám',
    'CHOOSING_SLOT' => 'Đang chọn lịch trống',
    'READY_TO_BOOK' => 'Sẵn sàng đặt lịch',
    'BOOKING_GUIDE' => 'Hướng dẫn đặt lịch',
    'EMERGENCY_CARE' => 'Cần hỗ trợ khẩn cấp',
    _ => null,
  };
}
