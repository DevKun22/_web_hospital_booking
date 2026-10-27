import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_route_back_scope.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/catalog/application/package_catalog_controller.dart';
import 'package:hospital_booking_mobile/features/catalog/presentation/widgets/package_catalog_card.dart';

class PackageListScreen extends ConsumerStatefulWidget {
  const PackageListScreen({super.key, this.initialSearch});

  final String? initialSearch;

  @override
  ConsumerState<PackageListScreen> createState() => _PackageListScreenState();
}

class _PackageListScreenState extends ConsumerState<PackageListScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _searchController.text = widget.initialSearch?.trim() ?? '';
    Future<void>.microtask(
      () => ref
          .read(packageCatalogControllerProvider.notifier)
          .load(
            query: _searchController.text,
            filter: PackageCatalogFilter.all,
          ),
    );
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
      ref.read(packageCatalogControllerProvider.notifier).load(query: value);
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(packageCatalogControllerProvider);
    final controller = ref.read(packageCatalogControllerProvider.notifier);
    return AppRouteBackScope(
      fallbackLocation: '/home',
      child: Scaffold(
        appBar: AppBar(
          leading: const AppRouteBackButton(fallbackLocation: '/home'),
          title: const Text('Gói khám sức khỏe'),
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
                key: const PageStorageKey('package-catalog-list'),
                physics: const AlwaysScrollableScrollPhysics(),
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                children: [
                  AppPageIntro(
                    title: 'Chăm sóc chủ động',
                    subtitle:
                        'So sánh quyền lợi, chi phí và chọn gói phù hợp với nhu cầu.',
                    badge: state.total > 0 ? '${state.total} gói khám' : null,
                  ),
                  const SizedBox(height: 18),
                  AppSearchField(
                    key: const Key('package-catalog-search'),
                    controller: _searchController,
                    hintText: 'Tìm tên gói khám',
                    onChanged: _search,
                    onClear: () {
                      _searchController.clear();
                      setState(() {});
                      controller.load(query: '');
                    },
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _FilterChip(
                        label: 'Tất cả',
                        selected: state.filter == PackageCatalogFilter.all,
                        onTap: () =>
                            controller.load(filter: PackageCatalogFilter.all),
                      ),
                      _FilterChip(
                        label: 'Phổ biến',
                        selected: state.filter == PackageCatalogFilter.popular,
                        onTap: () => controller.load(
                          filter: PackageCatalogFilter.popular,
                        ),
                      ),
                      _FilterChip(
                        label: 'Hỗ trợ BHYT',
                        selected: state.filter == PackageCatalogFilter.bhyt,
                        onTap: () =>
                            controller.load(filter: PackageCatalogFilter.bhyt),
                      ),
                    ],
                  ),
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
                        child: AppLoadingSkeleton(height: 220),
                      ),
                    )
                  else if (state.items.isEmpty)
                    AppEmptyState(
                      icon: Icons.health_and_safety_outlined,
                      title: 'Chưa tìm thấy gói khám',
                      message: 'Thử từ khóa khác hoặc xem toàn bộ gói khám.',
                      action: OutlinedButton.icon(
                        onPressed: () {
                          _searchController.clear();
                          setState(() {});
                          controller.load(
                            query: '',
                            filter: PackageCatalogFilter.all,
                          );
                        },
                        icon: const Icon(Icons.restart_alt_rounded),
                        label: const Text('Đặt lại bộ lọc'),
                      ),
                    )
                  else
                    ...state.items.map(
                      (item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: PackageCatalogCard(item: item),
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

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ChoiceChip(
    label: Text(label),
    selected: selected,
    onSelected: (_) => onTap(),
  );
}
