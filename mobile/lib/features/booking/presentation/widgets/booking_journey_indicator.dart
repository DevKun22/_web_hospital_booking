import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';

class BookingJourneyIndicator extends StatelessWidget {
  const BookingJourneyIndicator({required this.currentStep, super.key});

  /// 0: chọn lịch, 1: thông tin bệnh nhân, 2: xác thực OTP.
  final int currentStep;

  static const _labels = ['Chọn lịch', 'Thông tin', 'Xác thực'];

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Bước ${currentStep + 1} trên 3: ${_labels[currentStep]}',
    child: Row(
      children: List.generate(_labels.length, (index) {
        final completed = index < currentStep;
        final active = index == currentStep;
        final color = completed || active
            ? AppTheme.primary
            : Theme.of(context).colorScheme.outlineVariant;
        return Expanded(
          child: Row(
            children: [
              Expanded(
                child: Column(
                  children: [
                    Row(
                      children: [
                        if (index > 0)
                          Expanded(child: Divider(color: color, thickness: 2)),
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          width: 30,
                          height: 30,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: active
                                ? AppTheme.primary
                                : completed
                                ? const Color(0xFFDDF3EE)
                                : const Color(0xFFF0F4F3),
                            border: Border.all(color: color, width: 1.5),
                          ),
                          child: completed
                              ? const Icon(
                                  Icons.check_rounded,
                                  size: 18,
                                  color: AppTheme.primaryDark,
                                )
                              : Center(
                                  child: Text(
                                    '${index + 1}',
                                    style: TextStyle(
                                      color: active
                                          ? Colors.white
                                          : Theme.of(
                                              context,
                                            ).colorScheme.onSurfaceVariant,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                        ),
                        if (index < _labels.length - 1)
                          Expanded(
                            child: Divider(
                              color: index < currentStep
                                  ? AppTheme.primary
                                  : Theme.of(
                                      context,
                                    ).colorScheme.outlineVariant,
                              thickness: 2,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      _labels[index],
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: active || completed
                            ? AppTheme.primaryDark
                            : Theme.of(context).colorScheme.onSurfaceVariant,
                        fontWeight: active ? FontWeight.w800 : FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      }),
    ),
  );
}
