import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/features/chatbot/application/chatbot_controller.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_models.dart';

class ChatbotScreen extends ConsumerStatefulWidget {
  const ChatbotScreen({super.key});

  @override
  ConsumerState<ChatbotScreen> createState() => _ChatbotScreenState();
}

class _ChatbotScreenState extends ConsumerState<ChatbotScreen> {
  final _inputController = TextEditingController();
  final _scrollController = ScrollController();

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
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Trợ lý đặt lịch'),
            Text(
              'Hỗ trợ thông tin, không thay thế chẩn đoán',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w400),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Cuộc trò chuyện mới',
            onPressed: state.isSending ? null : _confirmReset,
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            _AvailabilityBar(state: state),
            if (state.flowStatus != null)
              Container(
                width: double.infinity,
                color: Theme.of(context).colorScheme.primaryContainer,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                child: Text(
                  state.flowStatus!,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            Expanded(
              child: ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
                itemCount: state.messages.length + (state.isSending ? 1 : 0),
                itemBuilder: (context, index) {
                  if (index == state.messages.length) {
                    return const _TypingIndicator();
                  }
                  final message = state.messages[index];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _MessageBubble(
                      message: message,
                      disabled: state.isSending,
                      onAction: _sendAction,
                    ),
                  );
                },
              ),
            ),
            _Composer(
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
    await ref.read(chatbotControllerProvider.notifier).sendMessage(value);
  }

  Future<void> _sendAction(ChatbotAction action) async {
    final succeeded = await ref
        .read(chatbotControllerProvider.notifier)
        .sendAction(action);
    if (!succeeded || !mounted) return;

    if (action.type == 'START_BOOKING') {
      context.push(
        _bookingLocation(action, ref.read(chatbotControllerProvider).draft),
      );
    } else if (action.type == 'LOOKUP_APPOINTMENT') {
      context.push('/appointments');
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
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    });
  }
}

class _AvailabilityBar extends StatelessWidget {
  const _AvailabilityBar({required this.state});

  final ChatbotState state;

