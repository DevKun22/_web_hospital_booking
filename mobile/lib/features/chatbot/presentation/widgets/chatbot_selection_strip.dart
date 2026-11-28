import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_models.dart';

/// Dải trên cùng khung chat khi đang giữa luồng đặt lịch: bước hiện tại và những gì bạn đã chọn (gói, khoa, bác sĩ, giờ),
/// để không phải cuộn lại tìm. Các lựa chọn xuống dòng khi chữ lớn.
class ChatbotSelectionStrip extends StatelessWidget {
  const ChatbotSelectionStrip({super.key, required this.status, this.summary});

  final String status;
  final ChatbotDraftSummary? summary;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final chips = summary?.chips ?? const <String>[];
    return Container(
      key: const Key('chatbot-selection-strip'),
      width: double.infinity,
      color: scheme.primaryContainer,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.xs,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            status,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: scheme.onPrimaryContainer,
              fontWeight: AppFontWeight.strong,
            ),
          ),
          if (chips.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xxs),
            Semantics(
              label: 'Bạn đã chọn: ${chips.join(', ')}',
              excludeSemantics: true,
              child: Wrap(
                spacing: AppSpacing.xxs,
                runSpacing: AppSpacing.xxs,
                children: [
                  for (final chip in chips)
                    DecoratedBox(
                      decoration: BoxDecoration(
                        color: scheme.surface,
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                        border: Border.all(color: scheme.outlineVariant),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.xs,
                          vertical: AppSpacing.xxs,
                        ),
                        child: Text(
                          chip,
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(color: scheme.onSurface),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
