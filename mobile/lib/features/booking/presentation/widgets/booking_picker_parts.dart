import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';

/// Số dòng hiện thêm mỗi lần cuộn tới cuối danh sách.
const bookingPickerPageSize = 20;

Future<void> showBookingPickerSheet(
  BuildContext context,
  Widget Function(BuildContext, ScrollController) builder,
) => showModalBottomSheet<void>(
  context: context,
  isScrollControlled: true,
  useRootNavigator: true,
  useSafeArea: true,
  showDragHandle: true,
  backgroundColor: context.colors.canvas,
  shape: const RoundedRectangleBorder(
    borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
  ),
  builder: (sheetContext) => DraggableScrollableSheet(
    expand: false,
    initialChildSize: 0.92,
    minChildSize: 0.5,
    maxChildSize: 0.95,
    builder: (_, scrollController) => builder(sheetContext, scrollController),
  ),
);

class BookingSearchField extends StatelessWidget {
  const BookingSearchField({
    super.key,
    required this.hint,
    required this.onChanged,
  });

  final String hint;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => TextField(
    key: const ValueKey('booking-picker-search'),
    onChanged: onChanged,
    textInputAction: TextInputAction.search,
    decoration: InputDecoration(
      hintText: hint,
      prefixIcon: const Icon(Icons.search_outlined),
    ),
  );
}

/// Danh sách tải dần: hiện [bookingPickerPageSize] dòng đầu, cuộn gần cuối thì hiện thêm.
class BookingPagedList<T> extends StatefulWidget {
  const BookingPagedList({
    super.key,
    required this.items,
    required this.scrollController,
    required this.itemBuilder,
    required this.emptyMessage,
  });

  final List<T> items;
  final ScrollController scrollController;
  final Widget Function(BuildContext, T) itemBuilder;
  final String emptyMessage;

  @override
  State<BookingPagedList<T>> createState() => BookingPagedListState<T>();
}

class BookingPagedListState<T> extends State<BookingPagedList<T>> {
  int _visible = bookingPickerPageSize;

  @override
  void didUpdateWidget(covariant BookingPagedList<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.items, widget.items) &&
        oldWidget.items.length != widget.items.length) {
      _visible = bookingPickerPageSize;
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = widget.items;
    if (items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Text(
            widget.emptyMessage,
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: context.colors.muted),
          ),
        ),
      );
    }
    final shown = items.length < _visible ? items.length : _visible;
    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (shown < items.length &&
            notification.metrics.extentAfter < 240 &&
            notification is ScrollUpdateNotification) {
          setState(() => _visible += bookingPickerPageSize);
        }
        return false;
      },
      child: ListView.separated(
        controller: widget.scrollController,
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.page,
          AppSpacing.xs,
          AppSpacing.page,
          AppSpacing.xl,
        ),
        itemCount: shown,
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.xs),
        itemBuilder: (context, index) =>
            widget.itemBuilder(context, items[index]),
      ),
    );
  }
}

class BookingMiniChip extends StatelessWidget {
  const BookingMiniChip({
    super.key,
    required this.label,
    required this.background,
    required this.foreground,
  });

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(
      horizontal: AppSpacing.xs,
      vertical: AppSpacing.xxs,
    ),
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(AppRadius.pill),
    ),
    child: Text(
      label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: Theme.of(context).textTheme.labelMedium?.copyWith(
        color: foreground,
        fontWeight: AppFontWeight.medium,
      ),
    ),
  );
}
