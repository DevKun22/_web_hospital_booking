import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/widgets/app_route_back_scope.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';

class DoctorDetailScreen extends ConsumerWidget {
  const DoctorDetailScreen({required this.doctorId, super.key});

  final String doctorId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final doctor = ref.watch(doctorDetailProvider(doctorId));
    return AppRouteBackScope(
      fallbackLocation: '/home',
      child: Scaffold(
        appBar: AppBar(
          leading: const AppRouteBackButton(fallbackLocation: '/home'),
          title: const Text('Hồ sơ bác sĩ'),
        ),
        body: SafeArea(
          child: doctor.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(20),
              child: Column(
                children: [
                  AppLoadingSkeleton(height: 220),
                  SizedBox(height: 12),
                  AppLoadingSkeleton(height: 150),
                ],
              ),
            ),
            error: (error, _) {
              final message = error is ApiException
                  ? error.message
                  : 'Không tải được hồ sơ bác sĩ.';
              return AppEmptyState(
                icon: Icons.cloud_off_rounded,
                title: 'Chưa tải được hồ sơ',
                message: message,
                action: FilledButton.icon(
                  onPressed: () =>
                      ref.invalidate(doctorDetailProvider(doctorId)),
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Thử lại'),
                ),
              );
            },
            data: (doctor) => _DoctorDetailContent(doctor: doctor),
          ),
        ),
      ),
    );
  }
}

class _DoctorDetailContent extends StatelessWidget {
  const _DoctorDetailContent({required this.doctor});

  final BookingDoctor doctor;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
    children: [
      Card(
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            children: [
              CircleAvatar(
                radius: 48,
                backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                backgroundImage: resizedNetworkImage(
                  context,
                  doctor.avatar,
                  logicalWidth: 96,
                  logicalHeight: 96,
                ),
                child: doctor.avatar?.trim().isNotEmpty != true
                    ? const Icon(Icons.person_outline_rounded, size: 44)
                    : null,
              ),
              const SizedBox(height: 14),
              Text(
                doctor.displayName,
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 5),
              Text(
                doctor.specialization ?? doctor.departmentName,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 16),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 10,
                runSpacing: 8,
                children: [
                  if (doctor.experience != null)
                    AppStatusBadge(
                      label: '${doctor.experience} năm kinh nghiệm',
                      tone: AppStatusTone.info,
                      icon: Icons.workspace_premium_outlined,
                    ),
                  AppStatusBadge(
                    label: _formatVnd(doctor.consultationFee),
                    tone: AppStatusTone.success,
                    icon: Icons.payments_outlined,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 18),
      Text('Giới thiệu', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 8),
      Text(
        doctor.bio ??
            'Bác sĩ đang công tác tại chuyên khoa ${doctor.departmentName}.',
        style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.5),
      ),
      const SizedBox(height: 24),
      FilledButton.icon(
        onPressed: () => context.push(
          Uri(
            path: '/booking',
            queryParameters: {
              'departmentId': doctor.departmentId,
              'doctorId': doctor.id,
            },
          ).toString(),
        ),
        icon: const Icon(Icons.calendar_month_outlined),
        label: const Text('Chọn ngày và giờ khám'),
      ),
      const SizedBox(height: 10),
      OutlinedButton(
        onPressed: () => context.push(
          '/departments/${Uri.encodeComponent(doctor.departmentId)}',
        ),
        child: Text('Xem chuyên khoa ${doctor.departmentName}'),
      ),
    ],
  );
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
