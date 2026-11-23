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
          padding: const EdgeInsets.only(
            left: AppSpacing.xxs,
            bottom: AppSpacing.xxs,
          ),
          child: Text(
            label,
            style: text.labelMedium?.copyWith(color: colors.muted),
          ),
        ),
        Container(
          padding: const EdgeInsets.all(AppSpacing.xxs),
          decoration: BoxDecoration(
            color: colors.primarySoft,
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
                          height: AppSize.segmentHeight - 6,
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
                                  ? AppFontWeight.strong
                                  : AppFontWeight.medium,
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
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      minHeight: AppSize.chipHeight,
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md,
                        vertical: AppSpacing.xs,
                      ),
                      child: Center(
                        widthFactor: 1,
                        child: Text(
                          labelOf(item),
                          style: Theme.of(context).textTheme.labelLarge
                              ?.copyWith(
                                color: item == selected
                                    ? colors.onPrimary
                                    : colors.ink,
                                fontWeight: item == selected
                                    ? AppFontWeight.strong
                                    : AppFontWeight.medium,
                              ),
                        ),
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

/// Ô để CHỌN (không gõ): nhãn nhỏ, giá trị bên dưới, mũi tên hoặc biểu tượng màu chính, nền xanh nhạt.
/// Ô gõ có nền xám xanh; hai kiểu nền khác nhau để người dùng biết ô nào chạm để chọn.
class AppPickerField extends StatelessWidget {
  const AppPickerField({
    super.key,
    required this.label,
    required this.placeholder,
    required this.onTap,
    this.value,
    this.icon = Icons.expand_more_outlined,
    this.onClear,
  });

  final String label;
  final String placeholder;
  final String? value;
  final IconData icon;
  final VoidCallback? onTap;

  /// Có thì hiện nút xóa thay cho biểu tượng khi đã có giá trị.
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final hasValue = value != null && value!.isNotEmpty;
    return Semantics(
      button: true,
      label: hasValue ? '$label: $value' : '$label: $placeholder',
      child: ExcludeSemantics(
        child: Material(
          color: colors.primarySoft,
          borderRadius: BorderRadius.circular(AppRadius.field),
          child: InkWell(
            borderRadius: BorderRadius.circular(AppRadius.field),
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
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            label,
                            style: text.labelMedium?.copyWith(
                              color: colors.muted,
                            ),
                          ),
                          Text(
                            hasValue ? value! : placeholder,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: text.bodyLarge?.copyWith(
                              color: hasValue ? colors.ink : colors.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (hasValue && onClear != null)
                      IconButton(
                        tooltip: 'Xóa $label',
                        onPressed: onClear,
                        icon: Icon(Icons.close_outlined, color: colors.primary),
                      )
                    else
                      Icon(icon, color: colors.primary),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
