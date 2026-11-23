import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';

/// Thanh tab lọc dùng chung (Hóa đơn, Lịch hẹn, Thông báo): các nhãn ngắn trên nền xanh nhạt, mục đang chọn nổi trắng.
class AppFilterTabs<T> extends StatelessWidget {
  const AppFilterTabs({
    super.key,
    required this.items,
    required this.selected,
    required this.labelOf,
    required this.onChanged,
  });

  final List<T> items;
  final T selected;
  final String Function(T) labelOf;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.all(3),
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
                label: labelOf(item),
                child: ExcludeSemantics(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => onChanged(item),
                    child: AnimatedContainer(
                      duration: AppMotion.responsive(context, AppMotion.fast),
                      padding: const EdgeInsets.symmetric(vertical: 9),
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
                        style: Theme.of(context).textTheme.labelMedium
                            ?.copyWith(
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
    );
  }
}

/// Vuốt ngang trên nội dung để sang tab kế (trái: tab sau, phải: tab trước), cùng thứ tự với [AppFilterTabs].
class AppSwipeTabs<T> extends StatelessWidget {
  const AppSwipeTabs({
    super.key,
    required this.items,
    required this.selected,
    required this.onChanged,
    required this.child,
  });

  final List<T> items;
  final T selected;
  final ValueChanged<T> onChanged;
  final Widget child;

  void _onEnd(DragEndDetails details) {
    final velocity = details.primaryVelocity ?? 0;
    if (velocity.abs() < 350) return;
    final next = items.indexOf(selected) + (velocity < 0 ? 1 : -1);
    if (next < 0 || next >= items.length) return;
    onChanged(items[next]);
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
    behavior: HitTestBehavior.translucent,
    onHorizontalDragEnd: _onEnd,
    child: child,
  );
}
