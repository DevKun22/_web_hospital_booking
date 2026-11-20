import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/features/chatbot/application/chatbot_controller.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_models.dart';

import 'package:hospital_booking_mobile/core/design/app_colors.dart';

class ChatbotAvailabilityBar extends StatelessWidget {
  const ChatbotAvailabilityBar({super.key, required this.state});

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
        context.colors.success,
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

class ChatbotComposer extends StatelessWidget {
  const ChatbotComposer({
    super.key,
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
    // Gợi ý bước tiếp theo nằm ngay dưới câu trả lời (ChatbotFollowUps), không còn hàng chip sát ô nhập.
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
