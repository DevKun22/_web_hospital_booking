import 'package:hospital_booking_mobile/core/widgets/app_zone.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/sync/patient_data_sync_coordinator.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointment_device_actions.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_submission_controller.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_date_format.dart';

/// Kết quả đặt lịch: đầu trang xanh báo đã tiếp nhận, mã lịch có nút sao chép, tóm tắt từng dòng có màu,
/// rồi các việc kế tiếp (thêm vào lịch máy, xem lịch hẹn, về trang chủ).
class BookingSuccessScreen extends ConsumerWidget {
  const BookingSuccessScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointment = ref
        .watch(bookingSubmissionControllerProvider)
        .appointment;
    if (appointment == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Kết quả đặt lịch')),
        body: AppEmptyState(
          icon: Icons.event_busy_outlined,
          title: 'Không có kết quả đặt lịch',
          message: 'Kết quả này chỉ hiển thị ngay sau khi xác thực OTP.',
          action: FilledButton(
            onPressed: () => context.go('/home'),
            child: const Text('Về trang chủ'),
          ),
        ),
      );
    }

    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final authenticated = ref.watch(authControllerProvider).isAuthenticated;
    return PopScope<void>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _finish(ref, context, '/home');
      },
      child: Scaffold(
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.page,
              AppSpacing.md,
              AppSpacing.page,
              AppSpacing.xxl,
            ),
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg,
                  vertical: AppSpacing.xl,
                ),
                decoration: BoxDecoration(
                  color: colors.successContainer,
                  borderRadius: BorderRadius.circular(AppRadius.xl),
                ),
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 32,
                      backgroundColor: colors.success,
                      child: Icon(
                        Icons.check_outlined,
                        size: 36,
                        color: colors.surface,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'Đã tiếp nhận lịch khám',
                      textAlign: TextAlign.center,
                      style: text.headlineSmall?.copyWith(
                        color: colors.success,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Cơ sở khám sẽ kiểm tra và xác nhận lịch của bạn.',
                      textAlign: TextAlign.center,
                      style: text.bodyMedium?.copyWith(color: colors.ink),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    AppStatusBadge(
                      label: appointment.status == 'PENDING_CONFIRM'
                          ? 'CHỜ CƠ SỞ KHÁM XÁC NHẬN'
                          : appointment.status,
                      tone: AppStatusTone.warning,
                      icon: Icons.hourglass_top_outlined,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm,
                ),
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  border: Border.all(color: colors.border),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Mã lịch hẹn',
                            style: text.labelMedium?.copyWith(
                              color: colors.muted,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.hair),
                          SelectableText(
                            appointment.bookingCode,
                            style: text.titleMedium?.copyWith(
                              color: colors.primaryDark,
                              letterSpacing: 0.6,
                            ),
                          ),
                        ],
                      ),
                    ),
                    FilledButton.tonalIcon(
                      onPressed: () async {
                        await Clipboard.setData(
                          ClipboardData(text: appointment.bookingCode),
                        );
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Đã sao chép mã lịch.'),
                            ),
                          );
                        }
                      },
                      icon: const Icon(Icons.copy_outlined, size: 18),
                      label: const Text('Sao chép'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  border: Border.all(color: colors.border),
                ),
                child: Column(
                  children: [
                    _DetailRow(
                      icon: Icons.calendar_month_outlined,
                      tint: colors.zone(AppZone.primary),
                      label: displayDate(appointment.appointmentDate),
                      value:
                          '${shortTime(appointment.startTime)} – ${shortTime(appointment.endTime)}',
                    ),
                    _DetailRow(
                      icon: Icons.medical_services_outlined,
                      tint: colors.zone(AppZone.danger),
                      label: appointment.departmentName,
                      value: appointment.doctorName,
                    ),
                    if (appointment.packageName != null)
                      _DetailRow(
                        icon: Icons.health_and_safety_outlined,
                        tint: colors.zone(AppZone.warning),
                        label: 'Gói khám',
                        value: appointment.packageName!,
                      ),
                    _DetailRow(
                      icon: Icons.person_outline_outlined,
                      tint: colors.zone(AppZone.care),
                      label: 'Người khám',
                      value: appointment.patientName,
                    ),
                    _DetailRow(
                      icon: Icons.payments_outlined,
                      tint: colors.zone(AppZone.violet),
                      label: 'Chi phí dự kiến',
                      value: formatVnd(appointment.finalAmount),
                      last: true,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              OutlinedButton.icon(
                onPressed: () async {
                  final added = await ref
                      .read(appointmentDeviceActionsProvider)
                      .addBookedToCalendar(appointment);
                  if (!context.mounted || added) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Không mở được lịch trên thiết bị.'),
                    ),
                  );
                },
                icon: const Icon(Icons.event_available_outlined),
                label: const Text('Thêm vào lịch điện thoại'),
              ),
              const SizedBox(height: AppSpacing.xs),
              // Đã đăng nhập (vừa được cấp phiên sau OTP): vào thẳng lịch hẹn, không phải nhập OTP lần hai.
              FilledButton.icon(
                onPressed: () => _finish(
                  ref,
                  context,
                  authenticated ? '/appointments' : '/home',
                ),
                icon: Icon(
                  authenticated
                      ? Icons.event_note_outlined
                      : Icons.home_outlined,
                ),
                label: Text(
                  authenticated ? 'Xem lịch hẹn của tôi' : 'Về trang chủ',
                ),
              ),
              const SizedBox(height: AppSpacing.xxs),
              Row(
                children: [
                  if (authenticated)
                    Expanded(
                      child: TextButton(
                        onPressed: () => _finish(ref, context, '/home'),
                        child: const Text('Về trang chủ'),
                      ),
                    ),
                  Expanded(
                    child: TextButton(
                      onPressed: () => _finish(ref, context, '/booking'),
                      child: const Text('Đặt thêm lịch khác'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _finish(
    WidgetRef ref,
    BuildContext context,
    String destination,
  ) async {
    final appointmentId = ref
        .read(bookingSubmissionControllerProvider)
        .appointment
        ?.id;
    unawaited(
      ref
          .read(patientDataSyncCoordinatorProvider)
          .handleBookingCompleted(appointmentId: appointmentId),
    );
    await ref.read(bookingSubmissionControllerProvider.notifier).reset();
    await ref.read(bookingFlowControllerProvider.notifier).clearSelection();
    if (context.mounted) context.go(destination);
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.tint,
    required this.label,
    required this.value,
    this.last = false,
  });

  final IconData icon;
  final ({Color background, Color foreground}) tint;
  final String label;
  final String value;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : AppSpacing.sm),
      child: Row(
        children: [
          AppIconTile(
            icon: icon,
            tint: tint,
            size: AppTileSize.sm,
            circle: true,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: text.labelMedium?.copyWith(color: colors.muted),
                ),
                Text(value, style: text.titleSmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
