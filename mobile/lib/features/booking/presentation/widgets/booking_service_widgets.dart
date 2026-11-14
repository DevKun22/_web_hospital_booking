import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

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
        : context.colors.surface,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
      side: BorderSide(
        color: selected ? context.colors.primary : context.colors.border,
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
                    ? context.colors.surface
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
              if (selected)
                Icon(Icons.check_circle_rounded, color: context.colors.primary),
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
                style: TextStyle(
                  color: context.colors.primaryDark,
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
      border: Border.all(color: context.colors.primary, width: 1.5),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.check_circle_rounded, color: context.colors.primary),
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
                    style: TextStyle(
                      color: context.colors.primaryDark,
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
        Icon(Icons.lock_outline_rounded, color: context.colors.primary),
        const SizedBox(width: 10),
        Expanded(
          child: Text(name, style: Theme.of(context).textTheme.titleSmall),
        ),
        Icon(Icons.check_circle_rounded, color: context.colors.primary),
      ],
    ),
  );
}
