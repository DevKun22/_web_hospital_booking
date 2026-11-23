import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/features/chatbot/application/chatbot_controller.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_models.dart';
import 'package:hospital_booking_mobile/features/chatbot/presentation/widgets/chatbot_follow_ups.dart';

import 'package:hospital_booking_mobile/core/design/app_colors.dart';

class ChatbotMessageBubble extends StatelessWidget {
  const ChatbotMessageBubble({
    super.key,
    required this.message,
    required this.disabled,
    required this.onAction,
    this.isLatest = false,
  });

  final ChatMessage message;
  final bool disabled;
  final ValueChanged<ChatbotAction> onAction;

  /// Tin mới nhất: chỉ tin này hiện gợi ý bước tiếp theo, tin cũ để lại như lịch sử.
  final bool isLatest;

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
                ? context.colors.warningContainer
                : Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(AppRadius.lg),
              topRight: const Radius.circular(AppRadius.lg),
              bottomLeft: Radius.circular(isUser ? 18 : 5),
              bottomRight: Radius.circular(isUser ? 5 : 18),
            ),
            border: isUser
                ? null
                : Border.all(
                    color: isAlert
                        ? context.colors.warning
                        : Theme.of(context).colorScheme.outlineVariant,
                  ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (!isUser && message.source != null) ...[
                  Text(
                    message.source!.label.toUpperCase(),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: isAlert
                          ? context.colors.warning
                          : Theme.of(context).colorScheme.primary,
                      fontWeight: AppFontWeight.strong,
                      letterSpacing: 0.4,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xxs),
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
                  const SizedBox(height: AppSpacing.sm),
                  ChatbotResultGroups(
                    groups: message.results,
                    disabled: disabled,
                    onAction: onAction,
                  ),
                ],
                if (!isUser) ChatbotSourceChips(sources: message.sources),
                if (!isUser && isLatest)
                  ChatbotFollowUps(
                    actions: visibleChatbotActions(
                      message.actions,
                      message.results,
                    ),
                    disabled: disabled,
                    onAction: onAction,
                    title: message.id == 'welcome'
                        ? null
                        : 'Bạn có thể hỏi tiếp',
                  ),
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
      padding: EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox.square(
            dimension: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          SizedBox(width: AppSpacing.xs),
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
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  group.title,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontWeight: AppFontWeight.strong,
                  ),
                ),
                if (group.description != null) ...[
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    group.description!,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
                const SizedBox(height: AppSpacing.xs),
                ...group.items.map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.xs),
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
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(AppRadius.md),
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
                color: context.colors.primary,
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.displayName,
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                    if (subtitle?.isNotEmpty == true) ...[
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        subtitle!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                    if (price > 0) ...[
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        formatVnd(price),
                        style: Theme.of(context).textTheme.labelMedium
                            ?.copyWith(
                              color: context.colors.primary,
                              fontWeight: AppFontWeight.strong,
                            ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (action != null) ...[
            const SizedBox(height: AppSpacing.xs),
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
  ChatbotResultType.doctor => Icons.person_outline_outlined,
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
