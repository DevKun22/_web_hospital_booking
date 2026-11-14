import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_date_format.dart';

class BookingCompactSelectionCard extends StatelessWidget {
  const BookingCompactSelectionCard({
    super.key,
    required this.doctorName,
    required this.departmentName,
    required this.date,
    required this.time,
    this.packageName,
    this.packagePrice,
  });

  final String doctorName;
  final String departmentName;
  final String? packageName;
  final double? packagePrice;
  final String date;
  final String time;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          const CircleAvatar(child: Icon(Icons.event_available_outlined)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (packageName != null) ...[
                  Text(
                    packageName!,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                  if (packagePrice != null)
                    Text(
                      formatVnd(packagePrice!),
                      style: Theme.of(context).textTheme.labelMedium,
                    ),
                  const SizedBox(height: 5),
                ],
                Text(doctorName, style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 3),
                Text('$departmentName · ${displayDate(date)} · $time'),
              ],
            ),
          ),
          IconButton(
            onPressed: () => context.go('/booking'),
            tooltip: 'Đổi lịch',
            icon: const Icon(Icons.edit_calendar_outlined),
          ),
        ],
      ),
    ),
  );
}
