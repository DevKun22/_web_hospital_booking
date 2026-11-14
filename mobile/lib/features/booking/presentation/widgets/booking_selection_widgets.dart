import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_date_format.dart';

class BookingProgressStrip extends StatelessWidget {
  const BookingProgressStrip({super.key, required this.state});

  final BookingFlowState state;

  @override
  Widget build(BuildContext context) {
    final completed = <bool>[
      if (state.selection.serviceMode == BookingServiceMode.package)
        state.selection.packageId != null,
      state.selection.departmentId != null,
      state.selection.doctorId != null,
      state.selection.date != null,
      state.selection.slotId != null,
    ];
    return Row(
      children: List.generate(completed.length, (index) {
        final active = completed[index];
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(
              right: index == completed.length - 1 ? 0 : 6,
            ),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              height: 5,
              decoration: BoxDecoration(
                color: active
                    ? AppTheme.primary
                    : Theme.of(context).colorScheme.outlineVariant,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
        );
      }),
    );
  }
}

class BookingServiceModePicker extends StatelessWidget {
  const BookingServiceModePicker({
    super.key,
    required this.selected,
    required this.onSelected,
  });

  final BookingServiceMode selected;
  final ValueChanged<BookingServiceMode> onSelected;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text('Hình thức khám', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 10),
      SizedBox(
        width: double.infinity,
        child: SegmentedButton<BookingServiceMode>(
          showSelectedIcon: false,
          segments: const [
            ButtonSegment(
              value: BookingServiceMode.doctor,
              icon: Icon(Icons.person_search_outlined),
              label: Text('Theo bác sĩ'),
            ),
            ButtonSegment(
              value: BookingServiceMode.package,
              icon: Icon(Icons.health_and_safety_outlined),
              label: Text('Theo gói khám'),
            ),
          ],
          selected: {selected},
          onSelectionChanged: (values) => onSelected(values.first),
        ),
      ),
    ],
  );
}

class BookingPackageChoiceCard extends StatelessWidget {
  const BookingPackageChoiceCard({
    super.key,
    required this.packageItem,
    required this.selected,
    required this.onSelected,
  });

  final MedicalPackage packageItem;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) => Card(
    color: selected
        ? Theme.of(context).colorScheme.primaryContainer
        : Colors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
      side: BorderSide(
        color: selected ? AppTheme.primary : AppTheme.softBorder,
        width: selected ? 1.5 : 1,
      ),
    ),
    child: Padding(
      padding: const EdgeInsets.all(15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                backgroundColor: selected
                    ? Colors.white
                    : Theme.of(context).colorScheme.primaryContainer,
                child: const Icon(Icons.health_and_safety_outlined),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      packageItem.name,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    if (packageItem.summary != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        packageItem.summary!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Icon(
                selected
                    ? Icons.check_circle_rounded
                    : Icons.radio_button_unchecked_rounded,
                color: selected
                    ? AppTheme.primary
                    : Theme.of(context).colorScheme.outline,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                formatVnd(packageItem.finalPrice),
                style: const TextStyle(
                  color: AppTheme.primaryDark,
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (packageItem.isBhytSupport)
                const AppStatusBadge(
                  label: 'HỖ TRỢ BHYT',
                  tone: AppStatusTone.info,
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              if (packageItem.slug != null)
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => context.push(
                      '/packages/${Uri.encodeComponent(packageItem.slug!)}',
                    ),
                    child: const Text('Xem chi tiết'),
                  ),
                ),
              if (packageItem.slug != null) const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: onSelected,
                  child: Text(selected ? 'Đã chọn' : 'Chọn gói'),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

class BookingSelectedPackageCard extends StatelessWidget {
  const BookingSelectedPackageCard({
    super.key,
    required this.packageItem,
    required this.onChange,
  });

  final MedicalPackage packageItem;
  final VoidCallback onChange;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.primaryContainer,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: AppTheme.primary, width: 1.5),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.check_circle_rounded, color: AppTheme.primary),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    packageItem.name,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    formatVnd(packageItem.finalPrice),
                    style: const TextStyle(
                      color: AppTheme.primaryDark,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            const AppStatusBadge(label: 'ĐÃ CHỌN', tone: AppStatusTone.success),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            if (packageItem.slug != null)
              Expanded(
                child: OutlinedButton(
                  onPressed: () => context.push(
                    '/packages/${Uri.encodeComponent(packageItem.slug!)}',
                  ),
                  child: const Text('Xem chi tiết'),
                ),
              ),
            if (packageItem.slug != null) const SizedBox(width: 10),
            Expanded(
              child: TextButton.icon(
                onPressed: onChange,
                icon: const Icon(Icons.swap_horiz_rounded),
                label: const Text('Đổi gói'),
              ),
            ),
          ],
        ),
      ],
    ),
  );
}

