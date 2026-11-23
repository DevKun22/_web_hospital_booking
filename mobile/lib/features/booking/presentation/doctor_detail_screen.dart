import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_route_back_scope.dart';
import 'package:hospital_booking_mobile/core/widgets/app_detail.dart';
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
          data: (doctor) => AppDetailBar(
            primaryLabel: 'Đặt khám với bác sĩ',
            onPrimary: () =>
                openBookingFromCurrentRoute(context, _bookingLocation(doctor)),
            onAssistant: () => context.push(
              chatbotLocationForContext(
                kind: ChatbotEntryKind.doctor,
                displayName: doctor.displayName,
              ),
            ),
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
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final facts = <(String, String)>[
      (formatVnd(doctor.consultationFee), 'Phí khám'),
      if (doctor.experience != null)
        ('${doctor.experience} năm', 'Kinh nghiệm'),
      if (doctor.reviewCount > 0)
        (
          doctor.averageRating.toStringAsFixed(1).replaceAll('.', ','),
          '${doctor.reviewCount} đánh giá',
        ),
    ];
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.xs,
        AppSpacing.md,
        AppSpacing.xl,
      ),
      children: [
        AppDetailHeader(
          tint: colors.zone(AppZone.primary),
          leading: CircleAvatar(
            radius: 32,
            backgroundColor: colors.surface,
            backgroundImage: resizedNetworkImage(
              context,
              doctor.avatar,
              logicalWidth: 64,
              logicalHeight: 64,
            ),
            child: doctor.avatar?.trim().isNotEmpty != true
                ? Icon(Icons.person_outlined, color: colors.primary)
                : null,
          ),
          title: doctor.displayName,
          subtitle:
              distinctSpecialization(
                doctor.specialization,
                doctor.departmentName,
              ) ??
              doctor.departmentName,
          chips: [
            if (distinctSpecialization(
                  doctor.specialization,
                  doctor.departmentName,
                ) !=
                null)
              AppDetailChip(label: doctor.departmentName),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        AppDetailFacts(facts: facts),
        const SizedBox(height: AppSpacing.sm),
        AppDetailSection(
          title: 'Giới thiệu',
          child: Text(
            doctor.bio ??
                'Bác sĩ đang công tác tại chuyên khoa ${doctor.departmentName}.',
            style: text.bodyMedium?.copyWith(color: colors.textSoft),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        AppSurfaceCard(
          onTap: () => context.push(
            '/departments/${Uri.encodeComponent(doctor.departmentId)}',
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Xem chuyên khoa ${doctor.departmentName}',
                  style: text.labelLarge,
                ),
              ),
              Icon(Icons.chevron_right_outlined, color: colors.muted),
            ],
          ),
        ),
      ],
    );
  }
}

String _bookingLocation(BookingDoctor doctor) => Uri(
  path: '/booking',
  queryParameters: {'departmentId': doctor.departmentId, 'doctorId': doctor.id},
).toString();
