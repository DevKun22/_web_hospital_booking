import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/formatters/vietnam_time.dart';

/// Chọn ngày sinh theo thứ tự thập niên, năm, tháng, ngày để không phải kéo lịch từng tháng.
/// Ngày sinh phải trước hôm nay (đúng quy tắc của máy chủ); trả về null khi đóng mà chưa chọn.
Future<DateTime?> showBirthDatePicker(
  BuildContext context, {
  DateTime? initial,
}) => showModalBottomSheet<DateTime>(
  context: context,
  isScrollControlled: true,
  useRootNavigator: true,
  useSafeArea: true,
  showDragHandle: true,
  builder: (_) => _BirthDateSheet(initial: initial),
);

class _BirthDateSheet extends StatefulWidget {
  const _BirthDateSheet({this.initial});

  final DateTime? initial;

  @override
  State<_BirthDateSheet> createState() => _BirthDateSheetState();
}

class _BirthDateSheetState extends State<_BirthDateSheet> {
  late final DateTime _today = vietnamToday();
  int? _decade;
  int? _year;
  int? _month;

  @override
  void initState() {
    super.initState();
    final initial = widget.initial;
    if (initial != null) {
      _year = initial.year;
      _decade = initial.year ~/ 10 * 10;
      _month = initial.month;
    } else {
      _decade = (_today.year - 30) ~/ 10 * 10;
    }
  }

  /// So theo năm, tháng, ngày (không so thời điểm) để không lệch vì múi giờ của máy.
  bool _isFuture(DateTime date) =>
      date.year > _today.year ||
      (date.year == _today.year &&
          (date.month > _today.month ||
              (date.month == _today.month && date.day >= _today.day)));

  int _daysIn(int year, int month) => DateUtils.getDaysInMonth(year, month);

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final firstDecade = 1910;
    final decades = [
      for (var d = _today.year ~/ 10 * 10; d >= firstDecade; d -= 10) d,
    ];
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.page,
        0,
        AppSpacing.page,
        AppSpacing.xl,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text('Ngày sinh', style: text.titleMedium)),
              Text(
                'Phải trước hôm nay',
                style: text.labelMedium?.copyWith(color: colors.muted),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          _Group(
            label: 'Năm sinh',
            children: [
              for (final decade in decades)
                _Pill(
                  key: ValueKey('birth-decade-$decade'),
                  label: '${decade}s',
                  selected: _decade == decade,
                  onTap: () => setState(() {
                    _decade = decade;
                    if (_year != null && _year! ~/ 10 * 10 != decade) {
                      _year = null;
                      _month = null;
                    }
                  }),
                ),
            ],
          ),
          if (_decade != null) ...[
            const SizedBox(height: AppSpacing.sm),
            _Group(
              label: 'Chọn năm',
              children: [
                for (var year = _decade!; year < _decade! + 10; year += 1)
                  if (year <= _today.year)
                    _Pill(
                      key: ValueKey('birth-year-$year'),
                      label: '$year',
                      selected: _year == year,
                      onTap: () => setState(() {
                        _year = year;
                        _month = null;
                      }),
                    ),
              ],
            ),
          ],
          if (_year != null) ...[
            const SizedBox(height: AppSpacing.sm),
            _Group(
              label: 'Chọn tháng',
              children: [
                for (var month = 1; month <= 12; month += 1)
                  if (_year! < _today.year || month <= _today.month)
                    _Pill(
                      key: ValueKey('birth-month-$month'),
                      label: 'Tháng $month',
                      selected: _month == month,
                      onTap: () => setState(() => _month = month),
                    ),
              ],
            ),
          ],
          if (_year != null && _month != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Chọn ngày',
              style: text.labelMedium?.copyWith(color: colors.muted),
            ),
            const SizedBox(height: AppSpacing.xs),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (var day = 1; day <= _daysIn(_year!, _month!); day += 1)
                  if (!_isFuture(DateTime(_year!, _month!, day)))
                    SizedBox(
                      width: 44,
                      child: _Pill(
                        key: ValueKey('birth-day-$day'),
                        label: '$day',
                        selected:
                            widget.initial?.year == _year &&
                            widget.initial?.month == _month &&
                            widget.initial?.day == day,
                        compact: true,
                        onTap: () => Navigator.of(
                          context,
                        ).pop(DateTime(_year!, _month!, day)),
                      ),
                    ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Group extends StatelessWidget {
  const _Group({required this.label, required this.children});

  final String label;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: Theme.of(
          context,
        ).textTheme.labelMedium?.copyWith(color: context.colors.muted),
      ),
      const SizedBox(height: AppSpacing.xs),
      Wrap(spacing: 8, runSpacing: 8, children: children),
    ],
  );
}

class _Pill extends StatelessWidget {
  const _Pill({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.compact = false,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: ExcludeSemantics(
        child: Material(
          color: selected ? colors.primary : colors.surface,
          shape: StadiumBorder(
            side: BorderSide(color: selected ? colors.primary : colors.border),
          ),
          child: InkWell(
            customBorder: const StadiumBorder(),
            onTap: onTap,
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: compact ? 0 : 14,
                vertical: 9,
              ),
              child: Center(
                widthFactor: compact ? null : 1,
                child: Text(
                  label,
                  maxLines: 1,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: selected ? colors.onPrimary : colors.ink,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
