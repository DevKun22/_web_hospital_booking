import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_submission_controller.dart';

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

    return PopScope<void>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _finish(ref, context, '/home');
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Đặt lịch thành công')),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: const Color(0xFFE4F5EF),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Column(
                  children: [
                    const CircleAvatar(
                      radius: 34,
                      backgroundColor: AppTheme.primary,
                      foregroundColor: Colors.white,
                      child: Icon(Icons.check_rounded, size: 38),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Đã tiếp nhận lịch khám',
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Bệnh viện sẽ kiểm tra và xác nhận lịch của bạn.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    AppStatusBadge(
                      label: appointment.status == 'PENDING_CONFIRM'
                          ? 'CHỜ BỆNH VIỆN XÁC NHẬN'
                          : appointment.status,
                      tone: AppStatusTone.warning,
                      icon: Icons.hourglass_top_rounded,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    children: [
                      _DetailRow(
                        icon: Icons.confirmation_number_outlined,
                        label: 'Mã lịch hẹn',
                        value: appointment.bookingCode,
                        trailing: IconButton(
                          tooltip: 'Sao chép mã lịch',
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
                          icon: const Icon(Icons.copy_rounded),
                        ),
                      ),
                      const Divider(height: 26),
                      _DetailRow(
                        icon: Icons.person_outline_rounded,
                        label: 'Bệnh nhân',
                        value: appointment.patientName,
                      ),
                      const Divider(height: 26),
                      _DetailRow(
                        icon: Icons.medical_services_outlined,
                        label: appointment.departmentName,
                        value: appointment.doctorName,
                      ),
                      if (appointment.packageName != null) ...[
                        const Divider(height: 26),
                        _DetailRow(
                          icon: Icons.health_and_safety_outlined,
                          label: 'Gói khám',
                          value: appointment.packageName!,
                        ),
                      ],
                      const Divider(height: 26),
                      _DetailRow(
                        icon: Icons.calendar_month_outlined,
                        label: _displayDate(appointment.appointmentDate),
                        value:
                            '${_shortTime(appointment.startTime)} – ${_shortTime(appointment.endTime)}',
                      ),
                      const Divider(height: 26),
                      _DetailRow(
                        icon: Icons.payments_outlined,
                        label: 'Chi phí dự kiến',
                        value: _formatVnd(appointment.finalAmount),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: () => _finish(ref, context, '/home'),
                icon: const Icon(Icons.home_outlined),
                label: const Text('Về trang chủ'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () => _finish(ref, context, '/booking'),
                icon: const Icon(Icons.add_rounded),
                label: const Text('Đặt thêm lịch khác'),
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
    await ref.read(bookingSubmissionControllerProvider.notifier).reset();
    await ref.read(bookingFlowControllerProvider.notifier).clearSelection();
    if (context.mounted) context.go(destination);
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final String value;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, color: Theme.of(context).colorScheme.primary),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 3),
            Text(value, style: Theme.of(context).textTheme.titleSmall),
          ],
        ),
      ),
      ?trailing,
    ],
  );
}

String _shortTime(String value) =>
    value.length >= 5 ? value.substring(0, 5) : value;

String _displayDate(String value) {
  final parts = value.split('-');
  return parts.length == 3 ? '${parts[2]}/${parts[1]}/${parts[0]}' : value;
}

String _formatVnd(double value) {
  final digits = value.round().toString();
  final buffer = StringBuffer();
  for (var index = 0; index < digits.length; index += 1) {
    if (index > 0 && (digits.length - index) % 3 == 0) buffer.write('.');
    buffer.write(digits[index]);
  }
  return '${buffer.toString()} đ';
}
