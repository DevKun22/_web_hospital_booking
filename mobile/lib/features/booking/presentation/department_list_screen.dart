import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_route_back_scope.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';
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

    return AppRouteBackScope(
      fallbackLocation: '/home',
      child: Scaffold(
        appBar: AppBar(
          leading: const AppRouteBackButton(fallbackLocation: '/home'),
          title: const Text('Chuyên khoa'),
        ),
        body: SafeArea(
          child: RefreshIndicator(
            onRefresh: controller.load,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                AppPageIntro(
                  title: 'Tìm đúng nơi chăm sóc',
                  subtitle:
                      'Khám phá chuyên khoa và đội ngũ bác sĩ đang nhận lịch.',
                  badge: state.departments.isEmpty
                      ? null
                      : '${state.departments.length} khoa',
                ),
                const SizedBox(height: 18),
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
                  const SizedBox(height: 14),
                  AppErrorBanner(
                    error: state.error!,
                    onDismiss: controller.dismissError,
                  ),
                ],
                const SizedBox(height: 18),
                if (state.isCatalogLoading)
                  ...List.generate(
                    3,
                    (_) => const Padding(
                      padding: EdgeInsets.only(bottom: 12),
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
                            icon: const Icon(Icons.refresh_rounded),
                            label: const Text('Tải lại'),
                          )
                        : OutlinedButton.icon(
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _query = '');
                            },
                            icon: const Icon(Icons.restart_alt_rounded),
                            label: const Text('Xóa tìm kiếm'),
                          ),
                  )
                else
                  ...departments.map((department) {
                    final doctorCount = state.doctors
                        .where((doctor) => doctor.departmentId == department.id)
                        .length;
                    final imageProvider = resizedNetworkImage(
                      context,
                      department.image,
                      logicalWidth: 62,
                      logicalHeight: 62,
                    );
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Card(
                        margin: EdgeInsets.zero,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18),
                          side: const BorderSide(color: AppTheme.softBorder),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: () => context.push(
                            '/departments/${Uri.encodeComponent(department.id)}',
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Row(
                              children: [
                                Container(
                                  width: 62,
                                  height: 62,
                                  clipBehavior: Clip.antiAlias,
                                  decoration: BoxDecoration(
                                    color: Theme.of(
                                      context,
                                    ).colorScheme.primaryContainer,
                                    borderRadius: BorderRadius.circular(17),
                                  ),
                                  child: imageProvider == null
                                      ? const Icon(
                                          Icons.medical_services_outlined,
                                          color: AppTheme.primary,
                                          size: 29,
                                        )
                                      : Image(
                                          image: imageProvider,
                                          fit: BoxFit.cover,
                                          errorBuilder: (_, _, _) => const Icon(
                                            Icons.medical_services_outlined,
                                            color: AppTheme.primary,
                                          ),
                                        ),
                                ),
                                const SizedBox(width: 13),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        department.name,
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleMedium
                                            ?.copyWith(
                                              fontWeight: FontWeight.w800,
                                            ),
                                      ),
                                      const SizedBox(height: 5),
                                      Text(
                                        doctorCount == 0
                                            ? 'Xem thông tin chuyên khoa'
                                            : '$doctorCount bác sĩ đang nhận lịch',
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodySmall
                                            ?.copyWith(
                                              color: Theme.of(
                                                context,
                                              ).colorScheme.onSurfaceVariant,
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
                      ),
                    );
                  }),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
