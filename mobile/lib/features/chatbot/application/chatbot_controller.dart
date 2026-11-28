import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/app/sync/patient_data_sync_coordinator.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/chatbot/data/chatbot_repository.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_models.dart';

// Dio có token (người khám đã đăng nhập) cho tin nhắn; Dio công khai cho cài đặt và hỏi lại như khách.
// Lưu ý: authDioProvider là Dio cơ sở của các API đăng nhập, KHÔNG gắn token.
final chatbotRepositoryProvider = Provider<ChatbotRepository>(
  (ref) => ChatbotRepository(
    ref.watch(authenticatedDioProvider),
    ref.watch(authDioProvider),
    hasAccessToken: () =>
        ref.read(accessTokenStoreProvider).accessToken?.isNotEmpty ?? false,
  ),
);

/// Độ dài tối đa một tin gửi cho Kun; bằng giới hạn của máy chủ (`chatbotMessageSchema`).
const chatbotMaxMessageLength = 2000;

final chatbotControllerProvider =
    NotifierProvider<ChatbotController, ChatbotState>(ChatbotController.new);

enum ChatbotAvailability { checking, ready, disabled, unavailable }

enum ChatMessageRole { user, assistant, alert }

/// Đánh giá của người dùng cho một câu trả lời của Kun.
enum ChatbotFeedback { helpful, notHelpful }

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    this.source,
    this.results = const [],
    this.actions = const [],
    this.sources = const [],
    this.messageId,
    this.pendingExpiresAt,
    this.facts = const [],
    this.feedback,
  });

  final String id;
  final ChatMessageRole role;
  final String content;
  final ChatbotSource? source;
  final List<ChatbotResultGroup> results;

  /// Gợi ý bước tiếp theo đi kèm câu trả lời này; chỉ tin mới nhất hiện cho bấm.
  final List<ChatbotAction> actions;
  final List<ChatbotSourceRef> sources;
  final String? messageId;

  /// Hạn xác nhận hủy lịch đang chờ; chỉ có ở tin mà Kun vừa hỏi xác nhận.
  final DateTime? pendingExpiresAt;

  /// Thẻ thông tin có cấu trúc (giá, hạng mục, phí khám) kèm câu trả lời.
  final List<ChatbotFactCard> facts;

  /// Người dùng đã đánh giá câu trả lời này chưa (null = chưa).
  final ChatbotFeedback? feedback;

  ChatMessage withFeedback(ChatbotFeedback? value) => ChatMessage(
    id: id,
    role: role,
    content: content,
    source: source,
    results: results,
    actions: actions,
    sources: sources,
    messageId: messageId,
    pendingExpiresAt: pendingExpiresAt,
    facts: facts,
    feedback: value,
  );
}

/// Gợi ý ban đầu: các tình huống người khám hay gặp, mỗi nút dẫn tới một hướng khác nhau.
const _starterActions = [
  ChatbotAction(type: 'VIEW_DEPARTMENTS', label: 'Tìm khoa theo triệu chứng'),
  ChatbotAction(type: 'VIEW_PACKAGES', label: 'Khám sức khỏe định kỳ'),
  ChatbotAction(
    type: 'ASK_QUESTION',
    label: 'Khám cho trẻ em',
    payload: {'question': 'Khám cho trẻ em thì nên chọn chuyên khoa nào?'},
  ),
  ChatbotAction(type: 'LOOKUP_APPOINTMENT', label: 'Tra cứu lịch hẹn'),
];

class ChatbotState {
  const ChatbotState({
    this.availability = ChatbotAvailability.checking,
    this.messages = const [
      ChatMessage(
        id: 'welcome',
        role: ChatMessageRole.assistant,
        source: ChatbotSource.system,
        content:
            'Chào bạn, mình là Kun, trợ lý ảo của DevKunCare. Mình giúp bạn tìm chuyên khoa, bác sĩ, gói khám, xem lịch trống và đặt lịch. Bạn muốn bắt đầu từ đâu?',
        actions: _starterActions,
      ),
    ],
    this.actions = const [],
    this.isSending = false,
    this.flowStatus,
    this.error,
    this.lastFailedRequest,
    this.sessionId,
    this.draft,
    this.summary,
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

  /// Các lựa chọn đang giữ trong bản nháp đặt lịch, bằng tên người đọc được.
  final ChatbotDraftSummary? summary;

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
    ChatbotDraftSummary? summary,
    bool clearSummary = false,
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
    summary: clearSummary ? null : (summary ?? this.summary),
  );
}

class ChatbotPendingRequest {
  const ChatbotPendingRequest({
    required this.message,
    this.action,
    this.echoText,
  });

  final String message;
  final ChatbotAction? action;

  /// Chữ hiện trong khung chat của người dùng khi khác nội dung gửi đi.
  final String? echoText;
}

class ChatbotController extends Notifier<ChatbotState> {
  int _requestVersion = 0;
  int _messageSequence = 0;

