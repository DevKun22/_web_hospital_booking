import 'package:hospital_booking_mobile/features/catalog/presentation/widgets/department_tile.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';

class DepartmentListScreen extends ConsumerStatefulWidget {
  const DepartmentListScreen({super.key});

  @override
  ConsumerState<DepartmentListScreen> createState() =>
      _DepartmentListScreenState();
}

class _DepartmentListScreenState extends ConsumerState<DepartmentListScreen> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(bookingFlowControllerProvider);
    final controller = ref.read(bookingFlowControllerProvider.notifier);
    final normalized = _query.trim().toLowerCase();
    final departments = state.departments
        .where((item) {
          if (normalized.isEmpty) return true;
          return item.name.toLowerCase().contains(normalized) ||
              (item.description?.toLowerCase().contains(normalized) ?? false);
        })
        .toList(growable: false);

    return AppCatalogScaffold(
      title: 'Chuyên khoa',
      onRefresh: controller.load,
      children: [
        AppPageIntro(
          title: 'Tìm đúng nơi chăm sóc',
          subtitle: 'Khám phá chuyên khoa và đội ngũ bác sĩ đang nhận lịch.',
          badge: state.departments.isEmpty
              ? null
              : '${state.departments.length} khoa',
        ),
        const SizedBox(height: AppSpacing.lg),
        AppSearchField(
          key: const Key('department-search'),
          controller: _searchController,
          hintText: 'Tìm chuyên khoa',
          onChanged: (value) => setState(() => _query = value),
          onClear: () {
            _searchController.clear();
            setState(() => _query = '');
          },
        ),
        if (state.error != null) ...[
          const SizedBox(height: AppSpacing.md),
          AppErrorBanner(
            error: state.error!,
            onDismiss: controller.dismissError,
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
        if (state.isCatalogLoading)
          ...List.generate(
            3,
            (_) => const Padding(
              padding: EdgeInsets.only(bottom: AppSpacing.sm),
              child: AppLoadingSkeleton(height: 116),
            ),
          )
        else if (departments.isEmpty)
          AppEmptyState(
            icon: Icons.local_hospital_outlined,
            title: normalized.isEmpty
                ? 'Chưa có chuyên khoa'
                : 'Không tìm thấy chuyên khoa',
            message: normalized.isEmpty
                ? 'Kéo xuống để thử tải lại dữ liệu.'
                : 'Thử từ khóa ngắn hơn hoặc xóa bộ lọc.',
            action: normalized.isEmpty
                ? FilledButton.icon(
                    onPressed: controller.load,
                    icon: const Icon(Icons.refresh_outlined),
                    label: const Text('Tải lại'),
                  )
                : OutlinedButton.icon(
                    onPressed: () {
                      _searchController.clear();
                      setState(() => _query = '');
                    },
                    icon: const Icon(Icons.restart_alt_outlined),
                    label: const Text('Xóa tìm kiếm'),
                  ),
          )
        else
          DepartmentGrid(
            children: [
              for (var i = 0; i < departments.length; i += 1)
                DepartmentTile(
                  id: departments[i].id,
                  name: departments[i].name,
                  slug: departments[i].slug,
                  image: departments[i].image,
                  index: i,
                  doctorCount: state.doctors
                      .where(
                        (doctor) => doctor.departmentId == departments[i].id,
                      )
                      .length,
                ),
            ],
          ),
      ],
    );
  }
}
