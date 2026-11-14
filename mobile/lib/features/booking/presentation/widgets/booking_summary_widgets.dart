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
    final department = state.selectedDepartment!;
    final doctor = state.selectedDoctor!;
    final slot = state.selectedSlot!;
    final packageItem = state.selectedPackage;
    final price = packageItem?.finalPrice ?? doctor.consultationFee;
    return Material(
      color: Theme.of(context).colorScheme.surface,
      elevation: 8,
      shadowColor: context.colors.ink.withValues(alpha: 0.12),
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
                    color: context.colors.primaryDark,
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
