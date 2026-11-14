import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/theme/app_theme.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';

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
