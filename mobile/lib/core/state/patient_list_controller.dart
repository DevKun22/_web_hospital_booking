import 'package:flutter/foundation.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/state/patient_list_page.dart';
import 'package:hospital_booking_mobile/core/state/synced_notifier.dart';

/// Trạng thái một danh sách dữ liệu cá nhân tải theo trang.
class PatientListState<T> {
  const PatientListState({
    this.items = const [],
    this.total = 0,
    this.nextPage = 1,
    this.hasNextPage = false,
    this.isInitialLoading = false,
    this.isRefreshing = false,
    this.isLoadingMore = false,
    this.busyItemId,
    this.lastSyncedAt,
    this.error,
  });

  final List<T> items;
  final int total;
  final int nextPage;
  final bool hasNextPage;
  final bool isInitialLoading;
  final bool isRefreshing;
  final bool isLoadingMore;

  /// Mục đang có thao tác ghi chạy (ví dụ lịch đang được hủy).
  final String? busyItemId;
  final DateTime? lastSyncedAt;
  final ApiException? error;

  bool get hasItems => items.isNotEmpty;

  PatientListState<T> copyWith({
    List<T>? items,
    int? total,
    int? nextPage,
    bool? hasNextPage,
    bool? isInitialLoading,
    bool? isRefreshing,
    bool? isLoadingMore,
    String? busyItemId,
    bool clearBusyItemId = false,
    DateTime? lastSyncedAt,
    ApiException? error,
    bool clearError = false,
  }) => PatientListState<T>(
    items: items ?? this.items,
    total: total ?? this.total,
    nextPage: nextPage ?? this.nextPage,
    hasNextPage: hasNextPage ?? this.hasNextPage,
    isInitialLoading: isInitialLoading ?? this.isInitialLoading,
    isRefreshing: isRefreshing ?? this.isRefreshing,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    busyItemId: clearBusyItemId ? null : (busyItemId ?? this.busyItemId),
    lastSyncedAt: lastSyncedAt ?? this.lastSyncedAt,
    error: clearError ? null : (error ?? this.error),
  );
}

/// Danh sách dữ liệu cá nhân của người khám đang đăng nhập: tải trang đầu, làm mới, tải thêm.
///
/// Đổi hoặc thoát tài khoản thì [build] chạy lại với người mới; mỗi yêu cầu mang số phiên bản nên phản hồi về muộn
/// của người trước bị bỏ, dữ liệu cá nhân không bao giờ lẫn sang phiên khác.
abstract class PatientListController<T>
    extends SyncedNotifier<PatientListState<T>> {
  static const pageSize = 20;

  int _requestVersion = 0;
  String? _patientId;

  /// Mã người khám của phiên hiện tại (null khi chưa đăng nhập). Lớp con đọc từ trạng thái đăng nhập.
  String? watchPatientId();

  Future<PatientListPage<T>> fetchPage({required int page, required int limit});

  String idOf(T item);

  @protected
  String? get patientId => _patientId;

  @protected
  int get requestVersion => _requestVersion;

  /// Phản hồi của thao tác bắt đầu ở [version] cho [patientId] còn áp được vào trạng thái hiện tại không.
  @protected
  bool isCurrent(int version, String? patientId) =>
      version == _requestVersion && patientId == _patientId;

  @override
  PatientListState<T> build() {
    _requestVersion += 1;
    _patientId = watchPatientId();
    if (_patientId != null) Future<void>.microtask(load);
    return PatientListState<T>(isInitialLoading: _patientId != null);
  }

  Future<void> load() async {
    if (_patientId == null) return;
    final version = ++_requestVersion;
    state = PatientListState<T>(isInitialLoading: true);
    await _loadFirstPage(version);
  }

  @override
  DateTime? get lastSyncedAt => state.lastSyncedAt;

  @override
  Future<void> refresh() async {
    if (_patientId == null || state.isInitialLoading || state.isRefreshing) {
      return;
    }
    final version = ++_requestVersion;
    state = state.copyWith(
      isInitialLoading: state.items.isEmpty,
      isRefreshing: state.items.isNotEmpty,
      isLoadingMore: false,
      clearError: true,
    );
    await _loadFirstPage(version);
  }

  Future<void> _loadFirstPage(int version) async {
    try {
      final page = await fetchPage(page: 1, limit: pageSize);
      if (version != _requestVersion) return;
      state = PatientListState<T>(
        items: page.items,
        total: page.total,
        nextPage: page.page + 1,
        hasNextPage: page.hasNextPage,
        lastSyncedAt: DateTime.now(),
      );
    } on ApiException catch (error) {
      if (version != _requestVersion) return;
      state = state.copyWith(
        isInitialLoading: false,
        isRefreshing: false,
        error: error,
      );
    }
  }

  Future<void> loadMore() async {
    if (_patientId == null ||
        state.isInitialLoading ||
        state.isRefreshing ||
        state.isLoadingMore ||
        !state.hasNextPage) {
      return;
    }
    final version = _requestVersion;
    state = state.copyWith(isLoadingMore: true, clearError: true);
    try {
      final page = await fetchPage(page: state.nextPage, limit: pageSize);
      if (version != _requestVersion) return;
      final byId = <String, T>{
        for (final item in state.items) idOf(item): item,
        for (final item in page.items) idOf(item): item,
      };
      state = state.copyWith(
        items: byId.values.toList(growable: false),
        total: page.total,
        nextPage: page.page + 1,
        hasNextPage: page.hasNextPage,
        isLoadingMore: false,
      );
    } on ApiException catch (error) {
      if (version != _requestVersion) return;
      state = state.copyWith(isLoadingMore: false, error: error);
    }
  }

  void dismissError() => state = state.copyWith(clearError: true);
}
