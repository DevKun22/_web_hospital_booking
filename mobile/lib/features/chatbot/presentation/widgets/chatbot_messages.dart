import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/features/chatbot/application/chatbot_controller.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_models.dart';

import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';

class ChatbotMessageBubble extends StatelessWidget {
  const ChatbotMessageBubble({
    super.key,
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
                ? AppPalette.warningContainer
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
                        ? AppPalette.warning
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
                          ? AppPalette.warning
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
                  ChatbotResultGroups(
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

class ChatbotTypingIndicator extends StatelessWidget {
  const ChatbotTypingIndicator({super.key});

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

class ChatbotResultGroups extends StatelessWidget {
  const ChatbotResultGroups({
    super.key,
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
                    child: ChatbotResultCard(
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

class ChatbotResultCard extends StatelessWidget {
  const ChatbotResultCard({
    super.key,
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
              Icon(
                chatbotResultIcon(item.type),
                size: 20,
                color: AppTheme.primary,
              ),
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
                child: Text(chatbotResultActionLabel(item.type)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

IconData chatbotResultIcon(ChatbotResultType type) => switch (type) {
  ChatbotResultType.department => Icons.local_hospital_outlined,
  ChatbotResultType.package => Icons.health_and_safety_outlined,
  ChatbotResultType.doctor => Icons.person_outline_rounded,
  ChatbotResultType.slot => Icons.schedule_outlined,
  ChatbotResultType.unknown => Icons.info_outline,
};

String chatbotResultActionLabel(ChatbotResultType type) => switch (type) {
  ChatbotResultType.department => 'Chọn chuyên khoa',
  ChatbotResultType.package => 'Chọn gói khám',
  ChatbotResultType.doctor => 'Chọn bác sĩ',
  ChatbotResultType.slot => 'Chọn khung giờ',
  ChatbotResultType.unknown => 'Xem thêm',
};
