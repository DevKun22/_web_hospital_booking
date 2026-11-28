import 'dart:async';
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
    this.onRate,
    this.isLatest = false,
  });

  final ChatMessage message;
  final bool disabled;
  final ValueChanged<ChatbotAction> onAction;

  /// Gửi đánh giá cho câu trả lời; null thì không hiện hàng đánh giá.
  final void Function(String messageId, ChatbotFeedback value)? onRate;

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
                for (final card
                    in isUser ? const <ChatbotFactCard>[] : message.facts)
                  ChatbotFactCardView(card: card),
                if (!isUser && message.results.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  ChatbotResultGroups(
                    groups: message.results,
                    disabled: disabled,
                    onAction: onAction,
                  ),
                ],
                if (!isUser && isLatest && message.pendingExpiresAt != null)
                  ChatbotConfirmDeadline(expiresAt: message.pendingExpiresAt!),
                if (!isUser) ChatbotSourceChips(sources: message.sources),
                if (!isUser &&
                    !isAlert &&
                    message.messageId != null &&
                    onRate != null)
                  ChatbotFeedbackRow(
                    feedback: message.feedback,
                    disabled: disabled,
                    onRate: (value) => onRate!(message.messageId!, value),
                  ),
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

/// Kun đang trả lời. Chờ lâu hơn bình thường (AI bận) thì nói thật, để người dùng không tưởng app bị treo.
class ChatbotTypingIndicator extends StatefulWidget {
  const ChatbotTypingIndicator({
    super.key,
    this.slowAfter = const Duration(seconds: 6),
  });

  final Duration slowAfter;

  @override
  State<ChatbotTypingIndicator> createState() => _ChatbotTypingIndicatorState();
}

class _ChatbotTypingIndicatorState extends State<ChatbotTypingIndicator> {
  late final Timer _timer = Timer(widget.slowAfter, () {
    if (mounted) setState(() => _slow = true);
  });
  bool _slow = false;

  @override
  void initState() {
    super.initState();
    // Chạm vào `_timer` để khởi tạo lười bắt đầu đếm ngay.
    _timer.isActive;
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          const SizedBox.square(
            dimension: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          const SizedBox(width: AppSpacing.xs),
          Flexible(
            child: Text(
              _slow
                  ? 'Câu này cần thêm chút thời gian, bạn đợi Kun một lát nhé…'
                  : 'Kun đang trả lời…',
            ),
          ),
        ],
      ),
    ),
  );
}

/// Kun đã hỏi xác nhận hủy lịch: nói rõ còn hiệu lực đến mấy giờ (máy chủ cho 5 phút), hết hạn thì bấm xác nhận sẽ bị từ chối.
class ChatbotConfirmDeadline extends StatelessWidget {
  const ChatbotConfirmDeadline({super.key, required this.expiresAt});

  final DateTime expiresAt;

  @override
  Widget build(BuildContext context) {
    String two(int value) => value.toString().padLeft(2, '0');
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.timer_outlined, size: 14, color: context.colors.warning),
          const SizedBox(width: AppSpacing.xxs),
          Flexible(
            child: Text(
              'Xác nhận trước ${two(expiresAt.hour)}:${two(expiresAt.minute)}, quá giờ này Kun sẽ hỏi lại.',
              style: Theme.of(
                context,
              ).textTheme.labelSmall?.copyWith(color: context.colors.warning),
            ),
          ),
        ],
      ),
    );
  }
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
      ChatbotResultType.appointment => [
        item.date == null ? null : formatDateVi(item.date!),
        '${item.startTime ?? ''}-${item.endTime ?? ''}',
        item.doctorName,
        item.departmentName,
        chatbotAppointmentStatusLabels[item.status] ?? item.status,
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
  ChatbotResultType.appointment => Icons.event_note_outlined,
  ChatbotResultType.unknown => Icons.info_outline,
};

