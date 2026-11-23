import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_models.dart';

/// Biểu tượng theo loại gợi ý: nhìn qua biết nút đưa tới việc gì.
IconData chatbotActionIcon(String type) => switch (type) {
  'ASK_QUESTION' => Icons.help_outline_outlined,
  'VIEW_DEPARTMENTS' || 'VIEW_DEPARTMENT' => Icons.local_hospital_outlined,
  'VIEW_DOCTOR' ||
  'VIEW_DOCTORS' ||
  'CHANGE_DOCTOR' => Icons.person_outline_outlined,
  'VIEW_PACKAGES' || 'VIEW_PACKAGE' => Icons.health_and_safety_outlined,
  'START_BOOKING' || 'CHANGE_DATE' => Icons.event_available_outlined,
  'LOOKUP_APPOINTMENT' => Icons.event_note_outlined,
  _ => Icons.arrow_forward_outlined,
};

/// Gợi ý trùng với thẻ kết quả đang hiện (chọn khoa, gói, bác sĩ, giờ) thì bỏ: thẻ đã là nơi chọn.
List<ChatbotAction> visibleChatbotActions(
  List<ChatbotAction> actions,
  List<ChatbotResultGroup> results,
) {
  final covered = results.map(
    (group) => switch (group.type) {
      'departments' => 'VIEW_DEPARTMENT',
      'packages' => 'VIEW_PACKAGE',
      'doctors' => 'VIEW_DOCTOR',
      'slots' => 'VIEW_AVAILABLE_SLOTS',
      _ => '',
    },
  );
  return actions
      .where(
        (action) =>
            !covered.contains(action.type) && action.type != 'EMERGENCY_ADVICE',
      )
      .take(4)
      .toList(growable: false);
}

/// Gợi ý bước tiếp theo nằm ngay dưới câu trả lời mà nó bám theo, mỗi nút đủ lớn để chạm.
class ChatbotFollowUps extends StatelessWidget {
  const ChatbotFollowUps({
    super.key,
    required this.actions,
    required this.disabled,
    required this.onAction,
    this.title = 'Bạn có thể hỏi tiếp',
  });

  final List<ChatbotAction> actions;
  final bool disabled;
  final ValueChanged<ChatbotAction> onAction;
  final String? title;

  @override
  Widget build(BuildContext context) {
    if (actions.isEmpty) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Divider(height: 1, color: scheme.outlineVariant),
          const SizedBox(height: AppSpacing.sm),
          if (title != null) ...[
            Text(
              title!,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: scheme.onSurfaceVariant,
                fontWeight: AppFontWeight.strong,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
          ],
          for (final action in actions)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  key: ValueKey(
                    'chatbot-follow-up-${action.type}-${action.label}',
                  ),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(44),
                    alignment: Alignment.centerLeft,
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xs,
                    ),
                  ),
                  onPressed: disabled ? null : () => onAction(action),
                  icon: Icon(chatbotActionIcon(action.type), size: 18),
                  label: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(action.label),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Nguồn tri thức của câu trả lời, dạng thẻ nhỏ; nguồn là nội dung được duyệt kèm người duyệt và ngày cập nhật.
class ChatbotSourceChips extends StatelessWidget {
  const ChatbotSourceChips({super.key, required this.sources});

  final List<ChatbotSourceRef> sources;

  @override
  Widget build(BuildContext context) {
    if (sources.isEmpty) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    final style = Theme.of(
      context,
    ).textTheme.labelSmall?.copyWith(color: scheme.onSurfaceVariant);
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.description_outlined,
                size: 14,
                color: scheme.onSurfaceVariant,
              ),
              const SizedBox(width: AppSpacing.xxs),
              Text('Nguồn', style: style),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          for (final source in sources.take(3))
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  DecoratedBox(
                    decoration: BoxDecoration(
                      color: scheme.surfaceContainerLow,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                      border: Border.all(color: scheme.outlineVariant),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.xs,
                        vertical: AppSpacing.xxs,
                      ),
                      child: Text(
                        source.title,
                        style: style?.copyWith(color: scheme.primary),
                      ),
                    ),
                  ),
                  if (source.reviewLine != null)
                    Padding(
                      padding: const EdgeInsets.only(
                        left: AppSpacing.xxs,
                        top: AppSpacing.xxs,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.verified_outlined,
                            size: 13,
                            color: scheme.tertiary,
                          ),
                          const SizedBox(width: AppSpacing.xxs),
                          Flexible(
                            child: Text(source.reviewLine!, style: style),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
