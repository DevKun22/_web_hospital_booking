import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

/// Tiêu đề từng phần của màn chọn lịch: số thứ tự nhỏ có màu và một dòng tiêu đề. Dòng phụ chỉ có khi thật cần giải thích.
class BookingStepHeader extends StatelessWidget {
  const BookingStepHeader({
    super.key,
    required this.number,
    required this.title,
    this.subtitle,
  });

  final int number;
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Container(
        width: 26,
        height: 26,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: context.colors.primarySoft,
          shape: BoxShape.circle,
        ),
        child: Text(
          '$number',
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: context.colors.primaryDark,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(title, style: Theme.of(context).textTheme.titleSmall),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 2),
              Text(
                subtitle!,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: context.colors.muted),
              ),
            ],
          ],
        ),
      ),
    ],
  );
}
