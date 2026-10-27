import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';

export 'app_brand_mark.dart';
export 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';

/// Keeps the final interactive content clear of the floating chatbot button
/// when a screen is rendered inside the main navigation shell.
const double appFloatingActionContentBottomInset = 112;

enum AppStatusTone { success, warning, danger, info }

class AppPrimaryButton extends StatelessWidget {
  const AppPrimaryButton({
    required this.label,
    required this.onPressed,
    super.key,
    this.icon,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool loading;

  @override
  Widget build(BuildContext context) => FilledButton(
    onPressed: loading ? null : onPressed,
    child: loading
        ? const SizedBox.square(
            dimension: 22,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[Icon(icon), const SizedBox(width: 8)],
              Text(label),
            ],
          ),
  );
}

/// Consistent white content surface used by feature screens.
class AppSurfaceCard extends StatelessWidget {
  const AppSurfaceCard({
    required this.child,
    super.key,
    this.padding = const EdgeInsets.all(AppSpacing.card),
    this.onTap,
    this.semanticLabel,
    this.backgroundColor,
    this.borderColor,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final String? semanticLabel;
  final Color? backgroundColor;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final card = Card(
      clipBehavior: Clip.antiAlias,
      color: backgroundColor,
      shape: borderColor == null
          ? null
          : RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              side: BorderSide(color: borderColor!),
            ),
      child: InkWell(
        onTap: onTap,
        child: Padding(padding: padding, child: child),
      ),
    );
    if (semanticLabel == null) return card;
    return Semantics(
      button: onTap != null,
      label: semanticLabel,
      onTap: onTap,
      child: ExcludeSemantics(child: card),
    );
  }
}

class AppSectionHeader extends StatelessWidget {
  const AppSectionHeader({
    required this.title,
    super.key,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Text(
          title,
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
        ),
      ),
      if (actionLabel != null)
        TextButton(onPressed: onAction, child: Text(actionLabel!)),
    ],
  );
}

class AppStickyActionBar extends StatelessWidget {
  const AppStickyActionBar({
    required this.primaryLabel,
    required this.onPrimary,
    super.key,
    this.primaryIcon,
    this.secondaryLabel,
    this.onSecondary,
    this.secondaryIcon,
    this.eyebrow,
    this.value,
  });

  final String primaryLabel;
  final VoidCallback? onPrimary;
  final IconData? primaryIcon;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;
  final IconData? secondaryIcon;
  final String? eyebrow;
  final String? value;

  @override
  Widget build(BuildContext context) => Material(
    color: Theme.of(context).colorScheme.surface,
    elevation: 0,
    shadowColor: Colors.transparent,
    child: SafeArea(
      top: false,
      minimum: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (eyebrow != null || value != null) ...[
            Row(
              children: [
                if (eyebrow != null)
                  Expanded(
                    child: Text(
                      eyebrow!,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                if (value != null)
                  Text(
                    value!,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
          ],
          Row(
            children: [
              if (secondaryLabel != null) ...[
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onSecondary,
                    icon: Icon(secondaryIcon ?? Icons.info_outline_rounded),
                    label: Text(secondaryLabel!),
                  ),
                ),
                const SizedBox(width: 10),
              ],
              Expanded(
                child: FilledButton.icon(
                  onPressed: onPrimary,
                  icon: Icon(primaryIcon ?? Icons.arrow_forward_rounded),
                  label: Text(primaryLabel),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

class AppGradientOverviewCard extends StatelessWidget {
  const AppGradientOverviewCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    super.key,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [AppTheme.primaryDark, AppTheme.primary],
      ),
      borderRadius: BorderRadius.circular(AppRadius.lg),
      boxShadow: AppShadow.soft,
    ),
    child: Row(
      children: [
        Container(
          width: 50,
          height: 50,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: Icon(icon, color: Colors.white),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.white.withValues(alpha: 0.84),
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class AppPageIntro extends StatelessWidget {
  const AppPageIntro({
    required this.title,
    required this.subtitle,
    super.key,
    this.badge,
  });

  final String title;
  final String subtitle;
  final String? badge;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              title,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w800,
                letterSpacing: -0.4,
              ),
            ),
          ),
          if (badge != null)
            AppStatusBadge(label: badge!, tone: AppStatusTone.info),
        ],
      ),
      const SizedBox(height: 6),
      Text(
        subtitle,
        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
          color: Theme.of(context).colorScheme.onSurfaceVariant,
          height: 1.35,
        ),
      ),
    ],
  );
}

class AppSearchField extends StatelessWidget {
  const AppSearchField({
    required this.controller,
    required this.hintText,
    required this.onChanged,
    super.key,
    this.onClear,
  });

  final TextEditingController controller;
  final String hintText;
  final ValueChanged<String> onChanged;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) => Semantics(
    textField: true,
    label: hintText,
    child: TextField(
      controller: controller,
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        hintText: hintText,
        prefixIcon: const Icon(Icons.search_rounded),
        suffixIcon: controller.text.isEmpty
            ? null
            : IconButton(
                tooltip: 'Xóa từ khóa',
                onPressed: onClear,
                icon: const Icon(Icons.close_rounded),
              ),
      ),
    ),
  );
}

class AppStatusBadge extends StatelessWidget {
  const AppStatusBadge({
    required this.label,
    required this.tone,
    super.key,
    this.icon,
  });

  final String label;
  final AppStatusTone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final (foreground, background) = switch (tone) {
      AppStatusTone.success => (
        AppPalette.success,
        AppPalette.successContainer,
      ),
      AppStatusTone.warning => (
        AppPalette.warning,
        AppPalette.warningContainer,
      ),
      AppStatusTone.danger => (AppPalette.danger, AppPalette.dangerContainer),
      AppStatusTone.info => (AppPalette.info, AppPalette.infoContainer),
    };

    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 16, color: foreground),
              const SizedBox(width: 5),
            ],
            Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: foreground,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AppEmptyState extends StatelessWidget {
  const AppEmptyState({
    required this.icon,
    required this.title,
    required this.message,
    super.key,
    this.action,
  });

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Center(
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 420),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(AppRadius.xl),
              ),
              child: Icon(
                icon,
                size: 34,
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            if (action != null) ...[const SizedBox(height: 20), action!],
          ],
        ),
      ),
    ),
  );
}

class AppLoadingSkeleton extends StatelessWidget {
  const AppLoadingSkeleton({super.key, this.height = 96});

  final double height;

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Đang tải nội dung',
    child: Container(
      height: height,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
    ),
  );
}
