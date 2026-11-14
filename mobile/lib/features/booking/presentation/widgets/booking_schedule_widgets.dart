import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_date_format.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

class BookingDepartmentPicker extends StatelessWidget {
  const BookingDepartmentPicker({
    super.key,
    required this.items,
    required this.selectedId,
    required this.onSelected,
  });

  final List<BookingDepartment> items;
  final String? selectedId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 8,
    runSpacing: 8,
    children: items
        .map(
          (item) => ChoiceChip(
            label: Text(item.name),
            selected: item.id == selectedId,
            onSelected: (_) => onSelected(item.id),
            showCheckmark: false,
            avatar: const Icon(Icons.medical_services_outlined, size: 17),
          ),
        )
        .toList(growable: false),
  );
}

class BookingDoctorChoiceCard extends StatelessWidget {
  const BookingDoctorChoiceCard({
    super.key,
    required this.doctor,
    required this.selected,
    required this.onTap,
  });

  final BookingDoctor doctor;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    color: selected
        ? Theme.of(context).colorScheme.primaryContainer
        : context.colors.surface,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
      side: BorderSide(
        color: selected ? context.colors.primary : context.colors.border,
        width: selected ? 1.5 : 1,
      ),
    ),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 28,
              backgroundColor: context.colors.surface,
              backgroundImage: resizedNetworkImage(
                context,
                doctor.avatar,
                logicalWidth: 56,
                logicalHeight: 56,
              ),
              child: doctor.avatar?.trim().isNotEmpty != true
                  ? const Icon(Icons.person_outline_rounded)
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          doctor.displayName,
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                      ),
                      Icon(
                        selected
                            ? Icons.check_circle_rounded
                            : Icons.radio_button_unchecked_rounded,
                        color: selected
                            ? context.colors.primary
                            : Theme.of(context).colorScheme.outline,
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    doctor.specialization ?? doctor.departmentName,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 12,
                    runSpacing: 5,
                    children: [
                      if (doctor.experience != null)
                        Text('${doctor.experience} năm kinh nghiệm'),
                      Text(
                        formatVnd(doctor.consultationFee),
                        style: TextStyle(
                          color: context.colors.primaryDark,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class BookingDatePicker extends StatelessWidget {
  const BookingDatePicker({
    super.key,
    required this.selectedDate,
    required this.onSelected,
  });

  final String? selectedDate;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final dates = nextVietnamDates(14);
    return SizedBox(
      height: 78,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: dates.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final date = dates[index];
          final value = formatApiDate(date);
          final selected = value == selectedDate;
          final label =
              '${weekdayLabel(date.weekday)}, '
              '${date.day}/${date.month}';
          return Semantics(
            key: ValueKey('booking-date-$value'),
            button: true,
            selected: selected,
            label: label,
            onTap: () => onSelected(value),
            child: ExcludeSemantics(
              child: InkWell(
                onTap: () => onSelected(value),
                borderRadius: BorderRadius.circular(16),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  width: 68,
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: selected
                        ? context.colors.primary
                        : context.colors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: selected
                          ? context.colors.primary
                          : context.colors.border,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        weekdayLabel(date.weekday),
                        style: TextStyle(
                          color: selected
                              ? context.colors.onPrimary
                              : Theme.of(context).colorScheme.onSurfaceVariant,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${date.day}/${date.month}',
                        style: TextStyle(
                          color: selected
                              ? context.colors.onPrimary
                              : context.colors.ink,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

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
  Widget build(BuildContext context) => Wrap(
    spacing: 8,
    runSpacing: 8,
    children: items
        .map((slot) {
          final selected = slot.id == selectedId;
          final label =
              '${shortTime(slot.startTime)} – ${shortTime(slot.endTime)}';
          return Semantics(
            key: ValueKey('booking-slot-${slot.id}'),
            button: true,
            selected: selected,
            label: label,
            onTap: () => onSelected(slot.id),
            child: ExcludeSemantics(
              child: ChoiceChip(
                label: Text(label),
                selected: selected,
                onSelected: (_) => onSelected(slot.id),
                showCheckmark: false,
                avatar: const Icon(Icons.schedule_rounded, size: 17),
              ),
            ),
          );
        })
        .toList(growable: false),
  );
}
