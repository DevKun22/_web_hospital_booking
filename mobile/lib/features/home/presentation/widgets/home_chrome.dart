import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:flutter/material.dart';

import 'package:hospital_booking_mobile/core/design/app_colors.dart';

class HomeSectionHeader extends StatelessWidget {
  const HomeSectionHeader({
    super.key,
    required this.title,
    required this.actionLabel,
    required this.onAction,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(color: context.colors.ink),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: AppSpacing.hair),
              Text(
                subtitle!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: context.colors.muted),
              ),
            ],
          ],
        ),
      ),
      if (actionLabel != null)
        TextButton.icon(
          onPressed: onAction,
          style: TextButton.styleFrom(
            foregroundColor: context.colors.primary,
            minimumSize: const Size(0, 32),
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xxs),
          ),
          label: Text(actionLabel!),
          icon: const Icon(Icons.chevron_right_outlined, size: 16),
          iconAlignment: IconAlignment.end,
        ),
    ],
  );
}

class HomeOfflineContentNotice extends StatelessWidget {
  const HomeOfflineContentNotice({
    super.key,
    required this.message,
    required this.onRetry,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      key: const Key('home-offline-content-notice'),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: context.colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: colorScheme.surface,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Icon(
                  Icons.cloud_off_outlined,
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Đang dùng nội dung đã lưu',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: AppFontWeight.strong,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      '$message Bạn vẫn có thể xem nội dung công khai đã lưu; hãy kết nối lại để mở lịch khám và hồ sơ cá nhân.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.cloud_sync_outlined, size: 20),
              label: const Text('Kết nối lại'),
            ),
          ),
        ],
      ),
    );
  }
}

class HomeCachedDataIndicator extends StatelessWidget {
  const HomeCachedDataIndicator({super.key});

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(
        Icons.sync_outlined,
        size: 16,
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
      const SizedBox(width: AppSpacing.xs),
      Expanded(
        child: Text(
          'Đang hiển thị dữ liệu đã lưu và kiểm tra cập nhật…',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ),
    ],
  );
}

class HomeEmergencyCard extends StatelessWidget {
  const HomeEmergencyCard({
    super.key,
    required this.hotline,
    required this.onTap,
  });

  final String hotline;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    key: const Key('home-emergency-support-card'),
    color: context.colors.dangerContainer,
    borderRadius: BorderRadius.circular(AppRadius.lg),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: context.colors.danger,
              foregroundColor: Theme.of(context).colorScheme.onError,
              child: Icon(Icons.emergency_outlined),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Cấp cứu khẩn cấp 24/7',
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                  Text(
                    hotline,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: context.colors.danger,
                      fontWeight: AppFontWeight.strong,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_outlined, color: context.colors.danger),
          ],
        ),
      ),
    ),
  );
}
