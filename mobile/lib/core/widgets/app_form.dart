import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';

/// Bộ đếm ký tự chỉ hiện khi sắp chạm giới hạn; còn xa thì ẩn để form đỡ rối.
Widget? nearLimitCounter(
  BuildContext context, {
  required int currentLength,
  required bool isFocused,
  required int? maxLength,
}) {
  if (maxLength == null || currentLength < maxLength * 0.85) return null;
  return Text(
    '$currentLength/$maxLength',
    style: Theme.of(
      context,
    ).textTheme.labelMedium?.copyWith(color: context.colors.warning),
  );
}

/// Tiêu đề nhóm trong form ("Thông tin cơ bản", "Liên hệ").
class AppFormGroupTitle extends StatelessWidget {
  const AppFormGroupTitle(this.title, {super.key});

  final String title;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(
      top: AppSpacing.md,
      bottom: AppSpacing.xs,
      left: AppSpacing.xxs,
    ),
    child: Text(title, style: Theme.of(context).textTheme.titleSmall),
  );
}

/// Chọn một trong vài giá trị bằng các nút liền nhau (giới tính); chạm lại mục đang chọn để bỏ chọn.
class AppSegmentedChoice<T> extends StatelessWidget {
  const AppSegmentedChoice({
    super.key,
    required this.label,
    required this.items,
    required this.selected,
    required this.labelOf,
    required this.onChanged,
  });

  final String label;
  final List<T> items;
  final T? selected;
  final String Function(T) labelOf;
  final ValueChanged<T?>? onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: AppSpacing.xxs, bottom: 4),
          child: Text(
            label,
            style: text.labelMedium?.copyWith(color: colors.muted),
          ),
        ),
        Container(
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: colors.surfaceMuted,
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: Row(
            children: [
              for (final item in items)
                Expanded(
                  child: Semantics(
                    button: true,
                    selected: item == selected,
                    label: '$label: ${labelOf(item)}',
                    child: ExcludeSemantics(
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: onChanged == null
                            ? null
                            : () => onChanged!(item == selected ? null : item),
                        child: AnimatedContainer(
                          duration: AppMotion.responsive(
                            context,
                            AppMotion.fast,
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 11),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: item == selected
                                ? colors.surface
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(AppRadius.sm),
                          ),
                          child: Text(
                            labelOf(item),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: text.labelLarge?.copyWith(
                              color: item == selected
                                  ? colors.primaryDark
                                  : colors.muted,
                              fontWeight: item == selected
                                  ? FontWeight.w600
                                  : FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Chọn một giá trị bằng các chip xếp tự xuống dòng (mối quan hệ).
class AppChoiceChips<T> extends StatelessWidget {
  const AppChoiceChips({
    super.key,
    required this.items,
    required this.selected,
    required this.labelOf,
    required this.onChanged,
  });

  final List<T> items;
  final T? selected;
  final String Function(T) labelOf;
  final ValueChanged<T>? onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Wrap(
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      children: [
        for (final item in items)
          Semantics(
            button: true,
            selected: item == selected,
            label: labelOf(item),
            child: ExcludeSemantics(
              child: Material(
                color: item == selected ? colors.primary : colors.surface,
                shape: StadiumBorder(
                  side: BorderSide(
                    color: item == selected ? colors.primary : colors.border,
                  ),
                ),
                child: InkWell(
                  customBorder: const StadiumBorder(),
                  onTap: onChanged == null ? null : () => onChanged!(item),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                    child: Text(
                      labelOf(item),
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: item == selected ? colors.onPrimary : colors.ink,
                        fontWeight: item == selected
                            ? FontWeight.w600
                            : FontWeight.w500,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Dòng tùy chọn của form: bấm để mở hoặc thu gọn nhóm ô bên dưới. Nội dung vẫn nằm trong cây widget khi thu gọn
/// nên form kiểm tra hợp lệ đủ mọi ô; trạng thái mở do màn chứa form giữ.
class AppFormGroupRow extends StatelessWidget {
  const AppFormGroupRow({
    super.key,
    required this.icon,
    required this.title,
    required this.summary,
    required this.expanded,
    required this.onToggle,
    required this.child,
  });

  final IconData icon;
  final String title;

  /// Chữ phụ bên phải khi thu gọn ("Chưa có", "Tùy chọn").
  final String summary;
  final bool expanded;
  final VoidCallback onToggle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: colors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            button: true,
            expanded: expanded,
            label: title,
            child: InkWell(
              onTap: onToggle,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: 14,
                ),
                child: Row(
                  children: [
                    Icon(icon, size: 20, color: colors.primary),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(child: Text(title, style: text.bodyLarge)),
                    Flexible(
                      child: Text(
                        summary,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: text.labelMedium?.copyWith(color: colors.muted),
                      ),
                    ),
                    Icon(
                      expanded
                          ? Icons.expand_less_rounded
                          : Icons.expand_more_rounded,
                      color: colors.muted,
                    ),
                  ],
                ),
              ),
            ),
          ),
          Visibility(
            visible: expanded,
            maintainState: true,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.sm,
                0,
                AppSpacing.sm,
                AppSpacing.sm,
              ),
              child: child,
            ),
          ),
        ],
      ),
    );
  }
}

/// Dòng công tắc của form; bật thì hiện thêm nhóm ô bên dưới (BHYT).
class AppFormToggleRow extends StatelessWidget {
  const AppFormToggleRow({
    super.key,
    required this.icon,
    required this.title,
    required this.value,
    required this.onChanged,
    this.child,
  });

  final IconData icon;
  final String title;
  final bool value;
  final ValueChanged<bool>? onChanged;

  /// Hiện khi công tắc bật.
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SwitchListTile(
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm,
            ),
            secondary: Icon(icon, size: 20, color: colors.primary),
            title: Text(title, style: Theme.of(context).textTheme.bodyLarge),
            value: value,
            onChanged: onChanged,
          ),
          if (value && child != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.sm,
                0,
                AppSpacing.sm,
                AppSpacing.sm,
              ),
              child: child,
            ),
        ],
      ),
    );
  }
}
