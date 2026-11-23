import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';

/// Thanh tiến trình 3 bước: ba vạch mỏng và nhãn nhỏ bên dưới; bước đang làm và bước đã qua dùng màu chính.
class BookingJourneyIndicator extends StatelessWidget {
  const BookingJourneyIndicator({
    required this.currentStep,
    this.finalStepLabel = 'Xác thực',
    super.key,
  });

  /// 0: chọn lịch, 1: thông tin người khám, 2: bước cuối.
  final int currentStep;

  /// "Xác thực" khi còn OTP; "Hoàn tất" khi người đã đăng nhập đặt cho chính mình.
  final String finalStepLabel;

  List<String> get _labels => ['Chọn lịch', 'Thông tin', finalStepLabel];

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      label: 'Bước ${currentStep + 1} trên 3: ${_labels[currentStep]}',
      child: ExcludeSemantics(
        child: Column(
          children: [
            Row(
              children: List.generate(_labels.length, (index) {
                final reached = index <= currentStep;
                return Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(
                      right: index == _labels.length - AppSpacing.hair
                          ? 0
                          : AppSpacing.xxs,
                    ),
                    child: AnimatedContainer(
                      duration: AppMotion.responsive(
                        context,
                        AppMotion.standard,
                      ),
                      height: 4,
                      decoration: BoxDecoration(
                        color: reached ? colors.primary : colors.border,
                        borderRadius: BorderRadius.circular(AppRadius.xs),
                      ),
                    ),
                  ),
                );
              }),
            ),
            const SizedBox(height: AppSpacing.xs),
            Row(
              children: List.generate(_labels.length, (index) {
                final active = index == currentStep;
                return Expanded(
                  child: Text(
                    _labels[index],
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: index == 0
                        ? TextAlign.start
                        : index == _labels.length - 1
                        ? TextAlign.end
                        : TextAlign.center,
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: active ? colors.primaryDark : colors.muted,
                      fontWeight: active
                          ? AppFontWeight.strong
                          : AppFontWeight.regular,
                    ),
                  ),
                );
              }),
            ),
          ],
        ),
      ),
    );
  }
}
