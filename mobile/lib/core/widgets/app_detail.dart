import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';

/// Khung chung của các màn chi tiết (bác sĩ, chuyên khoa, gói khám): đầu trang màu vùng, thông tin chính,
/// các khối nội dung và thanh đặt lịch dính đáy. Đổi kiểu một nơi là đổi cả ba màn.

/// Đầu trang: ảnh hoặc ô biểu tượng, tên, một dòng phụ và vài nhãn, trên nền theo vùng màu.
class AppDetailHeader extends StatelessWidget {
  const AppDetailHeader({
    super.key,
    required this.tint,
    required this.leading,
    required this.title,
    this.subtitle,
    this.chips = const [],
  });

  final ({Color background, Color foreground}) tint;
  final Widget leading;
  final String title;
  final String? subtitle;
  final List<Widget> chips;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: tint.background,
        borderRadius: BorderRadius.circular(AppRadius.xl),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          leading,
          const SizedBox(height: AppSpacing.sm),
          Text(title, style: text.titleLarge?.copyWith(color: colors.ink)),
          if (subtitle != null) ...[
            const SizedBox(height: AppSpacing.xxs),
            Text(
              subtitle!,
              style: text.bodyMedium?.copyWith(color: colors.textSoft),
            ),
          ],
          if (chips.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: chips,
            ),
          ],
        ],
      ),
    );
  }
}

/// Nhãn trắng viền mảnh trong đầu trang (kinh nghiệm, điểm sao, số bác sĩ).
class AppDetailChip extends StatelessWidget {
  const AppDetailChip({super.key, required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: colors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xxs,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: AppIconSize.sm, color: colors.primary),
              const SizedBox(width: AppSpacing.xxs),
            ],
            Flexible(
              child: Text(
                label,
                style: Theme.of(
                  context,
                ).textTheme.labelMedium?.copyWith(color: colors.ink),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Hàng ô thông tin chính (giá, kinh nghiệm...): mỗi ô một giá trị và một nhãn, tự xuống dòng khi chữ lớn.
class AppDetailFacts extends StatelessWidget {
  const AppDetailFacts({super.key, required this.facts});

  /// Mỗi phần tử: (giá trị, nhãn).
  final List<(String, String)> facts;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    return Wrap(
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      children: [
        for (final (value, label) in facts)
          ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 96),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(color: colors.border),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xs,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(value, style: text.titleSmall),
                    Text(
                      label,
                      style: text.labelSmall?.copyWith(color: colors.muted),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Khối nội dung: thẻ phẳng có tiêu đề nhỏ (và nút phụ bên phải nếu cần).
class AppDetailSection extends StatelessWidget {
  const AppDetailSection({
    super.key,
    required this.title,
    required this.child,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final Widget child;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(title, style: text.titleSmall)),
              if (actionLabel != null)
                TextButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          child,
        ],
      ),
    );
  }
}

/// Thanh dính đáy: giá (nếu có) bên trái, nút trợ lý nhỏ (nếu có) và một nút chính.
class AppDetailBar extends StatelessWidget {
  const AppDetailBar({
    super.key,
    required this.primaryLabel,
    required this.onPrimary,
    this.priceLabel,
    this.price,
    this.onAssistant,
  });

  final String primaryLabel;
  final VoidCallback onPrimary;
  final String? priceLabel;
  final String? price;
  final VoidCallback? onAssistant;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    return Material(
      color: colors.surface,
      child: SafeArea(
        top: false,
        minimum: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.sm,
          AppSpacing.md,
          AppSpacing.sm,
        ),
        child: Row(
          children: [
            if (price != null) ...[
              Flexible(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (priceLabel != null)
                      Text(
                        priceLabel!,
                        style: text.labelSmall?.copyWith(color: colors.muted),
                      ),
                    Text(
                      price!,
                      style: text.titleMedium?.copyWith(
                        color: colors.primaryDark,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
            ],
            if (onAssistant != null) ...[
              IconButton.outlined(
                tooltip: 'Hỏi trợ lý',
                onPressed: onAssistant,
                icon: const Icon(Icons.smart_toy_outlined),
              ),
              const SizedBox(width: AppSpacing.xs),
            ],
            Expanded(
              child: FilledButton(
                onPressed: onPrimary,
                child: Text(primaryLabel),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