  @override
  ChatbotState build() {
    // Đăng xuất hoặc đổi sang tài khoản khác: xóa cuộc trò chuyện trên máy (có thể có thẻ lịch hẹn của người trước).
    // Khách vừa đăng nhập thì giữ: đó là cuộc trò chuyện của chính họ, máy chủ tự gắn phiên vào tài khoản.
    ref.listen<String?>(
      authControllerProvider.select((auth) => auth.user?.id),
      (previous, next) {
        if (previous != null && previous != next) resetConversation();
      },
    );
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
    if (message.isEmpty || message.length > chatbotMaxMessageLength) {
      return Future.value(false);
    }
    return _send(ChatbotPendingRequest(message: message), appendMessage: true);
  }

  /// Nút hỏi thêm gửi câu hỏi đầy đủ như người dùng gõ (khung chat hiện nhãn ngắn); nút khác gửi kèm thao tác để máy chủ dựng bước kế tiếp.
  Future<bool> sendAction(ChatbotAction action) {
    final question = action.question;
    if (question != null) {
      return _send(
        ChatbotPendingRequest(message: question, echoText: action.label),
        appendMessage: true,
      );
    }
    return _send(
      ChatbotPendingRequest(message: action.label, action: action),
      appendMessage: true,
    );
  }

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
              content: request.echoText ?? request.message,
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
            actions: response.suggestedActions,
            sources: response.sources,
            messageId: response.messageId,
            pendingExpiresAt: response.pendingExpiresAt,
            facts: response.facts,
          ),
        ],
        actions: response.suggestedActions,
        isSending: false,
        flowStatus: flowStatus,
        clearFlowStatus: flowStatus == null,
        sessionId: response.sessionId,
        draft: response.draft,
        summary: response.summary,
        clearSummary: response.summary == null,
        clearError: true,
        clearLastFailedRequest: true,
      );
      // Kun vừa xử lý yêu cầu hủy lịch (có thể đã hủy thật): làm mới danh sách lịch để Trang chủ và tab Lịch hẹn
      // không còn hiện lịch cũ. Làm mới thừa khi người dùng giữ lại lịch là vô hại.
      if (response.intent == 'APPOINTMENT_CANCEL') {
        unawaited(
          ref
              .read(patientDataSyncCoordinatorProvider)
              .handleAppointmentChanged(),
        );
      }
      return true;
    } on ApiException catch (error) {
      if (requestVersion != _requestVersion) return false;
      state = state.copyWith(
        isSending: false,
        error: _friendlyError(error),
        lastFailedRequest: request,
      );
      return false;
    }
  }

  /// Gửi đánh giá cho một câu trả lời. Hiện kết quả ngay, gửi lỗi thì trả lại trạng thái chưa đánh giá để người dùng bấm lại.
  Future<bool> rateMessage(String messageId, ChatbotFeedback value) async {
    final sessionId = state.sessionId;
    final current = state.messages.where((m) => m.messageId == messageId);
    if (sessionId == null ||
        current.isEmpty ||
        current.first.feedback != null) {
      return false;
    }
    final requestVersion = _requestVersion;
    _setFeedback(messageId, value);
    try {
      await ref
          .read(chatbotRepositoryProvider)
          .sendFeedback(
            sessionId: sessionId,
            messageId: messageId,
            helpful: value == ChatbotFeedback.helpful,
          );
      return true;
    } on ApiException {
      if (requestVersion == _requestVersion) _setFeedback(messageId, null);
      return false;
    }
  }

  void _setFeedback(String messageId, ChatbotFeedback? value) {
    state = state.copyWith(
      messages: [
        for (final message in state.messages)
          message.messageId == messageId
              ? message.withFeedback(value)
              : message,
      ],
    );
  }

  void resetConversation() {
    _requestVersion += 1;
    state = ChatbotState(availability: state.availability);
  }

  void dismissError() => state = state.copyWith(clearError: true);

  String _nextMessageId(String prefix) =>
      '$prefix-${DateTime.now().microsecondsSinceEpoch}-${_messageSequence++}';
}

/// Gửi quá nhanh (429): nói rõ chờ bao lâu thay cho câu chung của máy chủ.
ApiException _friendlyError(ApiException error) {
  if (error.kind != ApiErrorKind.rateLimited) return error;
  final seconds = error.retryAfterSeconds;
  return ApiException(
    kind: error.kind,
    statusCode: error.statusCode,
    code: error.code,
    requestId: error.requestId,
    errors: error.errors,
    retryAfterSeconds: seconds,
    message: seconds == null
        ? 'Bạn gửi hơi nhanh, Kun cần nghỉ một chút. Bạn thử lại sau ít giây nhé.'
        : 'Bạn gửi hơi nhanh, Kun cần nghỉ một chút. Bạn thử lại sau khoảng $seconds giây nhé.',
  );
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
    'LOGIN_REQUIRED' => 'Cần đăng nhập',
    'SHOWING_APPOINTMENTS' => 'Lịch hẹn của bạn',
    'AWAITING_CONFIRMATION' => 'Chờ bạn xác nhận',
    _ => null,
  };
}
