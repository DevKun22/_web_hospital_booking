import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_route_back_scope.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_entry_context.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

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
              padding: EdgeInsets.all(AppSpacing.lg),
              child: Column(
                children: [
                  AppLoadingSkeleton(height: 220),
                  SizedBox(height: AppSpacing.sm),
                  AppLoadingSkeleton(height: 150),
                ],
              ),
            ),
            error: (error, _) {
              final message = error is ApiException
                  ? error.message
                  : 'Không tải được hồ sơ bác sĩ.';
              return AppEmptyState(
                icon: Icons.cloud_off_outlined,
                title: 'Chưa tải được hồ sơ',
                message: message,
                action: FilledButton.icon(
                  onPressed: () =>
                      ref.invalidate(doctorDetailProvider(doctorId)),
                  icon: const Icon(Icons.refresh_outlined),
                  label: const Text('Thử lại'),
                ),
              );
            },
            data: (doctor) => _DoctorDetailContent(doctor: doctor),
          ),
        ),
        bottomNavigationBar: doctor.when(
          loading: () => null,
          error: (_, _) => null,
          data: (doctor) => AppStickyActionBar(
            eyebrow: 'Phí khám dự kiến',
            value: formatVnd(doctor.consultationFee),
            secondaryLabel: 'Hỏi trợ lý',
            secondaryIcon: Icons.smart_toy_outlined,
            onSecondary: () => context.push(
              chatbotLocationForContext(
                kind: ChatbotEntryKind.doctor,
                displayName: doctor.displayName,
              ),
            ),
            primaryLabel: 'Đặt khám',
            primaryIcon: Icons.calendar_month_outlined,
            onPrimary: () =>
                openBookingFromCurrentRoute(context, _bookingLocation(doctor)),
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
    padding: const EdgeInsets.fromLTRB(
      AppSpacing.lg,
      AppSpacing.xs,
      AppSpacing.lg,
      AppSpacing.xxl,
    ),
    children: [
      Card(
        color: context.colors.successContainer,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
          side: BorderSide(color: context.colors.border),
        ),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
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
                    ? const Icon(Icons.person_outline_outlined, size: 44)
                    : null,
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                doctor.displayName,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: AppFontWeight.strong,
                ),
              ),
              const SizedBox(height: AppSpacing.xxs),
              Text(
                distinctSpecialization(
                      doctor.specialization,
                      doctor.departmentName,
                    ) ??
                    doctor.departmentName,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
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
                    label: formatVnd(doctor.consultationFee),
                    tone: AppStatusTone.success,
                    icon: Icons.payments_outlined,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: AppSpacing.lg),
      Text('Giới thiệu', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: AppSpacing.xs),
      Text(
        doctor.bio ??
            'Bác sĩ đang công tác tại chuyên khoa ${doctor.departmentName}.',
        style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.5),
      ),
      const SizedBox(height: AppSpacing.xl),
      OutlinedButton(
        onPressed: () => context.push(
          '/departments/${Uri.encodeComponent(doctor.departmentId)}',
        ),
        child: Text('Xem chuyên khoa ${doctor.departmentName}'),
      ),
    ],
  );
}

String _bookingLocation(BookingDoctor doctor) => Uri(
  path: '/booking',
  queryParameters: {'departmentId': doctor.departmentId, 'doctorId': doctor.id},
).toString();
