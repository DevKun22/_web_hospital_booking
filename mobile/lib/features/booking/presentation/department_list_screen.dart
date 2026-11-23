import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_filter_tabs.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/catalog/application/department_catalog_controller.dart';
import 'package:hospital_booking_mobile/features/catalog/presentation/widgets/department_tile.dart';

/// Danh mục chuyên khoa: tìm trước (không dấu, chạy trên máy chủ), lọc nhanh, tải thêm khi cuộn gần cuối.
/// Không tải toàn bộ bác sĩ để đếm: số bác sĩ, gói và giờ trống của từng khoa do máy chủ trả sẵn.
class DepartmentListScreen extends ConsumerStatefulWidget {
  const DepartmentListScreen({super.key});

  @override
  ConsumerState<DepartmentListScreen> createState() =>
      _DepartmentListScreenState();
}

class _DepartmentListScreenState extends ConsumerState<DepartmentListScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(() {
      if (!mounted) return;
      final controller = ref.read(departmentCatalogControllerProvider.notifier);
      final state = ref.read(departmentCatalogControllerProvider);
      _searchController.text = state.query;
      // Quay lại màn này thì giữ kết quả đang có (đã đệm), chỉ tải khi chưa có trang nào.
      if (state.page == 0) controller.load();
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
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      ref.read(departmentCatalogControllerProvider.notifier).load(query: value);
    });
  }

  void _reset() {
    _debounce?.cancel();
    _searchController.clear();
    setState(() {});
    ref
        .read(departmentCatalogControllerProvider.notifier)
        .load(query: '', filter: DepartmentCatalogFilter.popular);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(departmentCatalogControllerProvider);
    final controller = ref.read(departmentCatalogControllerProvider.notifier);
    final filtered =
        state.query.isNotEmpty ||
        state.filter != DepartmentCatalogFilter.popular;

    return AppCatalogScaffold(
      title: 'Chuyên khoa',
      onRefresh: () => controller.load(),
      onLoadMore: controller.loadMore,
      pageStorageKey: const PageStorageKey('department-catalog-list'),
      children: [
        AppPageIntro(
          title: 'Tìm đúng nơi chăm sóc',
          subtitle: 'Gõ tên khoa hoặc triệu chứng, có dấu hay không đều được.',
          badge: state.total > 0 ? '${state.total} khoa' : null,
        ),
        const SizedBox(height: AppSpacing.lg),
        AppSearchField(
          key: const Key('department-search'),
          controller: _searchController,
          hintText: 'Tìm khoa hoặc triệu chứng',
          onChanged: _search,
          onClear: _reset,
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: [
            for (final (filter, label) in const [
              (DepartmentCatalogFilter.popular, 'Thường đặt'),
              (DepartmentCatalogFilter.available, 'Còn lịch'),
              (DepartmentCatalogFilter.alphabetical, 'A–Z'),
            ])
              AppFilterChip(
                label: label,
                selected: state.filter == filter,
                onTap: () => controller.load(filter: filter),
              ),
          ],
        ),
        if (state.error != null) ...[
          const SizedBox(height: AppSpacing.md),
          AppErrorBanner(
            error: state.error!,
            onDismiss: controller.dismissError,
          ),
        ],
        if (state.isLoading && state.items.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          const LinearProgressIndicator(minHeight: 2),
        ],
        const SizedBox(height: AppSpacing.lg),
        if (state.isLoading && state.items.isEmpty)
          DepartmentGrid(
            children: List.generate(
              4,
              (_) => const AppLoadingSkeleton(height: 132),
            ),
          )
        else if (state.items.isEmpty)
          AppEmptyState(
            icon: Icons.local_hospital_outlined,
            title: filtered
                ? 'Không tìm thấy chuyên khoa'
                : 'Chưa có chuyên khoa',
            message: filtered
                ? 'Thử từ khóa ngắn hơn hoặc bỏ bộ lọc.'
                : 'Kéo xuống để thử tải lại dữ liệu.',
            action: filtered
                ? OutlinedButton.icon(
                    onPressed: _reset,
                    icon: const Icon(Icons.restart_alt_outlined),
                    label: const Text('Xóa tìm kiếm'),
                  )
                : FilledButton.icon(
                    onPressed: () => controller.load(),
                    icon: const Icon(Icons.refresh_outlined),
                    label: const Text('Tải lại'),
                  ),
          )
        else
          DepartmentGrid(
            children: [
              for (final department in state.items)
                DepartmentTile(department: department),
            ],
          ),
        if (state.isLoadingMore)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
            child: Center(child: CircularProgressIndicator()),
          ),
      ],
    );
  }
}
