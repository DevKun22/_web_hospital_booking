import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/features/support/application/support_action_launcher.dart';
import 'package:hospital_booking_mobile/features/chatbot/application/chatbot_controller.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_models.dart';

import 'package:hospital_booking_mobile/features/chatbot/presentation/widgets/chatbot_composer.dart';
import 'package:hospital_booking_mobile/features/chatbot/presentation/widgets/chatbot_messages.dart';

class ChatbotScreen extends ConsumerStatefulWidget {
  const ChatbotScreen({super.key, this.initialPrompt});

  final String? initialPrompt;

  @override
  ConsumerState<ChatbotScreen> createState() => _ChatbotScreenState();
}

class _ChatbotScreenState extends ConsumerState<ChatbotScreen> {
  late final TextEditingController _inputController;
  final _scrollController = ScrollController();
  final _latestMessageKey = GlobalKey();
  late bool _showPrefillNotice;

  @override
  void initState() {
    super.initState();
    final prompt = widget.initialPrompt?.trim();
    _inputController = TextEditingController(
      text: prompt?.isNotEmpty == true ? prompt : null,
    );
    _showPrefillNotice = prompt?.isNotEmpty == true;
  }

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(chatbotControllerProvider);
    final controller = ref.read(chatbotControllerProvider.notifier);
    ref.listen(
      chatbotControllerProvider.select(
        (value) => (value.messages.length, value.isSending),
      ),
      (_, _) => _scrollToLatest(),
    );

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Trợ lý đặt lịch'),
            Text(
              'Hỗ trợ thông tin, không thay thế chẩn đoán',
              style: TextStyle(fontWeight: AppFontWeight.regular),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Xóa cuộc trò chuyện và bắt đầu lại',
            onPressed: state.isSending ? null : _confirmReset,
            icon: const Icon(Icons.refresh_outlined),
          ),
          const SizedBox(width: AppSpacing.xs),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            ChatbotAvailabilityBar(state: state),
            if (state.flowStatus != null)
              Container(
                width: double.infinity,
                color: Theme.of(context).colorScheme.primaryContainer,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.xs,
                ),
                child: Text(
                  state.flowStatus!,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                    fontWeight: AppFontWeight.strong,
                  ),
                ),
              ),
            Expanded(
              child: ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  AppSpacing.md,
                  AppSpacing.md,
                  AppSpacing.lg,
                ),
                itemCount: state.messages.length + (state.isSending ? 1 : 0),
                itemBuilder: (context, index) {
                  if (index == state.messages.length) {
                    return const ChatbotTypingIndicator();
                  }
                  final message = state.messages[index];
                  return Padding(
                    key: index == state.messages.length - 1
                        ? _latestMessageKey
                        : null,
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: ChatbotMessageBubble(
                      message: message,
                      disabled: !state.canSend,
                      isLatest:
                          index == state.messages.length - 1 &&
                          !state.isSending,
                      onAction: _sendAction,
                    ),
                  );
                },
              ),
            ),
            if (_showPrefillNotice)
              Container(
                key: const Key('chatbot-context-prefill-notice'),
                width: double.infinity,
                margin: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  0,
                  AppSpacing.md,
                  AppSpacing.xs,
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xs,
                ),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.edit_note_outlined,
                      size: 19,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    const Expanded(
                      child: Text(
                        'Đã điền câu hỏi theo nội dung bạn vừa xem. Bạn có thể chỉnh sửa trước khi gửi.',
                      ),
                    ),
                  ],
                ),
              ),
            ChatbotComposer(
              state: state,
              inputController: _inputController,
              onSend: _sendText,
              onAction: _sendAction,
              onRetry: state.lastFailedRequest == null
                  ? null
                  : controller.retryLast,
              onDismissError: controller.dismissError,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _sendText() async {
    final value = _inputController.text.trim();
    final state = ref.read(chatbotControllerProvider);
    if (value.isEmpty || value.length > 1000 || !state.canSend) return;
    FocusManager.instance.primaryFocus?.unfocus();
    _inputController.clear();
    if (_showPrefillNotice) {
      setState(() => _showPrefillNotice = false);
    }
    await ref.read(chatbotControllerProvider.notifier).sendMessage(value);
  }

  Future<void> _sendAction(ChatbotAction action) async {
    // Nút gọi cấp cứu (115, số của cơ sở): mở trình gọi điện ngay, không chờ máy chủ.
    if (action.type == 'EMERGENCY_ADVICE') {
      final phone = action.payload['phone']?.toString().trim();
      if (phone != null && phone.isNotEmpty) {
        unawaited(
          ref.read(supportActionLauncherProvider).openPhoneDialer(phone),
        );
        return;
      }
    }
    // Nút chỉ để chuyển trang thì chuyển ngay, không gửi vòng qua máy chủ (giống web).
    // /appointments là một tab của StatefulShellRoute: phải `go` (chuyển tab), KHÔNG `push` — push một nhánh của
    // thanh tab chồng lên màn trợ lý dựng ra vỏ tab thứ hai có thân trống (màn trắng, thấy trên máy thật).
    // Khách thì AuthGate của tab hiện lời mời đăng nhập rồi quay lại đúng tab.
    if (action.type == 'LOGIN_REQUIRED' ||
        action.type == 'LOOKUP_APPOINTMENT') {
      context.go('/appointments');
      return;
    }
    if (action.type == 'CONTACT_STAFF') {
      unawaited(context.push('/support'));
      return;
    }
    // Đặt lịch với lựa chọn điền sẵn: mở form ngay (giống web), không phụ thuộc máy chủ chatbot đang bận hay lỗi.
    if (action.type == 'START_BOOKING') {
      openBookingFromCurrentRoute(
        context,
        _bookingLocation(action, ref.read(chatbotControllerProvider).draft),
      );
      return;
    }
    final succeeded = await ref
        .read(chatbotControllerProvider.notifier)
        .sendAction(action);
    if (!succeeded || !mounted) return;

    if (action.type == 'VIEW_PACKAGE') {
      final slug = action.payload['packageSlug']?.toString().trim();
      final packageId = action.payload['packageId']?.toString().trim();
      if (slug?.isNotEmpty == true) {
        unawaited(context.push('/packages/${Uri.encodeComponent(slug!)}'));
      } else if (packageId?.isNotEmpty == true) {
        openBookingFromCurrentRoute(
          context,
          '/booking?packageId=${Uri.encodeQueryComponent(packageId!)}&origin=chatbot',
        );
      }
    }
  }

  Future<void> _confirmReset() async {
    final state = ref.read(chatbotControllerProvider);
    if (state.messages.length <= 1) {
      ref.read(chatbotControllerProvider.notifier).resetConversation();
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Bắt đầu cuộc trò chuyện mới?'),
        content: const Text(
          'Nội dung hiện tại chỉ lưu trong phiên này và sẽ được xóa khỏi màn hình.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Tiếp tục trò chuyện'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Tạo cuộc trò chuyện mới'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      ref.read(chatbotControllerProvider.notifier).resetConversation();
    }
  }

  void _scrollToLatest() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      final state = ref.read(chatbotControllerProvider);
      final last = state.messages.last;
      final target = _latestMessageKey.currentContext;
      // Trả lời dài (danh sách thẻ): đưa đầu câu trả lời lên để người dùng
      // đọc từ đầu thay vì bị cuốn xuống cuối danh sách.
      if (!state.isSending &&
          last.role != ChatMessageRole.user &&
          last.results.isNotEmpty &&
          target != null) {
        unawaited(
          Scrollable.ensureVisible(
            target,
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOut,
            alignment: 0,
          ),
        );
        return;
      }
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    });
  }
}

String _bookingLocation(ChatbotAction action, ChatBookingDraft? draft) {
  final prefill = action.payload['prefill'];
  final values = prefill is Map
      ? Map<String, dynamic>.from(prefill)
      : const <String, dynamic>{};
  String? value(String key, String? fallback) {
    final raw = values[key];
    return raw is String && raw.trim().isNotEmpty ? raw : fallback;
  }

  return Uri(
    path: '/booking',
    queryParameters: {
      'departmentId': ?value('departmentId', draft?.departmentId),
      'packageId': ?value('packageId', draft?.packageId),
      'doctorId': ?value('doctorId', draft?.doctorId),
      'date': ?value('date', draft?.date),
      'timeSlotId': ?value('timeSlotId', draft?.timeSlotId),
      'origin': 'chatbot',
    },
  ).toString();
}
