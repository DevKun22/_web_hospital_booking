import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/catalog/data/catalog_repository.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_content.dart';

final catalogRepositoryProvider = Provider<CatalogRepository>(
  (ref) => CatalogRepository(ref.watch(authDioProvider)),
);

final departmentCatalogProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(catalogRepositoryProvider).fetchDepartments(),
);

final doctorCatalogControllerProvider =
    NotifierProvider<DoctorCatalogController, DoctorCatalogState>(
      DoctorCatalogController.new,
    );

class DoctorCatalogState {
  const DoctorCatalogState({
    this.items = const [],
    this.query = '',
    this.departmentId,
    this.error,
    this.page = 0,
    this.total = 0,
    this.totalPages = 0,
    this.isLoading = false,
    this.isLoadingMore = false,
  });

  final List<HomeDoctor> items;
  final String query;
  final String? departmentId;
  final ApiException? error;
  final int page;
  final int total;
  final int totalPages;
  final bool isLoading;
  final bool isLoadingMore;

  bool get hasMore => page < totalPages;

  DoctorCatalogState copyWith({
    List<HomeDoctor>? items,
    String? query,
    String? departmentId,
    bool clearDepartment = false,
    ApiException? error,
    bool clearError = false,
    int? page,
    int? total,
    int? totalPages,
    bool? isLoading,
    bool? isLoadingMore,
  }) => DoctorCatalogState(
    items: items ?? this.items,
    query: query ?? this.query,
    departmentId: clearDepartment ? null : departmentId ?? this.departmentId,
    error: clearError ? null : error ?? this.error,
    page: page ?? this.page,
    total: total ?? this.total,
    totalPages: totalPages ?? this.totalPages,
    isLoading: isLoading ?? this.isLoading,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
  );
}

class DoctorCatalogController extends Notifier<DoctorCatalogState> {
  int _requestVersion = 0;

  @override
  DoctorCatalogState build() => const DoctorCatalogState();

  Future<void> load({
    String? query,
    String? departmentId,
    bool clearDepartment = false,
  }) async {
    final normalizedQuery = (query ?? state.query).trim();
    final nextDepartment = clearDepartment
        ? null
        : departmentId ?? state.departmentId;
    final requestVersion = ++_requestVersion;
    state = state.copyWith(
      query: normalizedQuery,
      departmentId: nextDepartment,
      clearDepartment: clearDepartment,
      clearError: true,
      isLoading: true,
      isLoadingMore: false,
    );
    try {
      final result = await ref
          .read(catalogRepositoryProvider)
          .fetchDoctors(search: normalizedQuery, departmentId: nextDepartment);
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
          .fetchDoctors(
            search: state.query,
            departmentId: state.departmentId,
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
