import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/formatters/vietnam_time.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_date_format.dart';

/// Mở lịch tháng dạng popup; trả về ngày (yyyy-MM-dd) người dùng chọn, hoặc null khi đóng.
Future<String?> showBookingCalendar(
  BuildContext context, {
  required String doctorId,
  String? selectedDate,
}) => showDialog<String>(
  context: context,
  builder: (_) =>
      BookingCalendarDialog(doctorId: doctorId, selectedDate: selectedDate),
);

class BookingCalendarDialog extends ConsumerStatefulWidget {
  const BookingCalendarDialog({
    super.key,
    required this.doctorId,
    this.selectedDate,
  });

  final String doctorId;
  final String? selectedDate;

  @override
  ConsumerState<BookingCalendarDialog> createState() =>
      _BookingCalendarDialogState();
}

class _BookingCalendarDialogState extends ConsumerState<BookingCalendarDialog> {
  late final DateTime _today = vietnamToday();
  late final DateTime _first = DateTime(_today.year, _today.month, _today.day);
  late final DateTime _last = _first.add(
    const Duration(days: bookingWindowDays - 1),
  );
  late DateTime _month = _initialMonth();

  DateTime _initialMonth() {
    final selected = widget.selectedDate == null
        ? null
        : DateTime.tryParse(widget.selectedDate!);
    final base = selected ?? _first;
    return DateTime(base.year, base.month);
  }

  bool get _canGoBack => DateTime(
    _month.year,
    _month.month,
  ).isAfter(DateTime(_first.year, _first.month));
  bool get _canGoForward => DateTime(
    _month.year,
    _month.month,
  ).isBefore(DateTime(_last.year, _last.month));

  void _shift(int delta) =>
      setState(() => _month = DateTime(_month.year, _month.month + delta));

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final available = ref.watch(doctorAvailableDatesProvider(widget.doctorId));
    return Dialog(
      backgroundColor: colors.surface,
      insetPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.page,
        vertical: AppSpacing.xl,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.xl),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                IconButton(
                  tooltip: 'Tháng trước',
                  onPressed: _canGoBack ? () => _shift(-1) : null,
                  icon: const Icon(Icons.chevron_left_rounded),
                ),
                Expanded(
                  child: Text(
                    'Tháng ${_month.month}/${_month.year}',
                    textAlign: TextAlign.center,
                    style: text.titleSmall,
                  ),
                ),
                IconButton(
                  tooltip: 'Tháng sau',
                  onPressed: _canGoForward ? () => _shift(1) : null,
                  icon: const Icon(Icons.chevron_right_rounded),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            Row(
              children: [
                for (final label in const [
                  'T2',
                  'T3',
                  'T4',
                  'T5',
                  'T6',
                  'T7',
                  'CN',
                ])
                  Expanded(
                    child: Text(
                      label,
                      textAlign: TextAlign.center,
                      style: text.labelMedium?.copyWith(color: colors.muted),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            available.when(
              loading: () => const SizedBox(
                height: 240,
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (_, _) => SizedBox(
                height: 240,
                child: Center(
                  child: TextButton.icon(
                    onPressed: () => ref.invalidate(
                      doctorAvailableDatesProvider(widget.doctorId),
                    ),
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Không tải được lịch. Thử lại'),
                  ),
                ),
              ),
              data: (dates) => _MonthGrid(
                month: _month,
                first: _first,
                last: _last,
                available: dates,
                selectedDate: widget.selectedDate,
                onPick: (value) => Navigator.of(context).pop(value),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: colors.primary,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Ngày còn khung giờ trống',
                    style: text.bodySmall?.copyWith(color: colors.muted),
                  ),
                ),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Đóng'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MonthGrid extends StatelessWidget {
  const _MonthGrid({
    required this.month,
    required this.first,
    required this.last,
    required this.available,
    required this.selectedDate,
    required this.onPick,
  });

  final DateTime month;
  final DateTime first;
  final DateTime last;
  final Map<String, int> available;
  final String? selectedDate;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final daysInMonth = DateUtils.getDaysInMonth(month.year, month.month);
    final offset = DateTime(month.year, month.month).weekday - 1;
    final rows = ((offset + daysInMonth) / 7).ceil();
    return Column(
      children: [
        for (var row = 0; row < rows; row += 1)
          Row(
            children: [
              for (var col = 0; col < 7; col += 1)
                Expanded(
                  child: _cell(context, colors, row * 7 + col - offset + 1),
                ),
            ],
          ),
      ],
    );
  }

  Widget _cell(BuildContext context, AppColors colors, int day) {
    final daysInMonth = DateUtils.getDaysInMonth(month.year, month.month);
    if (day < 1 || day > daysInMonth) return const SizedBox(height: 46);
    final date = DateTime(month.year, month.month, day);
    final value = formatApiDate(date);
    final inWindow = !date.isBefore(first) && !date.isAfter(last);
    final count = available[value] ?? 0;
    final pickable = inWindow && count > 0;
    final selected = value == selectedDate;
    final text = Theme.of(context).textTheme;
    return Semantics(
      key: ValueKey('booking-date-$value'),
      button: pickable,
      enabled: pickable,
      selected: selected,
      label: pickable
          ? 'Ngày $day tháng ${month.month}, còn $count khung giờ'
          : 'Ngày $day tháng ${month.month}, không còn giờ trống',
      onTap: pickable ? () => onPick(value) : null,
      child: ExcludeSemantics(
        child: Center(
          child: InkResponse(
            onTap: pickable ? () => onPick(value) : null,
            radius: 24,
            child: Container(
              width: 42,
              height: 42,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: selected
                    ? colors.primary
                    : (pickable ? colors.primarySoft : Colors.transparent),
                shape: BoxShape.circle,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    '$day',
                    style: text.bodyMedium?.copyWith(
                      color: selected
                          ? colors.onPrimary
                          : (pickable ? colors.primaryDark : colors.muted),
                      fontWeight: pickable ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                  if (pickable)
                    Container(
                      width: 4,
                      height: 4,
                      margin: const EdgeInsets.only(top: 2),
                      decoration: BoxDecoration(
                        color: selected ? colors.onPrimary : colors.primary,
                        shape: BoxShape.circle,
                      ),
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
