import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/features/catalog/application/doctor_catalog_controller.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';

enum PackageCatalogFilter { all, popular, bhyt }

final packageCatalogControllerProvider =
    NotifierProvider<PackageCatalogController, PackageCatalogState>(
      PackageCatalogController.new,
    );

class PackageCatalogState {
  const PackageCatalogState({
    this.items = const [],
    this.query = '',
    this.filter = PackageCatalogFilter.all,
    this.error,
    this.page = 0,
    this.total = 0,
    this.totalPages = 0,
    this.isLoading = false,
    this.isLoadingMore = false,
  });

  final List<MedicalPackage> items;
  final String query;
  final PackageCatalogFilter filter;
  final ApiException? error;
  final int page;
  final int total;
  final int totalPages;
  final bool isLoading;
  final bool isLoadingMore;

  bool get hasMore => page < totalPages;

  PackageCatalogState copyWith({
    List<MedicalPackage>? items,
    String? query,
    PackageCatalogFilter? filter,
    ApiException? error,
    bool clearError = false,
    int? page,
    int? total,
    int? totalPages,
    bool? isLoading,
    bool? isLoadingMore,
  }) => PackageCatalogState(
    items: items ?? this.items,
    query: query ?? this.query,
    filter: filter ?? this.filter,
    error: clearError ? null : error ?? this.error,
    page: page ?? this.page,
    total: total ?? this.total,
    totalPages: totalPages ?? this.totalPages,
    isLoading: isLoading ?? this.isLoading,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
  );
}

class PackageCatalogController extends Notifier<PackageCatalogState> {
  int _requestVersion = 0;

  @override
  PackageCatalogState build() => const PackageCatalogState();

  Future<void> load({String? query, PackageCatalogFilter? filter}) async {
    final nextQuery = (query ?? state.query).trim();
    final nextFilter = filter ?? state.filter;
    final requestVersion = ++_requestVersion;
    state = state.copyWith(
      query: nextQuery,
      filter: nextFilter,
      clearError: true,
      isLoading: true,
      isLoadingMore: false,
    );
    try {
      final result = await ref
          .read(catalogRepositoryProvider)
          .fetchPackages(
            search: nextQuery,
            isPopular: nextFilter == PackageCatalogFilter.popular ? true : null,
            isBhytSupport: nextFilter == PackageCatalogFilter.bhyt
                ? true
                : null,
          );
      if (requestVersion != _requestVersion) return;
      state = state.copyWith(
        items: result.items,
        page: result.page,
        total: result.total,
        totalPages: result.totalPages,
        isLoading: false,
      );
    } on ApiException catch (error) {
      if (requestVersion != _requestVersion) return;
      state = state.copyWith(error: error, isLoading: false);
    }
  }

  Future<void> loadMore() async {
    if (state.isLoading || state.isLoadingMore || !state.hasMore) return;
    final requestVersion = ++_requestVersion;
    state = state.copyWith(isLoadingMore: true, clearError: true);
    try {
      final result = await ref
          .read(catalogRepositoryProvider)
          .fetchPackages(
            search: state.query,
            isPopular: state.filter == PackageCatalogFilter.popular
                ? true
                : null,
            isBhytSupport: state.filter == PackageCatalogFilter.bhyt
                ? true
                : null,
            page: state.page + 1,
          );
      if (requestVersion != _requestVersion) return;
      state = state.copyWith(
        items: [...state.items, ...result.items],
        page: result.page,
        total: result.total,
        totalPages: result.totalPages,
        isLoadingMore: false,
      );
    } on ApiException catch (error) {
      if (requestVersion != _requestVersion) return;
      state = state.copyWith(error: error, isLoadingMore: false);
    }
  }

  void dismissError() => state = state.copyWith(clearError: true);
}
