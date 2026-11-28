import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_page.dart';

/// Trạng thái một danh mục tải theo trang từ máy chủ (bác sĩ, gói khám, chuyên khoa).
/// [F] là bộ lọc riêng của từng danh mục; tìm kiếm và phân trang dùng chung.
class PagedCatalogState<T, F> {
  const PagedCatalogState({
    required this.filter,
    this.items = const [],
    this.query = '',
    this.error,
    this.page = 0,
    this.total = 0,
    this.totalPages = 0,
    this.isLoading = false,
    this.isLoadingMore = false,
  });

  final List<T> items;
  final String query;
  final F filter;
  final ApiException? error;
  final int page;
  final int total;
  final int totalPages;
  final bool isLoading;
  final bool isLoadingMore;

  bool get hasMore => page < totalPages;

  PagedCatalogState<T, F> copyWith({
    List<T>? items,
    String? query,
    F? filter,
    ApiException? error,
    bool clearError = false,
    int? page,
    int? total,
    int? totalPages,
    bool? isLoading,
    bool? isLoadingMore,
  }) => PagedCatalogState<T, F>(
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

/// Tải trang đầu khi đổi tìm kiếm hoặc bộ lọc, nối trang kế khi cuộn gần cuối.
/// Mỗi yêu cầu có số phiên bản: phản hồi của lần gõ cũ về muộn bị bỏ, không ghi đè kết quả mới.
abstract class PagedCatalogController<T, F>
    extends Notifier<PagedCatalogState<T, F>> {
  int _requestVersion = 0;

  F get initialFilter;

  /// Khóa của một mục, để bỏ mục trùng khi danh mục thay đổi giữa hai lần tải trang.
  String idOf(T item);

  Future<CatalogPage<T>> fetchPage({
    required String query,
    required F filter,
    required int page,
  });

  @override
  PagedCatalogState<T, F> build() =>
      PagedCatalogState<T, F>(filter: initialFilter);

  Future<void> load({String? query, F? filter}) async {
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
      final result = await fetchPage(
        query: nextQuery,
        filter: nextFilter,
        page: 1,
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
      final result = await fetchPage(
        query: state.query,
        filter: state.filter,
        page: state.page + 1,
      );
      if (requestVersion != _requestVersion) return;
      state = state.copyWith(
        items: {
          for (final item in state.items) idOf(item): item,
          for (final item in result.items) idOf(item): item,
        }.values.toList(growable: false),
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
