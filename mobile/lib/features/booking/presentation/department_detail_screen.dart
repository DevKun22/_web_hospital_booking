import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';
import 'package:hospital_booking_mobile/features/catalog/presentation/department_visuals.dart';
import 'package:hospital_booking_mobile/core/widgets/app_zone.dart';
import 'package:hospital_booking_mobile/core/widgets/app_detail.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/core/widgets/app_route_back_scope.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_entry_context.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';

class DepartmentDetailScreen extends ConsumerWidget {
  const DepartmentDetailScreen({required this.departmentId, super.key});

  final String departmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(bookingFlowControllerProvider);
    if (state.isCatalogLoading) {
      return AppRouteBackScope(
        fallbackLocation: '/departments',
        child: Scaffold(
          appBar: AppBar(
            leading: const AppRouteBackButton(fallbackLocation: '/departments'),
            title: const Text('Chuyên khoa'),
          ),
          body: const SafeArea(
            child: Padding(
              padding: EdgeInsets.all(AppSpacing.lg),
              child: AppLoadingSkeleton(height: 220),
            ),
          ),
        ),
      );
    }
    if (state.error != null && state.departments.isEmpty) {
      return AppRouteBackScope(
        fallbackLocation: '/departments',
        child: Scaffold(
          appBar: AppBar(
            leading: const AppRouteBackButton(fallbackLocation: '/departments'),
            title: const Text('Chuyên khoa'),
          ),
          body: AppEmptyState(
            icon: Icons.cloud_off_outlined,
            title: 'Chưa tải được chuyên khoa',
            message: state.error!.message,
            action: FilledButton.icon(
              onPressed: ref.read(bookingFlowControllerProvider.notifier).load,
              icon: const Icon(Icons.refresh_outlined),
              label: const Text('Thử lại'),
            ),
          ),
        ),
      );
    }

    final department = state.departments
        .where((item) => item.id == departmentId)
        .firstOrNull;
    if (department == null) {
      return AppRouteBackScope(
        fallbackLocation: '/departments',
        child: Scaffold(
          appBar: AppBar(
            leading: const AppRouteBackButton(fallbackLocation: '/departments'),
            title: const Text('Chuyên khoa'),
          ),
          body: AppEmptyState(
            icon: Icons.search_off_outlined,
            title: 'Không tìm thấy chuyên khoa',
            message: 'Nội dung có thể đã được cập nhật trên hệ thống.',
            action: FilledButton(
              onPressed: () => context.pushReplacement('/departments'),
              child: const Text('Xem danh sách chuyên khoa'),
            ),
          ),
        ),
      );
    }
    final doctors = state.doctors
        .where((item) => item.departmentId == departmentId)
        .toList(growable: false);
    final packages = state.packages
        .where((item) => item.departmentId == departmentId)
        .toList(growable: false);
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final visual = departmentVisual(
      context,
      name: department.name,
      slug: department.slug,
    );

    return AppRouteBackScope(
      fallbackLocation: '/departments',
      child: Scaffold(
        appBar: AppBar(
          leading: const AppRouteBackButton(fallbackLocation: '/departments'),
          title: Text(department.name),
        ),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.xs,
              AppSpacing.md,
              AppSpacing.xl,
            ),
            children: [
              AppDetailHeader(
                tint: visual.tint,
                leading: AppIconTile(
                  icon: visual.icon,
                  tint: (
                    background: colors.surface,
                    foreground: visual.tint.foreground,
                  ),
                  size: AppTileSize.xl,
                ),
                title: department.name,
                subtitle: department.description,
                chips: [
                  AppDetailChip(
                    label: doctors.isEmpty
                        ? 'Chưa có bác sĩ nhận lịch'
                        : '${doctors.length} bác sĩ nhận lịch',
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              AppDetailSection(
                title: 'Bác sĩ (${doctors.length})',
                actionLabel: doctors.isEmpty ? null : 'Xem tất cả',
                onAction: () => context.push(
                  Uri(
                    path: '/doctors',
                    queryParameters: {'departmentId': department.id},
                  ).toString(),
                ),
                child: doctors.isEmpty
                    ? Text(
                        'Vui lòng quay lại sau hoặc chọn chuyên khoa khác.',
                        style: text.bodyMedium?.copyWith(color: colors.muted),
                      )
                    : Column(
                        children: [
                          for (final doctor in doctors)
                            _DepartmentDoctorRow(doctor: doctor),
                        ],
                      ),
              ),
              if (packages.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                AppDetailSection(
                  title: 'Gói khám của khoa',
                  child: Column(
                    children: [
                      for (final item in packages)
                        _DepartmentPackageRow(item: item),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        bottomNavigationBar: AppDetailBar(
          primaryLabel: 'Đặt lịch chuyên khoa',
          onPrimary: () => openBookingFromCurrentRoute(
            context,
            Uri(
              path: '/booking',
              queryParameters: {'departmentId': department.id},
            ).toString(),
          ),
          onAssistant: () => context.push(
            chatbotLocationForContext(
              kind: ChatbotEntryKind.department,
              displayName: department.name,
            ),
          ),
        ),
      ),
    );
  }
}

class _DepartmentDoctorRow extends StatelessWidget {
  const _DepartmentDoctorRow({required this.doctor});

  final BookingDoctor doctor;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    return InkWell(
      onTap: () => context.push('/doctors/${Uri.encodeComponent(doctor.id)}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
        child: Row(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: colors.primarySoft,
              backgroundImage: resizedNetworkImage(
                context,
                doctor.avatar,
                logicalWidth: 44,
                logicalHeight: 44,
              ),
              child: doctor.avatar?.trim().isNotEmpty != true
                  ? Icon(Icons.person_outlined, color: colors.primary)
                  : null,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    doctor.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: text.titleSmall,
                  ),
                  Text(
                    formatVnd(doctor.consultationFee),
                    style: text.bodySmall?.copyWith(color: colors.muted),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_outlined, color: colors.muted),
          ],
        ),
      ),
    );
  }
}

class _DepartmentPackageRow extends StatelessWidget {
  const _DepartmentPackageRow({required this.item});

  final MedicalPackage item;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final slug = item.slug;
    return InkWell(
      onTap: slug == null
          ? null
          : () => context.push('/packages/${Uri.encodeComponent(slug)}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
        child: Row(
          children: [
            Expanded(child: Text(item.name, style: text.titleSmall)),
            const SizedBox(width: AppSpacing.sm),
            Text(
              formatVnd(item.finalPrice),
              style: text.labelLarge?.copyWith(color: colors.primaryDark),
            ),
          ],
        ),
      ),
    );
  }
}
