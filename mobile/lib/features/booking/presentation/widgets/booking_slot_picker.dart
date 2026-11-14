import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_date_format.dart';

/// Buổi trong ngày dùng để nhóm khung giờ.
enum SlotPeriod { morning, afternoon, evening }

/// Sáng: trước 12:00; chiều: 12:00 đến trước 18:00; tối: từ 18:00.
SlotPeriod slotPeriodOf(String startTime) {
  final hour = int.tryParse(startTime.split(':').first) ?? 0;
  if (hour < 12) return SlotPeriod.morning;
  if (hour < 18) return SlotPeriod.afternoon;
  return SlotPeriod.evening;
}

class _PeriodStyle {
  const _PeriodStyle(this.title, this.icon, this.background, this.accent);

  final String title;
  final IconData icon;
  final Color background;
  final Color accent;
}

_PeriodStyle _styleOf(SlotPeriod period, AppColors colors) => switch (period) {
  SlotPeriod.morning => _PeriodStyle(
    'Buổi sáng',
    Icons.wb_sunny_rounded,
    colors.warningContainer,
    colors.warning,
  ),
  SlotPeriod.afternoon => _PeriodStyle(
    'Buổi chiều',
    Icons.wb_twilight_rounded,
    colors.infoContainer,
    colors.info,
  ),
  SlotPeriod.evening => _PeriodStyle(
    'Buổi tối',
    Icons.nights_stay_rounded,
    colors.violetContainer,
    colors.violet,
  ),
};

/// Khung giờ chia theo buổi (sáng/chiều/tối), mỗi buổi một thẻ có màu và biểu tượng
/// riêng, giờ xếp lưới 3 cột để quét nhanh.
class BookingSlotPicker extends StatelessWidget {
  const BookingSlotPicker({
    super.key,
    required this.items,
    required this.selectedId,
    required this.onSelected,
  });

  final List<BookingSlot> items;
  final String? selectedId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final groups = <SlotPeriod, List<BookingSlot>>{};
    for (final slot in items) {
      groups.putIfAbsent(slotPeriodOf(slot.startTime), () => []).add(slot);
    }
    final periods = SlotPeriod.values
        .where(groups.containsKey)
        .toList(growable: false);
    return Column(
      children: [
        for (var i = 0; i < periods.length; i += 1) ...[
          if (i > 0) const SizedBox(height: 12),
          _PeriodCard(
            style: _styleOf(periods[i], colors),
            slots: groups[periods[i]]!,
            selectedId: selectedId,
            onSelected: onSelected,
          ),
        ],
      ],
    );
  }
}

class _PeriodCard extends StatelessWidget {
  const _PeriodCard({
    required this.style,
    required this.slots,
    required this.selectedId,
    required this.onSelected,
  });

  final _PeriodStyle style;
  final List<BookingSlot> slots;
  final String? selectedId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: colors.surface,
                  shape: BoxShape.circle,
                ),
                child: Icon(style.icon, size: 18, color: style.accent),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  style.title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: style.accent,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Text(
                '${slots.length} khung giờ',
                style: Theme.of(
                  context,
                ).textTheme.labelMedium?.copyWith(color: style.accent),
              ),
            ],
          ),
          const SizedBox(height: 10),
          LayoutBuilder(
            builder: (context, constraints) {
              const gap = 8.0;
              final width = (constraints.maxWidth - gap * 2) / 3;
              return Wrap(
                spacing: gap,
                runSpacing: gap,
                children: [
                  for (final slot in slots)
                    SizedBox(
                      width: width,
                      child: _SlotTile(
                        slot: slot,
                        selected: slot.id == selectedId,
                        accent: style.accent,
                        onTap: () => onSelected(slot.id),
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _SlotTile extends StatelessWidget {
  const _SlotTile({
    required this.slot,
    required this.selected,
    required this.accent,
    required this.onTap,
  });

  final BookingSlot slot;
  final bool selected;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final label = '${shortTime(slot.startTime)} – ${shortTime(slot.endTime)}';
    return Semantics(
      key: ValueKey('booking-slot-${slot.id}'),
      button: true,
      selected: selected,
      label: label,
      onTap: onTap,
      child: ExcludeSemantics(
        child: AnimatedScale(
          scale: selected ? 1.04 : 1,
          duration: AppMotion.responsive(context, AppMotion.fast),
          curve: AppMotion.emphasized,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              AnimatedContainer(
                duration: AppMotion.responsive(context, AppMotion.fast),
                curve: AppMotion.emphasized,
                decoration: BoxDecoration(
                  color: selected ? colors.primary : colors.surface,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  border: Border.all(
                    color: selected ? colors.primary : colors.border,
                    width: selected ? 1.5 : 1,
                  ),
                  boxShadow: selected ? AppShadow.soft : null,
                ),
                child: Material(
                  type: MaterialType.transparency,
                  child: InkWell(
                    onTap: onTap,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        vertical: 11,
                        horizontal: 4,
                      ),
                      child: Text(
                        label,
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelMedium
                            ?.copyWith(
                              color: selected ? colors.onPrimary : colors.ink,
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                    ),
                  ),
                ),
              ),
              if (selected)
                Positioned(
                  top: -7,
                  right: -5,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: colors.surface,
                      shape: BoxShape.circle,
                      border: Border.all(color: colors.primary, width: 1.5),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(2),
                      child: Icon(
                        Icons.check_rounded,
                        size: 12,
                        color: colors.primary,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