  @override
  Widget build(BuildContext context) {
    final (icon, text, color) = switch (state.availability) {
      ChatbotAvailability.checking => (
        Icons.sync_rounded,
        'Đang kiểm tra trạng thái trợ lý…',
        Theme.of(context).colorScheme.secondary,
      ),
      ChatbotAvailability.ready => (
        Icons.circle,
        'Đang sẵn sàng hỗ trợ',
        const Color(0xFF237A57),
      ),
      ChatbotAvailability.disabled => (
        Icons.pause_circle_outline,
        'Trợ lý đang tạm tắt',
        Theme.of(context).colorScheme.onSurfaceVariant,
      ),
      ChatbotAvailability.unavailable => (
        Icons.cloud_off_outlined,
        'Chưa thể kết nối trợ lý',
        Theme.of(context).colorScheme.error,
      ),
    };
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(
          bottom: BorderSide(
            color: Theme.of(context).colorScheme.outlineVariant,
          ),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
      child: Row(
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 7),
          Expanded(
            child: Text(
              text,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: color),
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.disabled,
    required this.onAction,
  });

  final ChatMessage message;
  final bool disabled;
  final ValueChanged<ChatbotAction> onAction;

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == ChatMessageRole.user;
    final isAlert = message.role == ChatMessageRole.alert;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.86,
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: isUser
                ? Theme.of(context).colorScheme.primary
                : isAlert
                ? const Color(0xFFFFF3DD)
                : Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(18),
              topRight: const Radius.circular(18),
              bottomLeft: Radius.circular(isUser ? 18 : 5),
              bottomRight: Radius.circular(isUser ? 5 : 18),
            ),
            border: isUser
                ? null
                : Border.all(
                    color: isAlert
                        ? const Color(0xFFF2B66D)
                        : Theme.of(context).colorScheme.outlineVariant,
                  ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(13),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (!isUser && message.source != null) ...[
                  Text(
                    message.source!.label.toUpperCase(),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: isAlert
                          ? const Color(0xFFA4660D)
                          : Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
                    ),
                  ),
                  const SizedBox(height: 5),
                ],
                Text(
                  message.content,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: isUser
                        ? Theme.of(context).colorScheme.onPrimary
                        : null,
                    height: 1.45,
                  ),
                ),
                if (!isUser && message.results.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  _ResultGroups(
                    groups: message.results,
                    disabled: disabled,
                    onAction: onAction,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ResultGroups extends StatelessWidget {
  const _ResultGroups({
    required this.groups,
    required this.disabled,
    required this.onAction,
  });

  final List<ChatbotResultGroup> groups;
  final bool disabled;
  final ValueChanged<ChatbotAction> onAction;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: groups
        .where((group) => group.items.isNotEmpty)
        .map(
          (group) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  group.title,
                  style: Theme.of(
                    context,
                  ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
                if (group.description != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    group.description!,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
                const SizedBox(height: 8),
                ...group.items.map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _ResultCard(
                      item: item,
                      disabled: disabled,
                      onAction: onAction,
                    ),
                  ),
                ),
                Text(
                  'Hiển thị ${group.items.length}/${group.total} kết quả',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        )
        .toList(growable: false),
  );
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({
    required this.item,
    required this.disabled,
    required this.onAction,
  });

  final ChatbotResultItem item;
  final bool disabled;
  final ValueChanged<ChatbotAction> onAction;

  @override
  Widget build(BuildContext context) {
    final action = item.action;
    final subtitle = switch (item.type) {
      ChatbotResultType.doctor => item.departmentName,
      ChatbotResultType.package => item.departmentName ?? item.summary,
      ChatbotResultType.slot => [
        item.departmentName,
        item.date == null ? null : formatDateVi(item.date!),
        '${item.startTime ?? ''}-${item.endTime ?? ''}',
      ].whereType<String>().where((value) => value.isNotEmpty).join(' · '),
      _ => item.description,
    };
    final price = switch (item.type) {
      ChatbotResultType.doctor => item.consultationFee,
      ChatbotResultType.package => item.finalPrice,
      _ => 0,
    };
    return Container(
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(_resultIcon(item.type), size: 20, color: AppTheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.displayName,
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                    if (subtitle?.isNotEmpty == true) ...[
                      const SizedBox(height: 3),
                      Text(
                        subtitle!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                    if (price > 0) ...[
                      const SizedBox(height: 4),
                      Text(
                        formatVnd(price),
                        style: Theme.of(context).textTheme.labelMedium
                            ?.copyWith(
                              color: AppTheme.primary,
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (action != null) ...[
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(40),
                ),
                onPressed: disabled ? null : () => onAction(action),
                child: Text(_resultActionLabel(item.type)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _TypingIndicator extends StatelessWidget {
  const _TypingIndicator();

  @override
  Widget build(BuildContext context) => const Align(
    alignment: Alignment.centerLeft,
    child: Padding(
      padding: EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox.square(
            dimension: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          SizedBox(width: 9),
          Text('Trợ lý đang trả lời…'),
        ],
      ),
    ),
  );
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.state,
    required this.inputController,
    required this.onSend,
    required this.onAction,
    required this.onDismissError,
    this.onRetry,
  });

  final ChatbotState state;
  final TextEditingController inputController;
  final VoidCallback onSend;
  final ValueChanged<ChatbotAction> onAction;
  final VoidCallback onDismissError;
  final Future<bool> Function()? onRetry;

  @override
  Widget build(BuildContext context) {
    final visibleActions = state.actions
        .where((action) {
          final resultTypes = state.messages.last.results.map(
            (group) => switch (group.type) {
              'departments' => 'VIEW_DEPARTMENT',
              'packages' => 'VIEW_PACKAGE',
              'doctors' => 'VIEW_DOCTOR',
              'slots' => 'VIEW_AVAILABLE_SLOTS',
              _ => '',
            },
          );
          return !resultTypes.contains(action.type);
        })
        .toList(growable: false);

    return Material(
      color: Theme.of(context).colorScheme.surface,
      elevation: 8,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (state.error != null) ...[
              AppErrorBanner(error: state.error!, onDismiss: onDismissError),
              const SizedBox(height: 8),
              Row(
                children: [
                  if (onRetry != null)
                    TextButton.icon(
                      onPressed: state.isSending ? null : () => onRetry!(),
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Gửi lại'),
                    )
                  else
                    TextButton.icon(
                      onPressed: () => ProviderScope.containerOf(
                        context,
                      ).read(chatbotControllerProvider.notifier).loadSettings(),
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Thử kết nối lại'),
                    ),
                ],
              ),
            ],
            if (visibleActions.isNotEmpty) ...[
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: visibleActions
                      .map(
                        (action) => Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ActionChip(
                            onPressed: state.canSend
                                ? () => onAction(action)
                                : null,
                            label: Text(action.label),
                          ),
                        ),
                      )
                      .toList(growable: false),
                ),
              ),
              const SizedBox(height: 8),
            ] else if (state.messages.length == 1 &&
                state.availability == ChatbotAvailability.ready) ...[
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children:
                      [
                            'Tìm bác sĩ phù hợp',
                            'Xem chuyên khoa',
                            'Hướng dẫn đặt lịch',
                          ]
                          .map(
                            (text) => Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: ActionChip(
                                label: Text(text),
                                onPressed: () {
                                  inputController.text = text;
                                  onSend();
                                },
                              ),
                            ),
                          )
                          .toList(growable: false),
                ),
              ),
              const SizedBox(height: 8),
            ],
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: TextField(
                    controller: inputController,
                    enabled: state.availability == ChatbotAvailability.ready,
                    minLines: 1,
                    maxLines: 4,
                    maxLength: 1000,
                    buildCounter:
                        (
                          _, {
                          required currentLength,
                          required isFocused,
                          maxLength,
                        }) => isFocused
                        ? Text('$currentLength/$maxLength')
                        : null,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      hintText:
                          state.availability == ChatbotAvailability.disabled
                          ? 'Trợ lý đang tạm tắt'
                          : 'Nhập câu hỏi…',
                    ),
                    onSubmitted: (_) => state.canSend ? onSend() : null,
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  tooltip: 'Gửi tin nhắn',
                  onPressed: state.canSend ? onSend : null,
                  icon: const Icon(Icons.send_rounded),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Không nhập OTP, mật khẩu hoặc thông tin quá nhạy cảm.',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
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
      'doctorId': ?value('doctorId', draft?.doctorId),
      'date': ?value('date', draft?.date),
      'timeSlotId': ?value('timeSlotId', draft?.timeSlotId),
    },
  ).toString();
}

IconData _resultIcon(ChatbotResultType type) => switch (type) {
  ChatbotResultType.department => Icons.local_hospital_outlined,
  ChatbotResultType.package => Icons.health_and_safety_outlined,
  ChatbotResultType.doctor => Icons.person_outline_rounded,
  ChatbotResultType.slot => Icons.schedule_outlined,
  ChatbotResultType.unknown => Icons.info_outline,
};

String _resultActionLabel(ChatbotResultType type) => switch (type) {
  ChatbotResultType.department => 'Chọn chuyên khoa',
  ChatbotResultType.package => 'Chọn gói khám',
  ChatbotResultType.doctor => 'Chọn bác sĩ',
  ChatbotResultType.slot => 'Chọn khung giờ',
  ChatbotResultType.unknown => 'Xem thêm',
};