class BookingLockedDepartmentCard extends StatelessWidget {
  const BookingLockedDepartmentCard({super.key, required this.name});

  final String name;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
    ),
    child: Row(
      children: [
        const Icon(Icons.lock_outline_rounded, color: AppTheme.primary),
        const SizedBox(width: 10),
        Expanded(
          child: Text(name, style: Theme.of(context).textTheme.titleSmall),
        ),
        const Icon(Icons.check_circle_rounded, color: AppTheme.primary),
      ],
    ),
  );
}

class BookingStepHeader extends StatelessWidget {
  const BookingStepHeader({
    super.key,
    required this.number,
    required this.title,
    required this.subtitle,
  });

  final int number;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      CircleAvatar(
        radius: 17,
        backgroundColor: Theme.of(context).colorScheme.primaryContainer,
        foregroundColor: Theme.of(context).colorScheme.primary,
        child: Text(
          '$number',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    ],
  );
}

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
        : Colors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
      side: BorderSide(
        color: selected ? AppTheme.primary : AppTheme.softBorder,
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
              backgroundColor: Colors.white,
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
                            ? AppTheme.primary
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
                        style: const TextStyle(
                          color: AppTheme.primaryDark,
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
                    color: selected ? AppTheme.primary : Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: selected ? AppTheme.primary : AppTheme.softBorder,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        weekdayLabel(date.weekday),
                        style: TextStyle(
                          color: selected
                              ? Colors.white
                              : Theme.of(context).colorScheme.onSurfaceVariant,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${date.day}/${date.month}',
                        style: TextStyle(
                          color: selected ? Colors.white : AppTheme.clinicalInk,
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
                avatar: const Icon(Icons.schedule_rounded, size: 17),
              ),
            ),
          );
        })
        .toList(growable: false),
  );
}

class BookingStickySummary extends StatelessWidget {
  const BookingStickySummary({super.key, required this.state});

  final BookingFlowState state;

  @override
  Widget build(BuildContext context) {
    final department = state.selectedDepartment!;
    final doctor = state.selectedDoctor!;
    final slot = state.selectedSlot!;
    final packageItem = state.selectedPackage;
    final price = packageItem?.finalPrice ?? doctor.consultationFee;
    return Material(
      color: Theme.of(context).colorScheme.surface,
      elevation: 8,
      shadowColor: AppPalette.ink.withValues(alpha: 0.12),
      child: SafeArea(
        top: false,
        minimum: const EdgeInsets.fromLTRB(
          AppSpacing.page,
          AppSpacing.sm,
          AppSpacing.page,
          AppSpacing.sm,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const AppStatusBadge(
                  label: 'ĐÃ CHỌN ĐỦ THÔNG TIN',
                  tone: AppStatusTone.success,
                  icon: Icons.check_circle_outline_rounded,
                ),
                const Spacer(),
                Text(
                  packageItem == null
                      ? formatVnd(price)
                      : 'Giá gói: ${formatVnd(price)}',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: AppPalette.primaryDark,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xxs),
            Text(
              packageItem?.name ?? doctor.displayName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: AppSpacing.xxs),
            Text(
              '${department.name} · ${displayDate(slot.date)} · ${shortTime(slot.startTime)}–${shortTime(slot.endTime)}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                key: const Key('booking-sticky-continue'),
                onPressed: () => context.push('/booking/patient'),
                icon: const Icon(Icons.arrow_forward_rounded),
                label: const Text('Tiếp tục nhập thông tin'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class BookingPendingCard extends StatelessWidget {
  const BookingPendingCard({super.key, required this.bookingCode});

  final String bookingCode;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.tertiaryContainer,
      borderRadius: BorderRadius.circular(18),
    ),
    child: Row(
      children: [
        const Icon(Icons.mark_email_unread_outlined),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Lịch $bookingCode đang chờ OTP',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: 3),
              const Text('Tiếp tục xác thực trước khi hết thời gian giữ lịch.'),
            ],
          ),
        ),
        TextButton(
          onPressed: () => context.push('/booking/verify'),
          child: const Text('Tiếp tục'),
        ),
      ],
    ),
  );
}

class BookingInlineEmpty extends StatelessWidget {
  const BookingInlineEmpty({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(16),
    ),
    child: Row(
      children: [
        const Icon(Icons.info_outline_rounded),
        const SizedBox(width: 10),
        Expanded(child: Text(message)),
      ],
    ),
  );
}
