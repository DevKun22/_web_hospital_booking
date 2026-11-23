import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';

/// Tiêu đề nhóm trên trang xem thông tin ("Cơ bản", "Liên hệ").
class AppInfoSection extends StatelessWidget {
  const AppInfoSection({
    super.key,
    required this.title,
    required this.children,
    this.footer,
  });

  final String title;
  final List<Widget> children;

  /// Dòng chú thích nhỏ dưới khối.
  final String? footer;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.xxs,
            AppSpacing.md,
            AppSpacing.xxs,
            AppSpacing.xs,
          ),
          child: Text(
            title,
            style: text.labelLarge?.copyWith(color: colors.muted),
          ),
        ),
        AppInfoCard(children: children),
        if (footer != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.xxs,
              AppSpacing.xs,
              AppSpacing.xxs,
              0,
            ),
            child: Text(
              footer!,
              style: text.bodySmall?.copyWith(color: colors.muted),
            ),
          ),
      ],
    );
  }
}

/// Tiêu đề nhóm đứng riêng (khi nhóm không phải một khối dòng, ví dụ lưới ô chỉ số).
class AppInfoSectionTitle extends StatelessWidget {
  const AppInfoSectionTitle(this.title, {super.key});

  final String title;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(
      AppSpacing.xxs,
      AppSpacing.md,
      AppSpacing.xxs,
      AppSpacing.xs,
    ),
    child: Text(
      title,
      style: Theme.of(
        context,
      ).textTheme.labelLarge?.copyWith(color: context.colors.muted),
    ),
  );
}

/// Khối trắng bo góc chứa các dòng thông tin, ngăn nhau bằng đường kẻ mảnh.
class AppInfoCard extends StatelessWidget {
  const AppInfoCard({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: colors.border, width: 0.5),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (var i = 0; i < children.length; i += 1) ...[
            if (i > 0)
              Divider(height: 0.5, thickness: 0.5, color: colors.divider),
            children[i],
          ],
        ],
      ),
    );
  }
}

/// Phía bên phải của một dòng thông tin.
enum AppInfoTrailing { edit, add, locked, verified, chevron, none }

/// Một dòng thông tin: nhãn nhỏ phía trên, giá trị bên dưới; chưa có giá trị thì hiện lời mời "Thêm ..." màu chính.
/// Chạm để sửa riêng dòng này (dòng khóa hoặc đã xác thực thì không chạm được).
class AppInfoRow extends StatelessWidget {
  const AppInfoRow({
    super.key,
    required this.label,
    required this.value,
    this.addLabel,
    this.onTap,
    this.trailing,
    this.maxLines = 2,
  });

  final String label;
  final String? value;

  /// Chữ mời nhập khi chưa có giá trị ("Thêm ngày sinh").
  final String? addLabel;
  final VoidCallback? onTap;

  /// Mặc định: có giá trị thì bút chì, chưa có thì dấu cộng.
  final AppInfoTrailing? trailing;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final hasValue = value != null && value!.trim().isNotEmpty;
    final kind =
        trailing ?? (hasValue ? AppInfoTrailing.edit : AppInfoTrailing.add);
    final icon = switch (kind) {
      AppInfoTrailing.edit => Icon(
        Icons.edit_outlined,
        size: 20,
        color: colors.primary,
      ),
      AppInfoTrailing.add => Icon(
        Icons.add_outlined,
        size: 22,
        color: colors.primary,
      ),
      AppInfoTrailing.locked => Icon(
        Icons.lock_outline,
        size: 20,
        color: colors.muted,
      ),
      AppInfoTrailing.verified => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.verified_user_outlined, size: 18, color: colors.success),
          const SizedBox(width: AppSpacing.xxs),
          Flexible(
            child: Text(
              'Đã xác thực',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: text.labelMedium?.copyWith(color: colors.success),
            ),
          ),
        ],
      ),
      AppInfoTrailing.chevron => Icon(
        Icons.chevron_right_outlined,
        color: colors.muted,
      ),
      AppInfoTrailing.none => const SizedBox.shrink(),
    };
    return Semantics(
      button: onTap != null,
      label: hasValue ? '$label: $value' : '$label: ${addLabel ?? 'chưa có'}',
      child: ExcludeSemantics(
        child: InkWell(
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: AppSize.fieldHeight),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              child: Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          label,
                          style: text.labelMedium?.copyWith(
                            color: colors.muted,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.hair),
                        Text(
                          hasValue ? value! : (addLabel ?? 'Chưa có'),
                          maxLines: maxLines,
                          overflow: TextOverflow.ellipsis,
                          style: hasValue
                              ? text.bodyLarge
                              : text.bodyLarge?.copyWith(
                                  color: colors.primary,
                                  fontWeight: AppFontWeight.strong,
                                ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Flexible(
                    flex: kind == AppInfoTrailing.verified ? 2 : 0,
                    child: icon,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Dòng công tắc trong khối thông tin (BHYT).
class AppInfoSwitchRow extends StatelessWidget {
  const AppInfoSwitchRow({
    super.key,
    required this.title,
    required this.value,
    required this.onChanged,
  });

  final String title;
  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) => ConstrainedBox(
    constraints: const BoxConstraints(minHeight: AppSize.fieldHeight),
    child: SwitchListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      title: Text(title, style: Theme.of(context).textTheme.bodyLarge),
      value: value,
      onChanged: onChanged,
    ),
  );
}
