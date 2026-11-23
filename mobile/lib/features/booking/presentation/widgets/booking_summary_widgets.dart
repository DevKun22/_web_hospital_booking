import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_date_format.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

class BookingStickySummary extends StatelessWidget {
  const BookingStickySummary({super.key, required this.state});

  final BookingFlowState state;

  @override
  Widget build(BuildContext context) {
    final doctor = state.selectedDoctor!;
    final slot = state.selectedSlot!;
    final packageItem = state.selectedPackage;
    final price = packageItem?.finalPrice ?? doctor.consultationFee;
    final text = Theme.of(context).textTheme;
    return Material(
      color: context.colors.surface,
      shape: Border(top: BorderSide(color: context.colors.border, width: 0.5)),
      child: SafeArea(
        top: false,
        // Chừa chỗ phía dưới: nút tròn Đặt lịch của thanh điều hướng nổi cao hơn thanh này khoảng 22dp.
        minimum: const EdgeInsets.fromLTRB(
          AppSpacing.page,
          AppSpacing.sm,
          AppSpacing.page,
          AppSpacing.xl + AppSpacing.sm,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${displayDate(slot.date)} · ${shortTime(slot.startTime)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: text.titleSmall,
                  ),
                ),
                Text(
                  formatVnd(price),
                  style: text.titleSmall?.copyWith(
                    color: context.colors.primaryDark,
                  ),
                ),
              ],
            ),
            Text(
              packageItem?.name ?? doctor.displayName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: text.bodySmall?.copyWith(color: context.colors.muted),
            ),
            const SizedBox(height: AppSpacing.xs),
            FilledButton(
              key: const Key('booking-sticky-continue'),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(
                  AppSize.primaryControlHeight,
                ),
              ),
              onPressed: () => context.push('/booking/patient'),
              child: const Text('Tiếp tục'),
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
