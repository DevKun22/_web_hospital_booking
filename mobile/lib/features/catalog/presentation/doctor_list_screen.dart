import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_route_back_scope.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/catalog/application/doctor_catalog_controller.dart';
import 'package:hospital_booking_mobile/features/catalog/presentation/widgets/doctor_catalog_card.dart';

class DoctorListScreen extends ConsumerStatefulWidget {
  const DoctorListScreen({
    super.key,
    this.initialDepartmentId,
    this.initialSearch,
  });

  final String? initialDepartmentId;
  final String? initialSearch;

  @override
  ConsumerState<DoctorListScreen> createState() => _DoctorListScreenState();
}

class _DoctorListScreenState extends ConsumerState<DoctorListScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _searchController.text = widget.initialSearch?.trim() ?? '';
    Future<void>.microtask(() {
      if (!mounted) return;
      ref
          .read(doctorCatalogControllerProvider.notifier)
          .load(
            query: _searchController.text,
            departmentId: widget.initialDepartmentId,
            clearDepartment: widget.initialDepartmentId == null,
          );
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _search(String value) {
    setState(() {});
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      ref.read(doctorCatalogControllerProvider.notifier).load(query: value);
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(doctorCatalogControllerProvider);
    final departments = ref
        .watch(departmentCatalogProvider)
        .when(
          data: (items) => items,
          error: (_, _) => const [],
          loading: () => const [],
        );
    final controller = ref.read(doctorCatalogControllerProvider.notifier);
    return AppRouteBackScope(
      fallbackLocation: '/home',
      child: Scaffold(
        appBar: AppBar(
          leading: const AppRouteBackButton(fallbackLocation: '/home'),
          title: const Text('Đội ngũ bác sĩ'),
        ),
        body: SafeArea(
          child: RefreshIndicator(
            onRefresh: () => controller.load(),
            child: NotificationListener<ScrollNotification>(
              onNotification: (notification) {
                if (notification.metrics.extentAfter < 360) {
                  controller.loadMore();
                }
                return false;
              },
              child: ListView(
                key: const PageStorageKey('doctor-catalog-list'),
                physics: const AlwaysScrollableScrollPhysics(),
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                children: [
                  AppPageIntro(
                    title: 'Chọn bác sĩ phù hợp',
                    subtitle:
                        'Tìm theo tên, chuyên môn hoặc lọc theo chuyên khoa.',
                    badge: state.total > 0 ? '${state.total} bác sĩ' : null,
                  ),
                  const SizedBox(height: 18),
                  AppSearchField(
                    key: const Key('doctor-catalog-search'),
                    controller: _searchController,
                    hintText: 'Tên bác sĩ hoặc chuyên môn',
                    onChanged: _search,
                    onClear: () {
                      _searchController.clear();
                      setState(() {});
                      controller.load(query: '');
                    },
                  ),
                  if (departments.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 42,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: departments.length + 1,
                        separatorBuilder: (_, _) => const SizedBox(width: 8),
                        itemBuilder: (context, index) {
                          final department = index == 0
                              ? null
                              : departments[index - 1];
                          final selected =
                              department?.id == state.departmentId ||
                              (department == null &&
                                  state.departmentId == null);
                          return ChoiceChip(
                            label: Text(department?.name ?? 'Tất cả'),
                            selected: selected,
                            onSelected: (_) => controller.load(
                              departmentId: department?.id,
                              clearDepartment: department == null,
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                  if (state.error != null) ...[
                    const SizedBox(height: 14),
                    AppErrorBanner(
                      error: state.error!,
                      onDismiss: controller.dismissError,
                    ),
                  ],
                  if (state.isLoading && state.items.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    const LinearProgressIndicator(minHeight: 2),
                  ],
                  const SizedBox(height: 18),
                  if (state.isLoading && state.items.isEmpty)
                    ...List.generate(
                      3,
                      (_) => const Padding(
                        padding: EdgeInsets.only(bottom: 12),
                        child: AppLoadingSkeleton(height: 230),
                      ),
                    )
                  else if (state.items.isEmpty)
                    AppEmptyState(
                      icon: Icons.person_search_outlined,
                      title: 'Chưa tìm thấy bác sĩ',
                      message: 'Thử từ khóa khác hoặc chọn tất cả chuyên khoa.',
                      action: OutlinedButton.icon(
                        onPressed: () {
                          _searchController.clear();
                          setState(() {});
                          controller.load(query: '', clearDepartment: true);
                        },
                        icon: const Icon(Icons.restart_alt_rounded),
                        label: const Text('Đặt lại bộ lọc'),
                      ),
                    )
                  else
                    ...state.items.map(
                      (doctor) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: DoctorCatalogCard(doctor: doctor),
                      ),
                    ),
                  if (state.isLoadingMore)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 18),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