String chatbotResultActionLabel(ChatbotResultType type) => switch (type) {
  ChatbotResultType.department => 'Chọn chuyên khoa',
  ChatbotResultType.package => 'Chọn gói khám',
  ChatbotResultType.doctor => 'Chọn bác sĩ',
  ChatbotResultType.slot => 'Chọn khung giờ',
  ChatbotResultType.appointment => 'Xem chi tiết lịch',
  ChatbotResultType.unknown => 'Xem thêm',
};

/// Thẻ thông tin có cấu trúc: tiêu đề, các dòng nhãn-giá trị và một ghi chú. Chữ lớn thì giá trị xuống dòng, không tràn.
class ChatbotFactCardView extends StatelessWidget {
  const ChatbotFactCardView({super.key, required this.card});

  final ChatbotFactCard card;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Container(
      key: Key('chatbot-fact-card-${card.kind}'),
      width: double.infinity,
      margin: const EdgeInsets.only(top: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: scheme.outlineVariant),
        color: scheme.surfaceContainerLowest,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                card.kind == 'doctor'
                    ? Icons.person_outline_outlined
                    : Icons.health_and_safety_outlined,
                size: 20,
                color: context.colors.primary,
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  card.title,
                  style: text.labelLarge?.copyWith(
                    fontWeight: AppFontWeight.strong,
                  ),
                ),
              ),
            ],
          ),
          for (final row in card.rows) ...[
            const SizedBox(height: AppSpacing.xs),
            Divider(height: 1, color: scheme.outlineVariant),
            const SizedBox(height: AppSpacing.xs),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.label,
                  style: text.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    row.value,
                    textAlign: TextAlign.end,
                    style: text.bodySmall?.copyWith(
                      fontWeight: AppFontWeight.strong,
                    ),
                  ),
                ),
              ],
            ),
          ],
          if (card.note != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Divider(height: 1, color: scheme.outlineVariant),
            const SizedBox(height: AppSpacing.xs),
            Text(
              card.note!,
              style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
            ),
          ],
        ],
      ),
    );
  }
}

/// "Câu trả lời này thế nào?" với hai nút; đã đánh giá thì chỉ còn lời cảm ơn. Nút đủ lớn để chạm, tự xuống dòng khi chữ lớn.
class ChatbotFeedbackRow extends StatelessWidget {
  const ChatbotFeedbackRow({
    super.key,
    required this.feedback,
    required this.onRate,
    this.disabled = false,
  });

  final ChatbotFeedback? feedback;
  final bool disabled;
  final ValueChanged<ChatbotFeedback> onRate;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final label = Theme.of(
      context,
    ).textTheme.labelSmall?.copyWith(color: scheme.onSurfaceVariant);
    if (feedback != null) {
      return Padding(
        padding: const EdgeInsets.only(top: AppSpacing.xs),
        child: Text('Cảm ơn bạn đã phản hồi.', style: label),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.xs),
      child: Wrap(
        spacing: AppSpacing.xs,
        runSpacing: AppSpacing.xxs,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text('Câu trả lời này thế nào?', style: label),
          OutlinedButton.icon(
            key: const Key('chatbot-feedback-helpful'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(0, 40),
              visualDensity: VisualDensity.compact,
            ),
            onPressed: disabled ? null : () => onRate(ChatbotFeedback.helpful),
            icon: const Icon(Icons.thumb_up_outlined, size: 16),
            label: const Text('Hữu ích'),
          ),
          OutlinedButton.icon(
            key: const Key('chatbot-feedback-not-helpful'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(0, 40),
              visualDensity: VisualDensity.compact,
              foregroundColor: scheme.onSurfaceVariant,
            ),
            onPressed: disabled
                ? null
                : () => onRate(ChatbotFeedback.notHelpful),
            icon: const Icon(Icons.thumb_down_outlined, size: 16),
            label: const Text('Chưa đúng'),
          ),
        ],
      ),
    );
  }
}
