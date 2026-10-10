import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/widgets/app_route_back_scope.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';

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
              padding: EdgeInsets.all(20),
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
            icon: Icons.cloud_off_rounded,
            title: 'Chưa tải được chuyên khoa',
            message: state.error!.message,
            action: FilledButton.icon(
              onPressed: ref.read(bookingFlowControllerProvider.notifier).load,
              icon: const Icon(Icons.refresh_rounded),
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
            icon: Icons.search_off_rounded,
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

    return AppRouteBackScope(
      fallbackLocation: '/departments',
      child: Scaffold(
        appBar: AppBar(
          leading: const AppRouteBackButton(fallbackLocation: '/departments'),
          title: Text(department.name),
        ),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppTheme.primary, Color(0xFF0A9290)],
                  ),
                  borderRadius: BorderRadius.circular(22),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.medical_services_outlined,
                      color: Colors.white,
                      size: 34,
                    ),
                    const SizedBox(height: 14),
                    Text(
                      department.name,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    if (department.description != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        department.description!,
                        style: const TextStyle(color: Color(0xE6FFFFFF)),
                      ),
                    ],
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(0, 44),
                        backgroundColor: Colors.white,
                        foregroundColor: AppTheme.primary,
                      ),
                      onPressed: () => context.push(
                        Uri(
                          path: '/booking',
                          queryParameters: {'departmentId': department.id},
                        ).toString(),
                      ),
                      icon: const Icon(Icons.calendar_month_outlined),
                      label: const Text('Đặt lịch chuyên khoa này'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              AppSectionHeader(title: 'Bác sĩ (${doctors.length})'),
              const SizedBox(height: 10),
              if (doctors.isEmpty)
                const AppEmptyState(
                  icon: Icons.person_search_outlined,
                  title: 'Chưa có bác sĩ nhận lịch',
                  message: 'Vui lòng quay lại sau hoặc chọn chuyên khoa khác.',
                )
              else
                ...doctors.map(
                  (doctor) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _DepartmentDoctorCard(doctor: doctor),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DepartmentDoctorCard extends StatelessWidget {
  const _DepartmentDoctorCard({required this.doctor});

  final BookingDoctor doctor;

  @override
  Widget build(BuildContext context) => Card(
    child: InkWell(
      onTap: () => context.push('/doctors/${Uri.encodeComponent(doctor.id)}'),
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            CircleAvatar(
              radius: 27,
              backgroundColor: Theme.of(context).colorScheme.primaryContainer,
              backgroundImage: resizedNetworkImage(
                context,
                doctor.avatar,
                logicalWidth: 54,
                logicalHeight: 54,
              ),
              child: doctor.avatar?.trim().isNotEmpty != true
                  ? const Icon(Icons.person_outline_rounded)
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    doctor.displayName,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    doctor.specialization ?? doctor.departmentName,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded),
          ],
        ),
      ),
    ),
  );
}
